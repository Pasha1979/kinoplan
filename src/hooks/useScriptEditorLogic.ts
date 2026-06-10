import { useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DragHandle from '@tiptap/extension-drag-handle'
import { useEffect, useCallback, useRef, useState } from 'react'
import { DOMSerializer, Node as PMNode } from 'prosemirror-model'
import type { ScriptFormat, TimingSystem } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneNode } from '../components/tiptap'
import { useSmartType } from './useSmartType'
import { safeGetLocalStorage, safeSetLocalStorage } from '../utils/env'
import { PageCounter } from '../services/pageCounter'
import { extractScenesFromDocument } from '../utils/sceneExtractor'
import { convertToWordCompatibleHtml } from '../utils/wordExport'
import { useSceneEditorActions } from './useSceneEditorActions'

export interface UseScriptEditorLogicOptions {
  format?: ScriptFormat
  projectType: ProjectType
  projectId?: string
  currentSeries: number
  fontFamily: string
  fontSize: number
  isDark: boolean
  genreCoefficient: number
  timingSystem: TimingSystem
  onSceneCountChange?: (count: number) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
  onScenesChange?: (scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number; charCount: number }>) => void
  focusSceneId?: string
  onConvertReady?: (convertFn: (from: ScriptFormat, to: ScriptFormat) => void) => void
  onReorderReady?: (reorderFn: (fromIndex: number, toIndex: number) => void) => void
  onUpdateNumbersReady?: (updateFn: (scenes: Array<{ id: string; number: string }>) => void) => void
  smartTypeCharacters?: string[]
  smartTypeLocations?: string[]
  smartTypeTimes?: string[]
}

export function useScriptEditorLogic(options: UseScriptEditorLogicOptions) {
  const {
    format: _format,
    projectType,
    projectId,
    currentSeries,
    fontFamily,
    fontSize,
    isDark,
    onScenesChange,
    onStatsChange,
    focusSceneId,
    onConvertReady,
    onReorderReady,
    onUpdateNumbersReady,
    genreCoefficient,
    timingSystem,
    smartTypeCharacters,
    smartTypeLocations,
    smartTypeTimes,
  } = options

  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const editorBg = isDark ? '#111126' : '#fefefe'

  // SmartType — подсказки при наборе (дефолты пустые, учимся из текста сценария)
  const smartType = useSmartType({
    characters: smartTypeCharacters || [],
    locations: smartTypeLocations || [],
    times: smartTypeTimes || [],
  })
  // Ref-обёртка для SmartType чтобы не менять зависимости useEffect/useEditor
  const smartTypeRef = useRef(smartType)
  // eslint-disable-next-line react-hooks/refs
  smartTypeRef.current = smartType

  // Refs для динамических callback'ов useEditor (предотвращаем stale closures)
  const onUpdateRef = useRef<(({ editor }: { editor: Editor }) => void) | null>(null)
  const handleKeyDownRef = useRef<((view: Editor['view'], event: KeyboardEvent) => boolean) | null>(null)
  const handleCopyRef = useRef<((view: Editor['view'], event: ClipboardEvent) => boolean) | null>(null)

  // Refs для параметров, используемых внутри асинхронных таймаутов (защита от stale closures)
  const timingSystemRef = useRef(timingSystem)
  const genreCoefficientRef = useRef(genreCoefficient)
  const onScenesChangeRef = useRef(onScenesChange)
  const onStatsChangeRef = useRef(onStatsChange)

  // Обновляем refs в useEffect во избежание мутаций во время рендера
  useEffect(() => {
    timingSystemRef.current = timingSystem
    genreCoefficientRef.current = genreCoefficient
    onScenesChangeRef.current = onScenesChange
    onStatsChangeRef.current = onStatsChange
  }, [timingSystem, genreCoefficient, onScenesChange, onStatsChange])

  // Отслеживаем шапки с уже созданным переходом (избегаем дублирования)
  const processedHeadersRef = useRef<Set<string>>(new Set())
  // Флаг защиты от двойной авто-замены
  const isReplacingRef = useRef(false)
  // Таймаут сброса isReplacingRef (единый, чтобы не было утечки памяти)
  const isReplacingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Точное количество страниц (через виртуальный A4-рендеринг)
  const [precisePages, setPrecisePages] = useState<number>(0.1)
  // Ref для актуального значения — избегаем stale closure в setTimeout/setCallbacks
  const precisePagesRef = useRef<number>(0.1)
  // Дебаунс для подсчёта страниц (не считать на каждый символ)
  const pageCountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Сохраняем page breaks для повторного применения после ProseMirror рендера
  const pageBreaksRef = useRef<{ page: number; startIndex: number }[]>([])
  // Таймаут для гарантийного повторного применения page breaks
  const pageBreakApplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Per-component PageCounter instance (убран singleton)
  const pageCounterRef = useRef<PageCounter | null>(null)
  if (pageCounterRef.current == null) {
    pageCounterRef.current = new PageCounter()
  }
  // Ref для _format чтобы не добавлять его в deps useEffect (избегаем перезагрузки draft при смене формата)
  const _formatRef = useRef(_format)
  // eslint-disable-next-line react-hooks/refs
  _formatRef.current = _format

  // 1.1 Ключ localStorage: для сериала — отдельный черновик на каждую серию
  const draftKey = projectId
    ? (projectType === 'serial'
        ? `kinoplan_draft_${projectId}_s${currentSeries > 0 ? currentSeries : 1}`
        : `kinoplan_draft_${projectId}`)
    : 'kinoplan_tiptap_draft'

  // Получаем текущий тип блока
  const getCurrentBlockType = useCallback((ed: Editor | null) => {
    if (!ed) return 'paragraph'
    const { $from } = ed.state.selection
    const node = $from.node()
    return node?.attrs?.['data-type'] || node?.type?.name || 'paragraph'
  }, [])

  // Автоопределение типа блока по тексту (Фаза 2.5)
  const autoDetectBlockType = useCallback((editorInstance: Editor) => {
    const { state } = editorInstance
    const { selection } = state
    const { $from } = selection
    
    let currentNode = $from.node()
    
    if (currentNode && !['paragraph', 'sceneHeader', 'sceneAction', 'sceneCharacter', 'sceneDialog', 'sceneTransition'].includes(currentNode.type.name)) {
      for (let i = $from.depth; i > 0; i--) {
        const node = $from.node(i)
        if (node && ['paragraph', 'sceneHeader', 'sceneAction', 'sceneCharacter', 'sceneDialog', 'sceneTransition'].includes(node.type.name)) {
          currentNode = node
          break
        }
      }
    }
    
    if (!currentNode) return
    
    const textContent = currentNode.textContent.trim()
    const currentType = currentNode.type.name
    
    if (!textContent) return
    
    let newType: string | null = null
    
    const headerPattern = /^(\d+(?:-\d+)?\.\s*)?(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.)/i
    if (headerPattern.test(textContent)) {
      newType = 'sceneHeader'
    }
    else if (
      (currentType === 'sceneHeader' || currentType === 'sceneCast') && 
      /^[А-ЯЁA-Z\s,]+$/.test(textContent) && 
      textContent.includes(',')
    ) {
      newType = 'sceneCast'
    }
    else if (/^(РАССВЕТ|ЗАТЕМНЕНИЕ|ПЕРЕХОД|СМЕНА|CUT TO|FADE IN|FADE OUT)$/i.test(textContent)) {
      newType = 'sceneTransition'
    }
    else if (
      currentType !== 'sceneCast' && 
      textContent.length >= 2 && 
      textContent.length <= 25 &&
      !textContent.includes('.') && 
      !textContent.includes(',') && 
      textContent === textContent.toUpperCase() && 
      /^[А-ЯЁA-Z\s\-']+$/.test(textContent) && 
      /[А-ЯЁA-Z]/.test(textContent)
    ) {
      newType = 'sceneCharacter'
    }
    else if (currentType === 'paragraph' || currentType === 'sceneAction') {
      const resolvedPos = state.doc.resolve($from.before())
      const prevNode = resolvedPos.nodeBefore
      if (prevNode?.type.name === 'sceneCharacter') {
        newType = 'sceneDialog'
      }
    }
    
    if (newType && newType !== currentType) {
      editorInstance.chain().setNode(newType).run()
      return
    }

    const isHeader = currentType === 'sceneHeader'
    const isCharacter = currentType === 'sceneCharacter'
    
    if ((isHeader || isCharacter) && !isReplacingRef.current) {
      const upperText = textContent.toUpperCase()
      if (upperText !== textContent) {
        const cursorOffset = selection.from - $from.start()
        isReplacingRef.current = true
        const nodeStart = $from.start()
        const nodeEnd = $from.end()
        editorInstance
          .chain()
          .deleteRange({ from: nodeStart, to: nodeEnd })
          .insertContent(upperText)
          .setTextSelection(nodeStart + Math.min(cursorOffset, upperText.length))
          .run()
        if (isReplacingTimeoutRef.current) clearTimeout(isReplacingTimeoutRef.current)
        isReplacingTimeoutRef.current = setTimeout(() => { isReplacingRef.current = false }, 100)
        return
      }
    }

    if (isHeader && !isReplacingRef.current) {
      const upperText = textContent.toUpperCase()

      if (projectType === 'film') {
        const noNumberPattern = /^(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.)/i
        const alreadyNumbered = /^\d+\.\s*(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.)/i
        if (noNumberPattern.test(upperText) && !alreadyNumbered.test(upperText)) {
          let sceneCount = 0
          editorInstance.state.doc.descendants((n: PMNode) => {
            if (n.type.name === 'sceneHeader') {
              const t = n.textContent.trim()
              if (/^\d+\./.test(t)) sceneCount++
            }
          })
          const newText = `${sceneCount + 1}. ${upperText}`
          isReplacingRef.current = true
          const nodeStart = $from.start()
          const nodeEnd = $from.end()
          editorInstance
            .chain()
            .deleteRange({ from: nodeStart, to: nodeEnd })
            .insertContent(newText)
            .setTextSelection(nodeStart + newText.length)
            .run()
          if (isReplacingTimeoutRef.current) clearTimeout(isReplacingTimeoutRef.current)
          isReplacingTimeoutRef.current = setTimeout(() => { isReplacingRef.current = false }, 100)
          return
        }
      }

      if (projectType === 'serial' && currentSeries > 0) {
        const needsSeriesPattern = /^(\d+)\.\s*(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.)/i
        const alreadyHasSeriesPattern = /^\d+-\d+\.\s*(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.)/i
        const match = upperText.match(needsSeriesPattern)
        const alreadyHasSeries = alreadyHasSeriesPattern.test(upperText)

        if (match && !alreadyHasSeries) {
          const sceneNumber = match[1]
          const extType = match[2]
          const newText = `${currentSeries}-${sceneNumber}. ${extType}`
          isReplacingRef.current = true
          const nodeStart = $from.start()
          const nodeEnd = $from.end()
          editorInstance
            .chain()
            .deleteRange({ from: nodeStart, to: nodeEnd })
            .insertContent(newText)
            .setTextSelection(nodeStart + newText.length)
            .run()
          if (isReplacingTimeoutRef.current) clearTimeout(isReplacingTimeoutRef.current)
          isReplacingTimeoutRef.current = setTimeout(() => { isReplacingRef.current = false }, 100)
          return
        }
      }
      
      const timePattern = /\s(ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ)\.?$/
      if (timePattern.test(upperText)) {
        const headerKey = `${$from.start()}-${upperText}`
        if (!processedHeadersRef.current.has(headerKey)) {
          processedHeadersRef.current.add(headerKey)
          editorInstance.chain().splitBlock().setNode('sceneCast').run()
        }
      }
    }
  }, [projectType, currentSeries])

  const editor = useEditor({
    enableInputRules: false,
    enablePasteRules: false,
    extensions: [
      StarterKit.configure({
        orderedList: false,
        bulletList: false,
        listItem: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      SceneNode,
      SceneHeader,
      SceneCast,
      SceneAction,
      SceneCharacter,
      SceneDialog,
      SceneTransition,
      DragHandle,
      Placeholder.configure({
        placeholder: 'Начните писать сценарий...',
      }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: `tiptap-editor prose prose-sm max-w-none focus:outline-none format-${_format || 'russian'}`,
        style: `font-family: ${fontFamily}; font-size: ${fontSize}pt;`,
      },
      handleDOMEvents: {
        copy: (view, event) => handleCopyRef.current?.(view, event) ?? false,
      },
      handleKeyDown: (view, event) => handleKeyDownRef.current?.(view, event) ?? false,
    },
  })

  // Хук для drag-and-drop, scroll к сцене, обновления номеров
  useSceneEditorActions({
    editor,
    focusSceneId,
    onReorderReady,
    onUpdateNumbersReady,
    precisePagesRef,
    timingSystem,
    genreCoefficient,
    onScenesChange,
    onStatsChange,
  })

  // Применяем page-start классы к DOM редактора (setTimeout — дать ProseMirror завершить рендер)
  const applyPageBreaks = useCallback(() => {
    if (!editor || pageBreaksRef.current.length <= 1) return
    setTimeout(() => {
      const editorDom = editor.view.dom as HTMLElement
      const children = Array.from(editorDom.children) as HTMLElement[]
      children.forEach(child => {
        child.classList.remove('page-start')
        child.removeAttribute('data-page')
      })
      pageBreaksRef.current.slice(1).forEach(breakInfo => {
        const child = children[breakInfo.startIndex]
        if (child) {
          child.classList.add('page-start')
          child.setAttribute('data-page', `Страница ${breakInfo.page}`)
        }
      })
    }, 0)
  }, [editor])

  // Устанавливаем актуальные callback'и в refs (предотвращаем stale closures в useEditor)
  // eslint-disable-next-line react-hooks/refs
  handleCopyRef.current = (view, event) => {
    const { state } = view
    const { selection } = state
    if (selection.empty) return false

    const div = document.createElement('div')
    const serializer = DOMSerializer.fromSchema(state.schema)
    div.appendChild(serializer.serializeFragment(selection.content().content))

    const html = convertToWordCompatibleHtml(div.innerHTML, (_format as 'russian' | 'hollywood') || 'russian')

    event.clipboardData?.setData('text/html', html)
    event.clipboardData?.setData('text/plain', div.textContent || '')
    event.preventDefault()
    return true
  }

  // eslint-disable-next-line react-hooks/refs
  handleKeyDownRef.current = (view, event) => {
    const st = smartTypeRef.current
    if (st.isOpen && (event.key === 'Enter' || event.key === 'Tab')) {
      event.preventDefault()
      const suggestion = st.suggestions[st.activeIndex]
      if (suggestion && editor) {
        const { state } = editor
        const { selection } = state
        const { $from } = selection
        
        const currentNode = $from.node()
        const nodeText = currentNode?.textContent || ''
        const posInNode = selection.from - $from.start()
        
        const beforeCursor = nodeText.substring(0, posInNode)
        const match = beforeCursor.match(/[^\s]*$/)
        const currentWord = match ? match[0] : ''
        
        if (currentWord) {
          const wordStartPos = selection.from - currentWord.length
          const wordEndPos = selection.from
          
          const textToInsert = suggestion.type === 'time' 
            ? suggestion.text + '.' 
            : suggestion.text
          
          editor
            .chain()
            .focus()
            .deleteRange({ from: wordStartPos, to: wordEndPos })
            .insertContent(textToInsert)
            .run()
          
          st.closeSuggestions()
        }
      }
      return true
    }
    
    if (st.isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      st.navigateSuggestions(event.key === 'ArrowDown' ? 'down' : 'up')
      return true
    }
    
    if (st.isOpen && event.key === 'Escape') {
      event.preventDefault()
      st.closeSuggestions()
      return true
    }
    
    if (event.key === 'Enter' && !event.shiftKey) {
      const { state } = view
      const { selection } = state
      const { $from } = selection
      const currentNode = $from.node()
      const currentType = currentNode?.type.name
      
      if (currentType === 'sceneHeader') {
        event.preventDefault()
        editor?.chain().splitBlock().setNode('sceneCast').run()
        return true
      }
      
      if (currentType === 'sceneCast') {
        event.preventDefault()
        editor?.chain().splitBlock().setNode('sceneAction').run()
        return true
      }
      
      if (currentType === 'sceneCharacter') {
        event.preventDefault()
        editor?.chain().splitBlock().setNode('sceneDialog').run()
        return true
      }
      
      if (currentType === 'sceneDialog') {
        event.preventDefault()
        editor?.chain().splitBlock().setNode('sceneAction').run()
        return true
      }
    }
    
    return false
  }

  // eslint-disable-next-line react-hooks/refs
  onUpdateRef.current = ({ editor: editorInstance }) => {
    const html = editorInstance.getHTML()

    safeSetLocalStorage(draftKey, html)

    if (pageCountTimeoutRef.current) {
      clearTimeout(pageCountTimeoutRef.current)
    }
    pageCountTimeoutRef.current = setTimeout(() => {
      const result = pageCounterRef.current!.calculatePagesWithBreaks(html, (_formatRef.current as 'russian' | 'hollywood') || 'russian')
      setPrecisePages(result.totalPages)
      precisePagesRef.current = result.totalPages
      // extractScenesFromDocument вызывается внутри того же debounce, потому что
      // требует forcedPages из pageCounter. Разделение на отдельный debounce
      // приведёт к рассинхронизации: сцены будут парситься со старым forcedPages.
      if (editorInstance) {
        const { scenes: extractedScenes, stats } = extractScenesFromDocument({
          doc: editorInstance.state.doc,
          forcedPages: result.totalPages,
          precisePagesFallback: precisePagesRef.current,
          timingSystem: timingSystemRef.current,
          genreCoefficient: genreCoefficientRef.current,
        })
        onScenesChangeRef.current?.(extractedScenes)
        onStatsChangeRef.current?.(stats)

        // Обучаем SmartType из текста сценария
        const allCast = new Set<string>()
        const allLocations = new Set<string>()
        const allTimes = new Set<string>()
        extractedScenes.forEach((s) => {
          s.cast.forEach((c) => allCast.add(c))
          if (s.location) allLocations.add(s.location)
          if (s.time) allTimes.add(s.time)
        })
        smartTypeRef.current.updateLists({
          characters: [...allCast],
          locations: [...allLocations],
          times: [...allTimes],
        })
      }

      pageBreaksRef.current = result.breaks
      pageCountTimeoutRef.current = null
    }, 400)

    autoDetectBlockType(editorInstance)
    
    const { state } = editorInstance
    const { selection } = state
    const { $from } = selection
    const currentType = getCurrentBlockType(editorInstance)
    
    const st = smartTypeRef.current
    if (currentType === 'sceneHeader' || currentType === 'paragraph' || currentType === 'sceneCharacter') {
      const currentNode = $from.node()
      const nodeText = currentNode?.textContent || ''
      const nodeStartPos = $from.start()
      const posInNode = selection.from - nodeStartPos
      st.updateSuggestions(nodeText, posInNode, currentType === 'sceneCharacter' ? 'sceneCharacter' : 'sceneHeader')
    } else {
      st.closeSuggestions()
    }
  }

  // Обновляем CSS-класс формата при переключении RU/EN
  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom as HTMLElement
    el.classList.remove('format-russian', 'format-hollywood', 'format-custom')
    el.classList.add(`format-${_format || 'russian'}`)
  }, [editor, _format])

  // Подписываемся на 'update' динамически (useEditor не обновляет callback'и)
  useEffect(() => {
    if (!editor) return
    const handler = ({ editor: ed }: { editor: Editor }) => onUpdateRef.current?.({ editor: ed })
    editor.on('update', handler)
    return () => { editor.off('update', handler) }
  }, [editor])

  // Cleanup: очищаем все timeout и DOM при unmount
  useEffect(() => {
    return () => {
      if (isReplacingTimeoutRef.current) {
        clearTimeout(isReplacingTimeoutRef.current)
        isReplacingTimeoutRef.current = null
      }
      if (pageCountTimeoutRef.current) {
        clearTimeout(pageCountTimeoutRef.current)
        pageCountTimeoutRef.current = null
      }
      if (pageBreakApplyTimeoutRef.current) {
        clearTimeout(pageBreakApplyTimeoutRef.current)
        pageBreakApplyTimeoutRef.current = null
      }
      pageCounterRef.current?.destroy()
      pageCounterRef.current = null
    }
  }, [])

  // Загружаем черновик при монтировании И при смене серии (draftKey меняется)
  useEffect(() => {
    if (editor) {
      const saved = safeGetLocalStorage(draftKey)
      editor.commands.setContent(saved || '<p></p>')
      processedHeadersRef.current.clear()
    }
  }, [editor, draftKey, applyPageBreaks])

  // 4.1 Конвертация формата RU↔EN — передаём функцию в ScriptPage через onConvertReady
  useEffect(() => {
    if (!editor || !onConvertReady) return

    const convertFormat = (from: ScriptFormat, to: ScriptFormat) => {
      if (from === to) return
      let html = editor.getHTML()

      if (from === 'russian' && to === 'hollywood') {
        html = html.replace(/ИНТ-ЭКСТ\./gi, 'INT/EXT.')
        html = html.replace(/ИНТ\./gi, 'INT.')
        html = html.replace(/ЭКСТ\./gi, 'EXT.')
        html = html.replace(/—/g, '-')
        html = html.replace(/\bДЕНЬ\b/gi, 'DAY')
        html = html.replace(/\bНОЧЬ\b/gi, 'NIGHT')
        html = html.replace(/\bУТРО\b/gi, 'MORNING')
        html = html.replace(/\bВЕЧЕР\b/gi, 'EVENING')
        html = html.replace(/\bРАССВЕТ\b/gi, 'DAWN')
        html = html.replace(/\bЗАКАТ\b/gi, 'DUSK')
      } else if (from === 'hollywood' && to === 'russian') {
        html = html.replace(/INT\/EXT\./gi, 'ИНТ-ЭКСТ.')
        html = html.replace(/INT\./gi, 'ИНТ.')
        html = html.replace(/EXT\./gi, 'ЭКСТ.')
        html = html.replace(/ - /g, ' — ')
        html = html.replace(/\bDAY\b/gi, 'ДЕНЬ')
        html = html.replace(/\bNIGHT\b/gi, 'НОЧЬ')
        html = html.replace(/\bMORNING\b/gi, 'УТРО')
        html = html.replace(/\bEVENING\b/gi, 'ВЕЧЕР')
        html = html.replace(/\bDAWN\b/gi, 'РАССВЕТ')
        html = html.replace(/\bDUSK\b/gi, 'ЗАКАТ')
      }

      editor.commands.setContent(html)
      processedHeadersRef.current.clear()
    }

    onConvertReady(convertFormat)
  }, [editor, onConvertReady])

  // Функция для установки типа блока
  const setBlockType = useCallback((type: string) => {
    if (!editor) return
    editor.chain()
      .focus()
      .setNode(type)
      .run()
  }, [editor])

  const currentType = getCurrentBlockType(editor)

  return {
    editor,
    precisePages,
    isDark,
    textPrimary,
    editorBg,
    smartType,
    currentType,
    setBlockType,
    _format,
  }
}
