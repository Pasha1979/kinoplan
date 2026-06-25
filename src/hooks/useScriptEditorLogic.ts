import { useEditor, type Editor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DragHandle from '@tiptap/extension-drag-handle'
import { useEffect, useCallback, useRef, useState } from 'react'
import { DOMSerializer, Node as PMNode } from 'prosemirror-model'
import type { ScriptFormat, TimingSystem } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneNode, SceneParenthetical } from '../components/tiptap'
import { useSmartType } from './useSmartType'
// localStorage больше не используется — контент хранится в scriptStore
import { PageCounter } from '../services/pageCounter'
import { extractScenesFromDocument } from '../utils/sceneExtractor'
import { convertToWordCompatibleHtml } from '../utils/wordExport'
import { useSceneEditorActions } from './useSceneEditorActions'
import { parseScreenplayText, blocksToHtml } from '../utils/parseScreenplayText'
import { sanitizeHtml, sanitizePlainText, isScreenplayContent } from '../utils/pasteSanitizer'
import { createSearchPlugin } from './useScriptSearch'

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
  onScenesChange?: (scenes: Array<{ id: string; number: string; type: string; location: string; sublocation?: string; time: string; cast: string[]; pages: number; charCount: number }>) => void
  focusSceneId?: string
  onConvertReady?: (convertFn: (from: ScriptFormat, to: ScriptFormat) => void) => void
  onReorderReady?: (reorderFn: (fromIndex: number, toIndex: number) => void) => void
  onUpdateNumbersReady?: (updateFn: (scenes: Array<{ id: string; number: string }>) => void) => void
  smartTypeCharacters?: string[]
  smartTypeLocations?: string[]
  smartTypeTimes?: string[]
  formatLocked?: boolean
  initialContent?: string
  onContentChange?: (html: string) => void
}

export function useScriptEditorLogic(options: UseScriptEditorLogicOptions) {
  const {
    format: _format,
    projectType,
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
    formatLocked,
    initialContent,
    onContentChange,
  } = options

  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const editorBg = isDark ? '#111126' : '#fefefe'

  // SmartType — подсказки при наборе (базовые времена суток всегда есть)
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
  const handlePasteRef = useRef<((view: Editor['view'], event: ClipboardEvent) => boolean) | null>(null)

  // Refs для параметров, используемых внутри асинхронных таймаутов (защита от stale closures)
  const timingSystemRef = useRef(timingSystem)
  const genreCoefficientRef = useRef(genreCoefficient)
  const onScenesChangeRef = useRef(onScenesChange)
  const onStatsChangeRef = useRef(onStatsChange)
  const currentSeriesRef = useRef(currentSeries)
  const projectTypeRef = useRef(projectType)

  // Обновляем refs в useEffect во избежание мутаций во время рендера
  useEffect(() => {
    timingSystemRef.current = timingSystem
    genreCoefficientRef.current = genreCoefficient
    onScenesChangeRef.current = onScenesChange
    onStatsChangeRef.current = onStatsChange
    currentSeriesRef.current = currentSeries
    projectTypeRef.current = projectType
  }, [timingSystem, genreCoefficient, onScenesChange, onStatsChange, currentSeries, projectType])

  // Отслеживаем шапки с уже созданным переходом (избегаем дублирования)
  const processedHeadersRef = useRef<Set<string>>(new Set())
  // Флаг защиты от двойной авто-замены
  const isReplacingRef = useRef(false)
  // Таймаут сброса isReplacingRef (единый, чтобы не было утечки памяти)
  const isReplacingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Флаг: последнее нажатие клавиши было Enter — для автоопределения типа блока
  const lastKeyWasEnterRef = useRef(false)
  // Защита от цикла setContent — загружаем initialContent только при создании редактора
  const initialContentLoadedRef = useRef(false)
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

  // Получаем текущий тип блока
  const getCurrentBlockType = useCallback((ed: Editor | null) => {
    if (!ed) return 'paragraph'
    const { $from } = ed.state.selection
    const node = $from.node()
    return node?.attrs?.['data-type'] || node?.type?.name || 'paragraph'
  }, [])

  // Вспомогательная: получить текущий текстовый узел
  const getCurrentTextNode = useCallback((editorInstance: Editor) => {
    const { state } = editorInstance
    const { selection } = state
    const { $from } = selection
    let currentNode = $from.node()
    const allowedTypes = ['paragraph', 'sceneHeader', 'sceneAction', 'sceneCharacter', 'sceneDialog', 'sceneParenthetical', 'sceneTransition']
    if (currentNode && !allowedTypes.includes(currentNode.type.name)) {
      for (let i = $from.depth; i > 0; i--) {
        const node = $from.node(i)
        if (node && allowedTypes.includes(node.type.name)) {
          currentNode = node
          break
        }
      }
    }
    return currentNode
  }, [])

  // Автоопределение типа блока — ШАПКИ + ПЕРСОНАЖИ (посимвольно, с автокапсом)
  const autoDetectPerChar = useCallback((editorInstance: Editor) => {
    // Замок формата отключает автоопределение типа (но автокапс шапок всегда работает)
    const shouldDetectType = !formatLocked

    const currentNode = getCurrentTextNode(editorInstance)
    if (!currentNode) return

    const { state } = editorInstance
    const { selection } = state
    const { $from } = selection
    const textContent = currentNode.textContent.trim()
    const currentType = currentNode.type.name

    if (!textContent) return

    // --- Определение типа: шапка ---
    if (shouldDetectType) {
      const headerPattern = /^(\d+(?:-\d+)?\.\s*)?(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.|ПАВ\.|НАТ\.)/i
      if (headerPattern.test(textContent) && currentType !== 'sceneHeader') {
        editorInstance.chain().setNode('sceneHeader').run()
        return
      }
    }

    // --- Пустой paragraph → действие (для двойного Enter) ---
    if (shouldDetectType && currentType === 'paragraph' && textContent === '') {
      editorInstance.chain().setNode('sceneAction').run()
      return
    }

    // --- Определение типа: персонаж (посимвольно, В ЛЮБОМ блоке) ---
    // Если текст в КАПСЕ и похож на имя → персонаж
    if (shouldDetectType && (currentType === 'paragraph' || currentType === 'sceneAction')) {
      const isCharacterLike =
        textContent.length >= 2 &&
        textContent.length <= 25 &&
        !textContent.includes('.') &&
        !textContent.includes(',') &&
        /^[А-ЯЁA-Z\s\-']+$/.test(textContent) && // только капс + пробел/дефис/апостроф
        /[А-ЯЁA-Z]/.test(textContent) // хотя бы одна буква
      if (isCharacterLike) {
        editorInstance.chain().setNode('sceneCharacter').run()
        return
      }
    }

    // --- Определение типа: действие (посимвольно, после dialog/parenthetical) ---
    // После sceneDialog/sceneParenthetical → Enter → paragraph
    // Если текст НЕ в капсе (не имя) → это действие (sceneAction), не диалог
    if (shouldDetectType && currentType === 'paragraph') {
      const resolvedPos = state.doc.resolve($from.before())
      const prevNode = resolvedPos.nodeBefore
      const prevType = prevNode?.type.name
      if (
        prevType === 'sceneDialog' ||
        prevType === 'sceneParenthetical'
      ) {
        const isAllCaps = /^[А-ЯЁA-Z\s\-']+$/.test(textContent)
        if (!isAllCaps && textContent.length > 0) {
          editorInstance.chain().setNode('sceneAction').run()
          return
        }
      }
    }

    // --- Автокапс для шапки (всегда) ---
    if (currentType === 'sceneHeader' && !isReplacingRef.current) {
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

    // --- Автонумерация шапки (всегда) ---
    if (currentType === 'sceneHeader' && !isReplacingRef.current) {
      const upperText = textContent.toUpperCase()

      if (projectType === 'film') {
        const noNumberPattern = /^(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.|ПАВ\.)/i
        const alreadyNumbered = /^\d+\.\s*(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.|ПАВ\.)/i
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
        const needsSeriesPattern = /^(\d+)\.\s*(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.|ПАВ\.)$/i
        const alreadyHasSeriesPattern = /^\d+-\d+\.\s*(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.|ПАВ\.)$/i
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

      // Автосоздание cast после времени суток
      const timePattern = /\s(ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ)\.?$/
      if (timePattern.test(upperText)) {
        const headerKey = `${$from.start()}-${upperText}`
        if (!processedHeadersRef.current.has(headerKey)) {
          processedHeadersRef.current.add(headerKey)
          editorInstance.chain().splitBlock().setNode('sceneCast').run()
        }
      }
    }

    // --- Автокапс для персонажа (всегда) ---
    if (currentType === 'sceneCharacter' && !isReplacingRef.current) {
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
      }
    }
  }, [projectType, currentSeries, formatLocked, getCurrentTextNode])

  // Автоопределение типа блока — ОСТАЛЬНЫЕ (только после Enter)
  // Сейчас: только диалог (персонаж определяется посимвольно в autoDetectPerChar)
  const autoDetectBlockTypeAfterEnter = useCallback((editorInstance: Editor) => {
    // Замок формата отключает автоопределение
    if (formatLocked) return

    const { state } = editorInstance
    const { selection } = state
    const { $from } = selection
    const currentNode = getCurrentTextNode(editorInstance)
    if (!currentNode) return

    const currentType = currentNode.type.name
    const currentText = currentNode.textContent.trim()
    if (!currentText) return

    // Получаем предыдущий блок
    const resolvedPos = state.doc.resolve($from.before())
    const prevNode = resolvedPos.nodeBefore
    const prevType = prevNode?.type.name

    let newType: string | null = null

    // Переход: полностью заглавные спец-слова
    if (/^(РАССВЕТ|ЗАТЕМНЕНИЕ|ПЕРЕХОД|СМЕНА|CUT TO|FADE IN|FADE OUT)$/i.test(currentText)) {
      newType = 'sceneTransition'
    }
    // Ремарка: в скобках, сразу после персонажа или другой ремарки
    else if (
      /^\([^)]*\)$/.test(currentText) &&
      currentType !== 'sceneCast' &&
      (prevType === 'sceneCharacter' || prevType === 'sceneParenthetical')
    ) {
      newType = 'sceneParenthetical'
    }
    // Диалог: после персонажа, ремарки или другого диалога
    else if (currentType === 'paragraph' && (
      prevType === 'sceneCharacter' ||
      prevType === 'sceneParenthetical' ||
      prevType === 'sceneDialog'
    )) {
      newType = 'sceneDialog'
    }

    if (newType && newType !== currentType) {
      editorInstance.chain().setNode(newType).run()
    }
  }, [formatLocked, getCurrentTextNode])

  const editor = useEditor({
    enableInputRules: false,
    enablePasteRules: false,
    extensions: [
      Extension.create({
        name: 'scriptSearchPlugin',
        addProseMirrorPlugins() {
          return [createSearchPlugin()]
        },
      }),
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
      SceneParenthetical,
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
      handlePaste: (view, event) => handlePasteRef.current?.(view, event) ?? false,
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
    // Ctrl+Z / Cmd+Z — Undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      editor?.chain().undo().run()
      return true
    }
    // Ctrl+Y / Cmd+Shift+Z — Redo
    if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
      event.preventDefault()
      editor?.chain().redo().run()
      return true
    }

    const st = smartTypeRef.current
    // Только Enter выбирает подсказку — Tab переключает тип блока
    if (st.isOpen && event.key === 'Enter') {
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

          st.recordUsage(suggestion)
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
    
    // Alt+1..7 — быстрое переключение типа блока (сохраняет текст)
    const altKeyMap: Record<string, string> = {
      '1': 'sceneHeader',
      '2': 'sceneAction',
      '3': 'sceneCharacter',
      '4': 'sceneDialog',
      '5': 'sceneParenthetical',
      '6': 'sceneTransition',
      '7': 'sceneCast',
    }
    if (event.altKey && altKeyMap[event.key]) {
      event.preventDefault()
      editor?.chain().setNode(altKeyMap[event.key]).run()
      return true
    }

    // Tab — цикл переключения типов блока (сохраняет текст)
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const { state } = view
      const { selection } = state
      const { $from } = selection
      const currentNode = $from.node()
      const currentType = currentNode?.type.name

      const blockTypes = ['sceneHeader', 'sceneAction', 'sceneCharacter', 'sceneDialog', 'sceneParenthetical', 'sceneTransition']
      const idx = blockTypes.indexOf(currentType)
      if (idx !== -1) {
        event.preventDefault()
        const nextIndex = event.shiftKey
          ? (idx - 1 + blockTypes.length) % blockTypes.length
          : (idx + 1) % blockTypes.length
        editor?.chain().setNode(blockTypes[nextIndex]).run()
        return true
      }
    }
    
    if (event.key === 'Enter' && !event.shiftKey) {
      lastKeyWasEnterRef.current = true

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

      if (currentType === 'sceneParenthetical') {
        event.preventDefault()
        editor?.chain().splitBlock().setNode('sceneDialog').run()
        return true
      }

      if (currentType === 'sceneDialog') {
        event.preventDefault()
        const textContent = currentNode?.textContent?.trim() || ''
        if (textContent === '') {
          // Два Enter подряд (пустая строка) → действие
          editor?.chain().setNode('sceneAction').run()
        } else {
          // После диалога → сразу действие (для двойного Enter)
          editor?.chain().splitBlock().setNode('sceneAction').run()
        }
        return true
      }

      // Обработка Enter в sceneAction
      if (currentType === 'sceneAction') {
        const textContent = currentNode?.textContent?.trim() || ''
        if (textContent === '') {
          // Двойной Enter на пустом → новая сцена (sceneHeader)
          event.preventDefault()
          // Находим максимальный номер сцены в документе
          let maxNumber = 0
          view.state.doc.descendants((node) => {
            if (node.type.name === 'sceneHeader') {
              const headerText = node.textContent.trim()
              const match = headerText.match(/^(\d+(?:-\d+)?)\./)
              if (match) {
                const numPart = match[1]
                const sceneNum = numPart.includes('-')
                  ? parseInt(numPart.split('-')[1], 10)
                  : parseInt(numPart, 10)
                if (!isNaN(sceneNum) && sceneNum > maxNumber) {
                  maxNumber = sceneNum
                }
              }
            }
          })
          const nextNumber = maxNumber + 1
          const isSerial = projectTypeRef.current === 'serial' && currentSeriesRef.current > 0
          const headerText = isSerial
            ? `${currentSeriesRef.current}-${nextNumber}. `
            : `${nextNumber}. `

          editor?.chain()
            .splitBlock()
            .setNode('sceneHeader')
            .insertContent(headerText)
            .run()
          return true
        } else {
          // Первый Enter в sceneAction (с текстом) → paragraph, autoDetect решит
          event.preventDefault()
          editor?.chain().splitBlock().setNode('paragraph').run()
          return true
        }
      }
    }
    
    return false
  }

  // eslint-disable-next-line react-hooks/refs
  handlePasteRef.current = (_view, event) => {
    const plainText = sanitizePlainText(event.clipboardData?.getData('text/plain') || '')
    const htmlText = event.clipboardData?.getData('text/html') || ''

    // 1. Если plain text похож на сценарий → парсим в блоки
    if (plainText && isScreenplayContent(plainText)) {
      event.preventDefault()
      const blocks = parseScreenplayText(plainText)
      if (blocks.length > 0) {
        const html = blocksToHtml(blocks)
        editor?.chain().insertContent(html).run()
        return true
      }
    }

    // 2. Определяем текущий тип блока
    const currentType = editor ? getCurrentBlockType(editor) : null

    // 3. Для sceneHeader / sceneCharacter / sceneDialog → только plain text без форматирования
    if (currentType === 'sceneHeader' || currentType === 'sceneCharacter' || currentType === 'sceneDialog' || currentType === 'sceneTransition') {
      if (plainText) {
        event.preventDefault()
        editor?.chain().insertContent(plainText).run()
        return true
      }
      return false
    }

    // 4. Для sceneAction / sceneParenthetical → sanitize HTML если есть, иначе plain text
    if (htmlText && htmlText.length > 0 && !htmlText.includes('<html>')) {
      // Вероятно, это HTML из Word — sanitize
      event.preventDefault()
      const cleanHtml = sanitizeHtml(htmlText)
      editor?.chain().insertContent(cleanHtml).run()
      return true
    }

    // 5. Fallback: если есть plain text → вставляем его (уже sanitized)
    if (plainText && plainText.length > 0) {
      event.preventDefault()
      editor?.chain().insertContent(plainText).run()
      return true
    }

    return false
  }

  // eslint-disable-next-line react-hooks/refs
  onUpdateRef.current = ({ editor: editorInstance }) => {
    const html = editorInstance.getHTML()

    onContentChange?.(html)

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
      applyPageBreaks()
      pageCountTimeoutRef.current = null
    }, 400)

    autoDetectPerChar(editorInstance)

    // Определение типа блока для персонажей/диалога/ремарки/перехода — только после Enter
    if (lastKeyWasEnterRef.current) {
      lastKeyWasEnterRef.current = false
      autoDetectBlockTypeAfterEnter(editorInstance)
    }
    
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

  // Загружаем контент только при создании редактора / смене скрипта
  useEffect(() => {
    if (!editor || initialContentLoadedRef.current) return
    if (initialContent) {
      editor.commands.setContent(initialContent)
    }
    processedHeadersRef.current.clear()
    initialContentLoadedRef.current = true
  }, [editor, initialContent])

  // 4.1 Конвертация формата RU↔EN — передаём функцию в ScriptPage через onConvertReady
  useEffect(() => {
    if (!editor || !onConvertReady) return

    const convertFormat = (from: ScriptFormat, to: ScriptFormat) => {
      if (from === to) return

      // Словари замен: применяются только внутри sceneHeader
      const replacements: [RegExp, string][] =
        from === 'russian' && to === 'hollywood'
          ? [
              [/ИНТ-ЭКСТ\./gi, 'INT/EXT.'],
              [/ИНТ\./gi, 'INT.'],
              [/ЭКСТ\./gi, 'EXT.'],
              [/ПАВ\./gi, 'PAV.'],
              [/—/g, '-'],
              [/\bДЕНЬ\b/gi, 'DAY'],
              [/\bНОЧЬ\b/gi, 'NIGHT'],
              [/\bУТРО\b/gi, 'MORNING'],
              [/\bВЕЧЕР\b/gi, 'EVENING'],
              [/\bРАССВЕТ\b/gi, 'DAWN'],
              [/\bЗАКАТ\b/gi, 'DUSK'],
            ]
          : [
              [/INT\/EXT\./gi, 'ИНТ-ЭКСТ.'],
              [/INT\./gi, 'ИНТ.'],
              [/EXT\./gi, 'ЭКСТ.'],
              [/PAV\./gi, 'ПАВ.'],
              [/ - /g, ' — '],
              [/\bDAY\b/gi, 'ДЕНЬ'],
              [/\bNIGHT\b/gi, 'НОЧЬ'],
              [/\bMORNING\b/gi, 'УТРО'],
              [/\bEVENING\b/gi, 'ВЕЧЕР'],
              [/\bDAWN\b/gi, 'РАССВЕТ'],
              [/\bDUSK\b/gi, 'ЗАКАТ'],
            ]

      const tr = editor.state.tr
      const changes: Array<{ from: number; to: number; text: string }> = []

      // Собираем изменения внутри sceneHeader (descendants даёт pos перед узлом)
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeader') {
          let text = node.textContent
          let changed = false

          for (const [regex, replacement] of replacements) {
            if (regex.test(text)) {
              text = text.replace(regex, replacement)
              changed = true
            }
          }

          if (changed && text !== node.textContent) {
            // Содержимое узла: от pos+1 (после открывающего) до pos+node.nodeSize-1 (перед закрывающим)
            const contentFrom = pos + 1
            const contentTo = pos + node.nodeSize - 1
            changes.push({ from: contentFrom, to: contentTo, text })
          }
        }
      })

      // Применяем в обратном порядке (с конца к началу), чтобы позиции не смещались
      changes.sort((a, b) => b.from - a.from).forEach(({ from, to, text }) => {
        tr.delete(from, to)
        tr.insertText(text, from)
      })

      if (tr.docChanged) {
        editor.view.dispatch(tr)
        processedHeadersRef.current.clear()
      }
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
