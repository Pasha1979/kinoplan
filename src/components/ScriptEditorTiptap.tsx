import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DragHandle from '@tiptap/extension-drag-handle'
import { useEffect, useCallback, useRef, useState } from 'react'
import { DOMSerializer } from 'prosemirror-model'
import type { ScriptFormat, TimingSystem } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneNode } from './tiptap'
import { Film, AlignLeft, User, Users, MessageSquare, ArrowRight } from 'lucide-react'
import { useSmartType } from '../hooks/useSmartType'
import { safeGetLocalStorage, safeSetLocalStorage } from '../utils/env'
import { SmartTypePopup } from './SmartTypePopup'
import { PageCounter } from '../services/pageCounter'
import { SCRIPT_STYLES } from '../constants/scriptStyles'
import { calculateSceneTiming } from '../utils/sceneTiming'

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

// Добавляем inline-стили к div[data-type] для Word-совместимости.
// НЕ заменяем div на p — pageCounter тоже оставляет div, унификация рендеринга.
function convertToWordCompatibleHtml(html: string, _editorDom: HTMLElement, format: 'russian' | 'hollywood' = 'russian'): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const convert = (element: HTMLElement) => {
    const dataType = element.getAttribute('data-type')
    if (dataType && SCRIPT_STYLES[dataType]) {
      const current = element.getAttribute('style') || ''
      const newStyles = SCRIPT_STYLES[dataType][format]
      element.setAttribute('style', current + (current ? '; ' : '') + newStyles)
    }
    Array.from(element.children).forEach(child => {
      if (child instanceof HTMLElement) convert(child)
    })
  }

  Array.from(doc.body.children).forEach(child => {
    if (child instanceof HTMLElement) convert(child)
  })

  const wrapper = document.createElement('div')
  wrapper.innerHTML = doc.body.innerHTML
  wrapper.setAttribute('style',
    'font-family: "Courier New", Courier, monospace; ' +
    'font-size: 12pt; ' +
    'line-height: 1.5; ' +
    'max-width: 21cm; ' +
    'margin: 0 auto;'
  )

  return wrapper.outerHTML
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
  smartTypeRef.current = smartType

  // Refs для динамических callback'ов useEditor (предотвращаем stale closures)
  const onUpdateRef = useRef<(({ editor }: { editor: any }) => void) | null>(null)
  const handleKeyDownRef = useRef<((view: any, event: KeyboardEvent) => boolean) | null>(null)
  const handleCopyRef = useRef<((view: any, event: ClipboardEvent) => boolean) | null>(null)

  // Отслеживаем шапки с уже созданным переходом (избегаем дублирования)
  const processedHeadersRef = useRef<Set<string>>(new Set())
  // Флаг защиты от двойной авто-замены
  const isReplacingRef = useRef(false)
  // Таймаут сброса isReplacingRef (единый, чтобы не было утечки памяти)
  const isReplacingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Точное количество страниц (через виртуальный A4-рендеринг)
  const [precisePages, setPrecisePages] = useState<number>(0.1)
  // Дебаунс для подсчёта страниц (не считать на каждый символ)
  const pageCountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Сохраняем page breaks для повторного применения после ProseMirror рендера
  const pageBreaksRef = useRef<{ page: number; startIndex: number }[]>([])
  // Per-component PageCounter instance (убран singleton)
  const pageCounterRef = useRef<PageCounter | null>(null)
  if (!pageCounterRef.current) {
    pageCounterRef.current = new PageCounter()
  }

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

  // 2.2 Извлечение сцен напрямую из sceneHeader (без SceneNode)
  // 2.1 Исправлен баг: locationPart = headerMatch[3] (не [2])
  const extractScenesFromDocument = (forcedPages?: number) => {
    if (!editor) return

    type SceneEntry = { id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number; duration: number; charCount: number }

    // Собираем только блоки верхнего уровня документа (не inline-узлы)
    const blockNodes: any[] = []
    editor.state.doc.forEach((node: any) => {
      blockNodes.push(node)
    })

    // === ПРОХОД 1: собираем raw-сцены с charCount и dialogLines ===
    const rawScenes: Array<{
      sceneNumber: string
      sceneType: string
      location: string
      time: string
      cast: string[]
      charCount: number
      dialogLines: number
    }> = []

    blockNodes.forEach((node, index) => {
      if (node.type.name !== 'sceneHeader') return

      const headerText = node.textContent.trim()

      // Паттерн: "1-1. ИНТ. КВАРТИРА — ДЕНЬ" или "1. ЭКСТ. УЛИЦА — НОЧЬ" или "1. ИНТ. КВАРТИРА ПЕТИ. ДЕНЬ."
      const headerMatch = headerText.match(/^(\d+(?:-\d+)?)\.\s*(ИНТ-ЭКСТ\.?|ИНТ\.?|ЭКСТ\.?)\s+(.+)$/i)
      if (!headerMatch) return

      const sceneNumber = headerMatch[1]
      const rawType = headerMatch[2].toUpperCase()
      const locationAndTime = headerMatch[3]

      const sceneType = rawType.startsWith('ИНТ-') ? 'ИНТ-ЭКСТ' : rawType.startsWith('Э') ? 'ЭКСТ' : 'ИНТ'

      // Варианты времени суток
      const timeWords = ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ']

      // Вариант 1: разделитель — тире/—
      // Вариант 2: время в конце строки через точку (КВАРТИРА ПЕТИ. ДЕНЬ.)
      let location = ''
      let time = ''

      const dashParts = locationAndTime.split(/\s*[—–]\s*/)
      if (dashParts.length >= 2) {
        location = dashParts[0].trim().replace(/\.$/, '')
        time = dashParts[dashParts.length - 1].trim().replace(/\.$/, '')
      } else {
        // Ищем время суток в конце строки
        const timePattern = new RegExp(`[.\\s](${timeWords.join('|')})\\.?$`, 'i')
        const timeMatch = locationAndTime.match(timePattern)
        if (timeMatch) {
          time = timeMatch[1].toUpperCase()
          location = locationAndTime.slice(0, locationAndTime.lastIndexOf(timeMatch[0])).trim().replace(/\.$/, '')
        } else {
          location = locationAndTime.trim().replace(/\.$/, '')
          time = ''
        }
      }

      // Ищем cast: следующий БЛОК после sceneHeader должен быть sceneCast
      let cast: string[] = []
      const nextBlock = blockNodes[index + 1]
      if (nextBlock?.type.name === 'sceneCast') {
        const castText = nextBlock.textContent.trim()
        if (castText) {
          cast = castText.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
        }
      }

      // Считаем символы до следующей sceneHeader
      let charCount = headerText.length
      let dialogLines = 0
      for (let i = index + 1; i < blockNodes.length; i++) {
        const n = blockNodes[i]
        if (n.type.name === 'sceneHeader') break
        charCount += n.textContent.length
        if (n.type.name === 'sceneDialog') {
          dialogLines++
        }
      }

      rawScenes.push({ sceneNumber, sceneType, location, time, cast, charCount, dialogLines })
    })

    // === ПРОХОД 2: распределяем точное кол-во страниц по сценам ===
    const totalCharCount = rawScenes.reduce((sum, s) => sum + s.charCount, 0)
    // forcedPages — свежепосчитанное значение от PageCounter (передаётся из setTimeout).
    // precisePages — state (может быть stale в замыкании setTimeout).
    const effectivePages = forcedPages ?? precisePages
    const hasPrecisePages = effectivePages > 0.1

    const scenes: SceneEntry[] = rawScenes.map((raw) => {
      // Распределяем precisePages пропорционально charCount каждой сцены.
      // Если precisePages ещё не рассчитан (первый рендер) — fallback на charCount/1800.
      const pages = hasPrecisePages && totalCharCount > 0
        ? Math.max(0.1, parseFloat(((raw.charCount / totalCharCount) * effectivePages).toFixed(1)))
        : Math.max(0.1, parseFloat((raw.charCount / 1800).toFixed(1)))

      // Расчитываем хронометраж от уже точного кол-ва страниц
      const { duration } = calculateSceneTiming({ pages, charCount: raw.charCount, dialogLines: raw.dialogLines }, timingSystem, genreCoefficient)

      return {
        id: `scene-${raw.sceneNumber}`,
        number: raw.sceneNumber,
        type: raw.sceneType,
        location: raw.location,
        time: raw.time,
        cast: raw.cast,
        pages,
        duration,
        charCount: raw.charCount,
      }
    })

    if (onScenesChange) {
      onScenesChange(scenes)
    }
    if (onStatsChange) {
      // Используем точный подсчёт страниц через виртуальный A4-рендеринг
      const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0)
      onStatsChange({
        scenes: scenes.length,
        pages: effectivePages,
        duration: totalDuration,
      })
    }
  }

  // Применяем page-start классы к DOM редактора (RAF — чтобы ProseMirror уже отрисовал)
  const applyPageBreaks = useCallback(() => {
    if (!editor || pageBreaksRef.current.length <= 1) return
    requestAnimationFrame(() => {
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
    })
  }, [editor])

  // Автоопределение типа блока по тексту (Фаза 2.5)
  const autoDetectBlockType = (editor: any) => {
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
          editor.state.doc.descendants((n: any) => {
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
  handleCopyRef.current = (view, event) => {
    const { state } = view
    const { selection } = state
    if (selection.empty) return false

    const div = document.createElement('div')
    const serializer = DOMSerializer.fromSchema(state.schema)
    div.appendChild(serializer.serializeFragment(selection.content().content))

    const html = convertToWordCompatibleHtml(div.innerHTML, view.dom, (_format as 'russian' | 'hollywood') || 'russian')

    event.clipboardData?.setData('text/html', html)
    event.clipboardData?.setData('text/plain', div.textContent || '')
    event.preventDefault()
    return true
  }

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

  onUpdateRef.current = ({ editor }) => {
    const html = editor.getHTML()

    safeSetLocalStorage(draftKey, html)

    if (pageCountTimeoutRef.current) {
      clearTimeout(pageCountTimeoutRef.current)
    }
    pageCountTimeoutRef.current = setTimeout(() => {
      const result = pageCounterRef.current!.calculatePagesWithBreaks(html, (_format as 'russian' | 'hollywood') || 'russian')
      setPrecisePages(result.totalPages)
      extractScenesFromDocument(result.totalPages)

      // Сохраняем breaks для повторного применения после ProseMirror рендера
      pageBreaksRef.current = result.breaks
      applyPageBreaks()

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
    const handler = ({ editor: ed }: { editor: any }) => onUpdateRef.current?.({ editor: ed })
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
      // Пересчитываем page breaks после загрузки контента (RAF ждём рендер ProseMirror)
      requestAnimationFrame(() => {
        const html = editor.getHTML()
        const result = pageCounterRef.current!.calculatePagesWithBreaks(html, (_format as 'russian' | 'hollywood') || 'russian')
        pageBreaksRef.current = result.breaks
        applyPageBreaks()
      })
    }
  }, [editor, draftKey])

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

  // 3.2 Прокрутка редактора к сцене по focusSceneId
  useEffect(() => {
    if (!editor || !focusSceneId) return
    let found = false
    let scrollPos: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    editor.state.doc.descendants((node, pos) => {
      if (found) return false
      if (node.type.name === 'sceneHeader') {
        const headerText = node.textContent
        const headerMatch = headerText.match(/^(\d+(?:-\d+)?)\./)
        if (headerMatch) {
          const sceneNum = headerMatch[1]
          // Точное совпадение номера сцены
          if (focusSceneId === sceneNum) {
            found = true
            scrollPos = pos
            const domNode = editor.view.nodeDOM(pos) as HTMLElement | null
            if (domNode) {
              domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        }
      }
    })

    // Повторяем скролл с задержкой чтобы гарантировать позицию
    if (scrollPos !== null) {
      timeoutId = setTimeout(() => {
        const domNode = editor.view.nodeDOM(scrollPos) as HTMLElement | null
        if (domNode) {
          domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 500)
    }

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [focusSceneId, editor])

  // 3.3 Перестановка сцен в редакторе при изменении порядка в навигаторе
  useEffect(() => {
    if (!editor || !onReorderReady) return

    // Функция перестановки сцен
    const handleReorder = (fromIndex: number, toIndex: number) => {
      if (!editor) return

      // Валидация индексов
      if (fromIndex < 0 || toIndex < 0) return
      if (fromIndex === toIndex) return

      // Получаем текущий документ как JSON
      const doc = editor.getJSON()
      const content = doc.content || []

      if (content.length === 0) return

      // Находим все sceneHeader в JSON
      const sceneIndices: number[] = []
      content.forEach((node: any, index: number) => {
        if (node.type === 'sceneHeader') {
          sceneIndices.push(index)
        }
      })

      if (sceneIndices.length === 0) return
      if (fromIndex >= sceneIndices.length || toIndex >= sceneIndices.length) return

      // Определяем границы сцен для перестановки
      const fromStart = sceneIndices[fromIndex]
      const toStart = sceneIndices[toIndex]

      const findSceneEnd = (startIndex: number) => {
        for (let i = startIndex + 1; i < content.length; i++) {
          if (content[i].type === 'sceneHeader') {
            return i
          }
        }
        return content.length
      }

      const fromEnd = findSceneEnd(fromStart)
      const toEnd = findSceneEnd(toStart)

      // Вырезаем сцену из старой позиции
      const sceneNodes = content.slice(fromStart, fromEnd)

      // Создаем новый массив с переставленной сценой
      const newContent = [...content]

      // Удаляем сцену из старой позиции
      newContent.splice(fromStart, fromEnd - fromStart)

      // Вычисляем новую позицию для вставки
      const newInsertPos = fromIndex < toIndex
        ? toEnd - (fromEnd - fromStart)
        : toStart

      // Вставляем сцену в новую позицию
      newContent.splice(newInsertPos, 0, ...sceneNodes)

      // Устанавливаем новый документ
      editor.commands.setContent({ type: 'doc', content: newContent })

      // Принудительно извлекаем сцены для обновления навигатора с новыми номерами
      setTimeout(() => {
        extractScenesFromDocument()
      }, 100)
    }

    // Передаем функцию родителю
    onReorderReady(handleReorder)
  }, [editor, onReorderReady])

  // Экспортируем функцию обновления номеров
  useEffect(() => {
    if (!editor || !onUpdateNumbersReady) return
    onUpdateNumbersReady(updateSceneNumbers)
  }, [editor, onUpdateNumbersReady])

  // Функция для обновления номеров в редакторе на основе массива сцен из навигатора
  const updateSceneNumbers = (scenes: Array<{ id: string; number: string }>) => {
    if (!editor) return
    if (!scenes || scenes.length === 0) return

    const doc = editor.getJSON()
    const content = doc.content || []

    if (content.length === 0) return

    let sceneIndex = 0

    // Создаем новый контент с обновлёнными номерами (без мутации)
    const newContent = content.map((node: any) => {
      if (node.type === 'sceneHeader' && node.content && node.content[0] && sceneIndex < scenes.length) {
        const text = node.content[0].text || ''
        const headerMatch = text.match(/^(\d+(?:-\d+)?)\./)

        if (headerMatch) {
          const oldNumber = headerMatch[1]
          const newNumber = scenes[sceneIndex].number

          // Важно: увеличиваем индекс для КАЖДОЙ сцены, независимо от изменения номера
          sceneIndex++

          if (oldNumber !== newNumber) {
            // Создаем новый узел с обновлённым текстом
            return {
              ...node,
              content: [
                {
                  ...node.content[0],
                  text: text.replace(/^(\d+(?:-\d+)?)\./, `${newNumber}.`)
                },
                ...node.content.slice(1)
              ]
            }
          }
        }
      }

      return node
    })

    // Устанавливаем обновленный документ
    editor.commands.setContent({ type: 'doc', content: newContent })
  }

  if (!editor) {
    return null
  }

  // Функция для установки типа блока
  const setBlockType = useCallback((type: string) => {
    if (!editor) return
    
    // Преобразуем текущий блок в нужный тип
    editor.chain()
      .focus()
      .setNode(type)
      .run()
  }, [editor])

  // Получаем текущий тип блока
  const getCurrentBlockType = (ed: any) => {
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
