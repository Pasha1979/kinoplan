import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DragHandle from '@tiptap/extension-drag-handle'
import { useEffect, useCallback, useRef, useState } from 'react'
import { DOMSerializer, Node as PMNode } from 'prosemirror-model'
import type { ScriptFormat, TimingSystem } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneNode } from './tiptap'
import { Film, AlignLeft, User, Users, MessageSquare, ArrowRight } from 'lucide-react'
import { useSmartType } from '../hooks/useSmartType'
import { safeGetLocalStorage, safeSetLocalStorage } from '../utils/env'
import { SmartTypePopup } from './SmartTypePopup'
import { PageCounter } from '../services/pageCounter'
import { extractScenesFromDocument } from '../utils/sceneExtractor'
import { convertToWordCompatibleHtml } from '../utils/wordExport'
import { useSceneEditorActions } from '../hooks/useSceneEditorActions'

interface ScriptEditorTiptapProps {
  // format is optional - currently not used but kept for future compatibility
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
  // SmartType данные (вместо hardcoded)
  smartTypeCharacters?: string[]
  smartTypeLocations?: string[]
  smartTypeTimes?: string[]
}

export default function ScriptEditorTiptap({
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
}: ScriptEditorTiptapProps) {
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const editorBg = isDark ? '#111126' : '#fefefe'

  // SmartType — подсказки при наборе (с дефолтами если пропсы не переданы)
  const smartType = useSmartType({
    characters: smartTypeCharacters || ['ПЕТЯ', 'МАША', 'ВАСЯ', 'ОЛЯ', 'ДИМА'],
    locations: smartTypeLocations || ['КВАРТИРА', 'ПАРК', 'ОФИС', 'УЛИЦА', 'КАФЕ'],
    times: smartTypeTimes || ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ'],
  })
  // Ref-обёртка для SmartType чтобы не менять зависимости useEffect/useEditor
  const smartTypeRef = useRef(smartType)
  // eslint-disable-next-line react-hooks/refs
  smartTypeRef.current = smartType

  // Refs для динамических callback'ов useEditor (предотвращаем stale closures)
  const onUpdateRef = useRef<(({ editor }: { editor: Editor }) => void) | null>(null)
  const handleKeyDownRef = useRef<((view: Editor['view'], event: KeyboardEvent) => boolean) | null>(null)
  const handleCopyRef = useRef<((view: Editor['view'], event: ClipboardEvent) => boolean) | null>(null)

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
  // При "Все серии" (currentSeries === 0) загружаем первую серию, чтобы не было пустого экрана
  const draftKey = projectId
    ? (projectType === 'serial'
        ? `kinoplan_draft_${projectId}_s${currentSeries > 0 ? currentSeries : 1}`
        : `kinoplan_draft_${projectId}`)
    : 'kinoplan_tiptap_draft'

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

  // Автоопределение типа блока по тексту (Фаза 2.5)
  const autoDetectBlockType = (editor: Editor) => {
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    
    // Получаем текущий блок — ищем paragraph или наш кастомный блок
    let currentNode = $from.node()
    
    // Если это не блоковый уровень, ищем родителя
    if (currentNode && !['paragraph', 'sceneHeader', 'sceneAction', 'sceneCharacter', 'sceneDialog', 'sceneTransition'].includes(currentNode.type.name)) {
      // Ищем родительский блок
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
    
    // Если блок пустой — не меняем
    if (!textContent) return
    
    let newType: string | null = null
    
    // 1. Шапка сцены: только ИНТ. / ЭКСТ. / ИНТ-ЭКСТ. (полные формы)
    // Требуем: ИНТ/ЭКСТ/ИНТ-ЭКСТ с точкой — "ИНТ." обязательно с точкой!
    const headerPattern = /^(\d+(?:-\d+)?\.\s*)?(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.)/i
    if (headerPattern.test(textContent)) {
      newType = 'sceneHeader'
    }
    // 2. Список персонажей в сцене (через запятую): "ВЛАДА, СВЕТА, РЯБИНИНА, ХАН"
    // Работает после header или когда уже в cast (для продолжения ввода)
    else if (
      (currentType === 'sceneHeader' || currentType === 'sceneCast') && 
      /^[А-ЯЁA-Z\s,]+$/.test(textContent) && 
      textContent.includes(',')
    ) {
      newType = 'sceneCast'
    }
    // 3. Переходы: РАССВЕТ, ЗАТЕМНЕНИЕ, ПЕРЕХОД, СМЕНА
    else if (/^(РАССВЕТ|ЗАТЕМНЕНИЕ|ПЕРЕХОД|СМЕНА|CUT TO|FADE IN|FADE OUT)$/i.test(textContent)) {
      newType = 'sceneTransition'
    }
    // 4. Персонаж: капслок, 2-25 символов
    // Поддерживаем русский и английский капслок
    // НЕ срабатывает если уже в sceneCast (чтобы список персонажей не превращался в имя)
    else if (
      currentType !== 'sceneCast' && // Защита: не меняем cast на character
      textContent.length >= 2 && 
      textContent.length <= 25 &&
      !textContent.includes('.') && // Без точек
      !textContent.includes(',') && // Без запятых (это cast list)
      textContent === textContent.toUpperCase() && // Точно капслок
      /^[А-ЯЁA-Z\s\-']+$/.test(textContent) && // Только буквы, пробелы, дефисы
      /[А-ЯЁA-Z]/.test(textContent) // Хотя бы одна буква
    ) {
      newType = 'sceneCharacter'
    }
    // 5. Диалог: если после персонажа (проверяем предыдущий блок)
    else if (currentType === 'paragraph' || currentType === 'sceneAction') {
      // Проверяем предыдущий блок
      const resolvedPos = state.doc.resolve($from.before())
      const prevNode = resolvedPos.nodeBefore
      if (prevNode?.type.name === 'sceneCharacter') {
        newType = 'sceneDialog'
      }
    }
    
    // Если определили новый тип и он отличается от текущего — меняем и выходим.
    // Следующий onUpdate обработает uppercase/нумерацию со свежими позициями.
    if (newType && newType !== currentType) {
      editor.chain().setNode(newType).run()
      return
    }

    const isHeader = currentType === 'sceneHeader'
    const isCharacter = currentType === 'sceneCharacter'
    
    // 1.2 Капслок: реальный текст в шапке и имени персонажа
    if ((isHeader || isCharacter) && !isReplacingRef.current) {
      const upperText = textContent.toUpperCase()
      if (upperText !== textContent) {
        const cursorOffset = selection.from - $from.start()
        isReplacingRef.current = true
        const nodeStart = $from.start()
        const nodeEnd = $from.end()
        editor
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

    // Авто-нумерация (только когда блок sceneHeader)
    if (isHeader && !isReplacingRef.current) {
      const upperText = textContent.toUpperCase()

      // 1.3 Авто-нумерация для ФИЛЬМА: "ИНТ." → "1. ИНТ."
      if (projectType === 'film') {
        const noNumberPattern = /^(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.)/i
        const alreadyNumbered = /^\d+\.\s*(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.)/i
        if (noNumberPattern.test(upperText) && !alreadyNumbered.test(upperText)) {
          // Считаем только уже пронумерованные заголовки (не текущий, который ещё без номера)
          let sceneCount = 0
          editor.state.doc.descendants((n: PMNode) => {
            if (n.type.name === 'sceneHeader') {
              const t = n.textContent.trim()
              if (/^\d+\./.test(t)) sceneCount++
            }
          })
          const newText = `${sceneCount + 1}. ${upperText}`
          isReplacingRef.current = true
          const nodeStart = $from.start()
          const nodeEnd = $from.end()
          editor
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

      // Авто-нумерация для СЕРИАЛА: "1. ИНТ." → "1-1. ИНТ."
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
          editor
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
      
      // Если время закончилось — переходим на новую строку (только один раз)
      // Точка после времени НЕ требуется: "1. ИНТ. КВАРТИРА — ДЕНЬ" (без точки)
      const timePattern = /\s(ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ)\.?$/
      if (timePattern.test(upperText)) {
        // Используем позицию начала ноды (фиксированная) вместо $from.pos (меняется при наборе)
        const headerKey = `${$from.start()}-${upperText}`
        if (!processedHeadersRef.current.has(headerKey)) {
          processedHeadersRef.current.add(headerKey)
          editor.chain().splitBlock().setNode('sceneCast').run()
        }
      }
    }
  }

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
  onUpdateRef.current = ({ editor }) => {
    const html = editor.getHTML()

    safeSetLocalStorage(draftKey, html)

    if (pageCountTimeoutRef.current) {
      clearTimeout(pageCountTimeoutRef.current)
    }
    pageCountTimeoutRef.current = setTimeout(() => {
      const result = pageCounterRef.current!.calculatePagesWithBreaks(html, (_format as 'russian' | 'hollywood') || 'russian')
      setPrecisePages(result.totalPages)
      precisePagesRef.current = result.totalPages
      if (editor) {
        const { scenes: extractedScenes, stats } = extractScenesFromDocument({
          doc: editor.state.doc,
          forcedPages: result.totalPages,
          precisePagesFallback: precisePagesRef.current,
          timingSystem,
          genreCoefficient,
        })
        onScenesChange?.(extractedScenes)
        onStatsChange?.(stats)
      }

      // Сохраняем breaks (применение отключено)
      pageBreaksRef.current = result.breaks
      // applyPageBreaks() // DISABLED — визуальные разрывы страниц убраны

      pageCountTimeoutRef.current = null
    }, 400)

    autoDetectBlockType(editor)
    
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    const currentType = getCurrentBlockType(editor)
    
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
      // При смене серии — очищаем редактор и загружаем нужный черновик (или пустой)
      editor.commands.setContent(saved || '<p></p>')
      processedHeadersRef.current.clear()
      // Page breaks применение отключено
      // setTimeout(() => {
      //   const html = editor.getHTML()
      //   const result = pageCounterRef.current!.calculatePagesWithBreaks(html, (_formatRef.current as 'russian' | 'hollywood') || 'russian')
      //   pageBreaksRef.current = result.breaks
      //   applyPageBreaks()
      // }, 0)
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

  // Функция для установки типа блока (вызов ДО conditional return чтобы соблюсти Rules of Hooks)
  const setBlockType = useCallback((type: string) => {
    if (!editor) return

    // Преобразуем текущий блок в нужный тип
    editor.chain()
      .focus()
      .setNode(type)
      .run()
  }, [editor])

  if (!editor) {
    return null
  }

  // Получаем текущий тип блока
  const getCurrentBlockType = (ed: Editor) => {
    if (!ed) return 'paragraph'
    const { $from } = ed.state.selection
    const node = $from.node()
    return node?.attrs?.['data-type'] || node?.type?.name || 'paragraph'
  }

  const currentType = getCurrentBlockType(editor)

  const blockTypes = [
    { name: 'sceneHeader', label: 'Шапка', icon: Film, color: '#6366f1' },
    { name: 'sceneCast', label: 'Действующие', icon: Users, color: '#8b5cf6' },
    { name: 'sceneAction', label: 'Действие', icon: AlignLeft, color: '#9ca3af' },
    { name: 'sceneCharacter', label: 'Персонаж', icon: User, color: '#f97316' },
    { name: 'sceneDialog', label: 'Диалог', icon: MessageSquare, color: '#22c55e' },
    { name: 'sceneTransition', label: 'Переход', icon: ArrowRight, color: '#ec4899' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative h-full">
      {/* Панель инструментов */}
      <div
        className="shrink-0 flex items-center gap-2 px-4 py-2 border-b"
        style={{
          background: isDark ? '#1a1a2e' : '#f8f9fc',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
        }}
      >
        <span className="text-xs mr-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          Тип блока:
        </span>
        {blockTypes.map((type) => {
          const Icon = type.icon
          const isActive = currentType === type.name
          return (
            <button
              key={type.name}
              onClick={() => setBlockType(type.name)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
              style={{
                background: isActive ? type.color : 'transparent',
                color: isActive ? '#fff' : isDark ? '#9ca3af' : '#6b7280',
                border: `1px solid ${isActive ? type.color : isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
              }}
            >
              <Icon size={12} />
              {type.label}
            </button>
          )
        })}
      </div>

      {/* Область редактора */}
      <div
        className="flex-1 overflow-y-auto py-8 px-4"
        style={{
          background: editorBg,
          color: textPrimary,
        }}
      >
        {/* Контейнер страницы A4 — фиксированная ширина для правильного форматирования */}
        <div
          className="mx-auto"
          style={{
            width: '210mm', // Стандарт A4
            minHeight: '297mm',
            background: isDark ? '#1a1a2e' : '#ffffff',
            boxShadow: isDark
              ? '0 4px 20px rgba(0,0,0,0.5)'
              : '0 4px 20px rgba(0,0,0,0.1)',
            padding: '2cm 2cm 2cm 3cm', // Поля: верх/низ 2cm, левое 3cm, правое 2cm (стандарт для сценариев)
          }}
        >
          <EditorContent
            editor={editor}
            className={`h-full tiptap-editor format-${_format || 'russian'}`}
            style={{
              fontFamily,
              fontSize: `${fontSize}pt`,
              lineHeight: '1.5',
            }}
          />
        </div>
      </div>

      {/* Статусбар */}
      <div
        className="shrink-0 flex items-center gap-6 px-6 py-2 border-t text-xs"
        style={{
          background: isDark ? '#1a1a2e' : '#f8f9fc',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
        }}
      >
        <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {editor.getText().length} симв.
        </span>
        <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {precisePages.toFixed(1)} стр.
        </span>
      </div>

      {/* SmartType Popup */}
      <SmartTypePopup
        editor={editor}
        suggestions={smartType.suggestions}
        activeIndex={smartType.activeIndex}
        isOpen={smartType.isOpen}
        isDark={isDark}
        onSelect={(suggestion) => {
          if (!editor) return
          
          const { state } = editor
          const { selection } = state
          const { $from } = selection
          
          // Получаем текст текущей ноды и позицию внутри неё
          const currentNode = $from.node()
          const nodeText = currentNode?.textContent || ''
          const nodeStartPos = $from.start()
          const posInNode = selection.from - nodeStartPos
          
          // Получаем текущее слово
          const beforeCursor = nodeText.substring(0, posInNode)
          const match = beforeCursor.match(/[^\s]*$/)
          const currentWord = match ? match[0] : ''
          
          if (!currentWord) return
          
          // Вычисляем позиции для удаления
          const wordStartPos = selection.from - currentWord.length
          const wordEndPos = selection.from
          
          // Для времени автоматически добавляем точку
          const textToInsert = suggestion.type === 'time' 
            ? suggestion.text + '.' 
            : suggestion.text
          
          // Удаляем текущее слово и вставляем подсказку
          editor
            .chain()
            .focus()
            .deleteRange({ from: wordStartPos, to: wordEndPos })
            .insertContent(textToInsert)
            .run()
          
          smartType.closeSuggestions()
        }}
        onClose={smartType.closeSuggestions}
        onNavigate={smartType.navigateSuggestions}
      />
    </div>
  )
}
