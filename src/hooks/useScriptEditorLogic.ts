import { useEditor, type Editor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DragHandle from '@tiptap/extension-drag-handle'
import { useEffect, useCallback, useRef, useState } from 'react'
import { DOMSerializer, Node as PMNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { ScriptFormat, TimingSystem } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneNode, SceneParenthetical } from '../components/tiptap'
import { DialogueHighlightExtension, pluginKey as dialogueHighlightPluginKey } from '../components/tiptap/DialogueHighlightExtension'
import { PovFilterExtension, pluginKey as povFilterPluginKey } from '../components/tiptap/PovFilterExtension'
import { useSmartType } from './useSmartType'
import { useScriptStore } from '../store/scriptStore'
// localStorage больше не используется — контент хранится в scriptStore
import { PageCounter } from '../services/pageCounter'
import { A4_HEIGHT_MM, PAGE_MARGIN_TOP_BOTTOM_MM } from '../constants/scriptConstants'
import { extractScenesFromDocument } from '../utils/sceneExtractor'
import { convertToWordCompatibleHtml } from '../utils/wordExport'
import { useSceneEditorActions } from './useSceneEditorActions'
import { parseScreenplayText, blocksToHtml } from '../utils/parseScreenplayText'
import { sanitizeHtml, sanitizePlainText, isScreenplayContent } from '../utils/pasteSanitizer'
import { createSearchPlugin } from './useScriptSearch'
import { useMultiCursor } from './useMultiCursor'

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
  onFormatReady?: (formatFn: () => string) => void
  smartTypeCharacters?: string[]
  smartTypeLocations?: string[]
  smartTypeTimes?: string[]
  formatLocked?: boolean
  autoExtractCharacters?: boolean
  initialContent?: string
  onContentChange?: (html: string) => void
  dialogueCharacter?: string | null
  povCharacter?: string | null
}

// Единая функция для определения следующего номера сцены
// Всегда ищет МАКСИМАЛЬНЫЙ номер (не количество), чтобы избежать дубликатов
// при удалении сцен из середины
function getNextSceneNumber(doc: PMNode): number {
  let maxNumber = 0
  doc.descendants((node) => {
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
  return maxNumber + 1
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
    onFormatReady,
    genreCoefficient,
    timingSystem,
    smartTypeCharacters,
    smartTypeLocations,
    smartTypeTimes,
    formatLocked,
    autoExtractCharacters,
    initialContent,
    onContentChange,
    dialogueCharacter,
    povCharacter,
  } = options

  const showPlaceholders = useScriptStore((s) => s.showPlaceholders)

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

  // Multi-cursor — редактирование нескольких мест одновременно (Ctrl+D)
  const multiCursor = useMultiCursor()
  const isMultiSelectingRef = multiCursor.isActiveRef
  const multiCursorRef = useRef(multiCursor)
  // eslint-disable-next-line react-hooks/refs
  multiCursorRef.current = multiCursor

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
  const autoExtractCharactersRef = useRef(autoExtractCharacters)

  // Обновляем refs в useEffect во избежание мутаций во время рендера
  useEffect(() => {
    timingSystemRef.current = timingSystem
    genreCoefficientRef.current = genreCoefficient
    onScenesChangeRef.current = onScenesChange
    onStatsChangeRef.current = onStatsChange
    currentSeriesRef.current = currentSeries
    projectTypeRef.current = projectType
    autoExtractCharactersRef.current = autoExtractCharacters
  }, [timingSystem, genreCoefficient, onScenesChange, onStatsChange, currentSeries, projectType, autoExtractCharacters])

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
  // Флаг чтобы предотвратить бесконечный цикл при повторном применении
  const isReApplyingRef = useRef(false)
  // Флаг: идёт принудительное разделение узла по границе страницы (защита от рекурсии)
  const isSplittingRef = useRef(false)
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
    // Отключаем автоопределение при active multi-selection
    if (isMultiSelectingRef.current) return

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
        editorInstance.chain().setNode('sceneHeader').command(({ tr }) => { tr.setMeta('addToHistory', false); return true }).run()
        return
      }
    }

    // --- Пустой paragraph → действие (для двойного Enter) ---
    if (shouldDetectType && currentType === 'paragraph' && textContent === '') {
      editorInstance.chain().setNode('sceneAction').command(({ tr }) => { tr.setMeta('addToHistory', false); return true }).run()
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
        editorInstance.chain().setNode('sceneCharacter').command(({ tr }) => { tr.setMeta('addToHistory', false); return true }).run()
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
          editorInstance.chain().setNode('sceneAction').command(({ tr }) => { tr.setMeta('addToHistory', false); return true }).run()
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
          .command(({ tr }) => { tr.setMeta('addToHistory', false); return true })
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
          const nextNumber = getNextSceneNumber(editorInstance.state.doc)
          const newText = `${nextNumber}. ${upperText}`
          isReplacingRef.current = true
          const nodeStart = $from.start()
          const nodeEnd = $from.end()
          editorInstance
            .chain()
            .deleteRange({ from: nodeStart, to: nodeEnd })
            .insertContent(newText)
            .setTextSelection(nodeStart + newText.length)
            .command(({ tr }) => { tr.setMeta('addToHistory', false); return true })
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
            .command(({ tr }) => { tr.setMeta('addToHistory', false); return true })
            .run()
          if (isReplacingTimeoutRef.current) clearTimeout(isReplacingTimeoutRef.current)
          isReplacingTimeoutRef.current = setTimeout(() => { isReplacingRef.current = false }, 100)
          return
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
          .command(({ tr }) => { tr.setMeta('addToHistory', false); return true })
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
      editorInstance.chain().setNode(newType).command(({ tr }) => { tr.setMeta('addToHistory', false); return true }).run()
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
      Extension.create({
        name: 'multiCursorPlugin',
        addProseMirrorPlugins() {
          return [multiCursor.plugin]
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
      DialogueHighlightExtension,
      PovFilterExtension,
      Placeholder.configure({
        placeholder: ({ node, editor: ed }) => {
          const type = node.type.name

          // Подсказки по типу блока
          const hints: Record<string, string> = {
            sceneHeader:       'ИНТ. ЛОКАЦИЯ. ВРЕМЯ',
            sceneCast:         'дед, бабка, внук...',
            sceneAction:       'Опишите действие...',
            sceneCharacter:    'ИМЯ ПЕРСОНАЖА',
            sceneDialog:       'Реплика персонажа...',
            sceneParenthetical:'(пауза)',
            sceneTransition:   'МОНТАЖ:',
            paragraph:         'Начните писать сценарий...',
          }

          if (!hints[type]) return ''

          // Показываем только для первого пустого блока каждого типа
          const { doc } = ed.state
          let firstEmptyOfType: number | null = null
          doc.descendants((n, pos) => {
            if (n.type.name === type && n.nodeSize === 2 && firstEmptyOfType === null) {
              firstEmptyOfType = pos
            }
          })

          // Находим позицию текущего узла
          let currentPos: number | null = null
          doc.descendants((n, pos) => {
            if (n === node) currentPos = pos
          })

          return currentPos === firstEmptyOfType ? hints[type] : ''
        },
        showOnlyCurrent: false,
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
        mousedown: () => {
          if (isMultiSelectingRef.current) {
            multiCursorRef.current.exitMultiSelection(editor)
          }
          return false
        },
      },
      handleKeyDown: (view, event) => handleKeyDownRef.current?.(view, event) ?? false,
      handlePaste: (view, event) => handlePasteRef.current?.(view, event) ?? false,
      handleTextInput: (_view, _from, _to, text) => {
        if (isMultiSelectingRef.current && multiCursorRef.current.rangesRef.current.length > 1) {
          multiCursorRef.current.applyTextToRanges(editor!, text)
          return true
        }
        return false
      },
    },
  })

  // Применяем/убираем CSS-класс placeholders-hidden на DOM-элемент редактора
  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom as HTMLElement
    if (showPlaceholders) {
      el.classList.remove('placeholders-hidden')
    } else {
      el.classList.add('placeholders-hidden')
    }
  }, [editor, showPlaceholders])

  // Обновляем выбранного персонажа в плагине подсветки диалогов
  useEffect(() => {
    if (!editor) return
    const tr = editor.state.tr.setMeta(dialogueHighlightPluginKey, { character: dialogueCharacter || null })
    editor.view.dispatch(tr)
  }, [editor, dialogueCharacter])

  // Обновляем выбранного персонажа в плагине POV Filter
  useEffect(() => {
    if (!editor) return
    const tr = editor.state.tr.setMeta(povFilterPluginKey, { character: povCharacter || null })
    editor.view.dispatch(tr)
  }, [editor, povCharacter])

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

  // Применяем page-start и отступы на основе точных данных из pageCounter
  // Используем pageBreaksRef (вычисленный через виртуальный A4-рендеринг)
  const applyPageBreaks = useCallback(() => {
    if (!editor) return
    const editorDom = editor.view.dom as HTMLElement
    const children = Array.from(editorDom.children) as HTMLElement[]
    children.forEach(child => {
      child.classList.remove('page-start')
      child.removeAttribute('data-page')
      child.style.removeProperty('margin-bottom')
      child.style.removeProperty('padding-top')
      child.classList.remove('page-break-margin-200', 'page-break-margin-300', 'page-break-margin-400')
    })
    if (children.length === 0 || pageBreaksRef.current.length === 0) return

    const mmToPx = 96 / 25.4
    const pageHeightPx = A4_HEIGHT_MM * mmToPx // 297мм — полная высота листа
    const gapPx = 16 * mmToPx // 16мм — заметный зазор между страницами (Word-style)
    const stride = pageHeightPx + gapPx
    const usableHeightPx = (A4_HEIGHT_MM - PAGE_MARGIN_TOP_BOTTOM_MM * 2) * mmToPx // 257мм текстовая зона

    // Читаем текущие позиции блоков (до применения отступов)
    const editorRect = editorDom.getBoundingClientRect()
    const positions = children.map(child => {
      const rect = child.getBoundingClientRect()
      return {
        top: rect.top - editorRect.top,
        bottom: rect.bottom - editorRect.top,
        height: rect.height,
      }
    })

    // Вычисляем page boundaries (где должны начинаться страницы)
    const pageBoundaries = new Map<number, number>() // page -> startY
    pageBreaksRef.current.forEach((breakInfo) => {
      pageBoundaries.set(breakInfo.page, (breakInfo.page - 1) * (pageHeightPx + gapPx))
    })

    // Применяем page breaks из pageBreaksRef
    let accumulatedPush = 0
    pageBreaksRef.current.forEach((breakInfo) => {
      const { page, startIndex } = breakInfo
      if (startIndex >= children.length) return

      // Блок, который начинается на новой странице
      const startChild = children[startIndex]
      startChild.classList.add('page-start')
      startChild.setAttribute('data-page', `Страница ${page}`)

      // Отступ применяем к НОВОМУ блоку (padding-top), а не к предыдущему:
      // зона зазора принадлежит startChild — текст предыдущего блока не может
      // "впечататься" в неё при наборе (padding не схлопывается и не стирается ростом)
      if (startIndex > 0) {
        const prevEnd = positions[startIndex - 1].bottom + accumulatedPush
        const targetY = pageBoundaries.get(page) || 0
        const push = targetY - prevEnd

        if (push > 0) {
          startChild.style.setProperty('padding-top', `${push}px`, 'important')
          accumulatedPush += push
        }
      }
    })

    // Привязка: любой блок, начинающийся в запретной зоне (ниже текстовой
    // области или в сером зазоре), пододвигаем к верху следующего листа.
    // Это подхватывает вторые половины разрезанных узлов — даже если
    // виртуальный счётчик считает их ещё частью прошлой страницы.
    for (const el of children) {
      const top = el.getBoundingClientRect().top - editorRect.top
      const pi = Math.max(0, Math.floor(top / stride))
      const zoneTop = pi * stride + usableHeightPx // конец текстовой зоны листа
      const zoneEnd = (pi + 1) * stride // верх следующего листа
      if (top > zoneTop + 1 && top < zoneEnd - 2) {
        el.style.setProperty('padding-top', `${zoneEnd - top}px`, 'important')
      }
    }

    // Повторно применяем page breaks после рендера ProseMirror (сбрасывает inline стили)
    // Не планируем повторное применение если уже в процессе (предотвращаем бесконечный цикл)
    if (!isReApplyingRef.current) {
      if (pageBreakApplyTimeoutRef.current) {
        clearTimeout(pageBreakApplyTimeoutRef.current)
      }
      pageBreakApplyTimeoutRef.current = setTimeout(() => {
        isReApplyingRef.current = true
        applyPageBreaks()
        isReApplyingRef.current = false
        pageBreakApplyTimeoutRef.current = null
      }, 300)
    }
  }, [editor])

  // ── Строгое ограничение границ А4: Node Splitting ──────────────────
  // Если блок пересекает нижнюю границу листа — режем его tr.split()
  // ровно по линии границы. Первая часть остаётся на листе, вторая
  // станет page-start на следующем (её подвинет applyPageBreaks).
  // Это реальное изменение документа, а не визуальный трюк.
  const enforcePageBoundaries = useCallback(() => {
    if (!editor || editor.isDestroyed || isSplittingRef.current) return
    const editorDom = editor.view.dom as HTMLElement
    const children = Array.from(editorDom.children) as HTMLElement[]
    if (children.length === 0) return
    console.log('[enforce] run, children:', children.length)

    const mmToPx = 96 / 25.4
    const pageHeightPx = A4_HEIGHT_MM * mmToPx
    const gapPx = 16 * mmToPx
    const stride = pageHeightPx + gapPx
    // Реальная текстовая область листа: 297мм - поля (2см верх + 2см низ) = 257мм.
    // Блок начинает страницу на 2см ниже верха листа → его низ не должен
    // пересекать pageTop + 257мм, иначе текст визуально уйдёт в зазор.
    const usableHeightPx = (A4_HEIGHT_MM - PAGE_MARGIN_TOP_BOTTOM_MM * 2) * mmToPx
    const editorRect = editorDom.getBoundingClientRect()

    const splittableTypes = new Set([
      'paragraph', 'sceneAction', 'sceneDialog', 'sceneCast',
      'sceneParenthetical', 'sceneCharacter', 'sceneHeader', 'sceneTransition',
    ])

    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci]
      const r = child.getBoundingClientRect()
      const top = r.top - editorRect.top
      const bottom = r.bottom - editorRect.top
      const pageIndex = Math.max(0, Math.floor(top / stride))
      const pageBottom = pageIndex * stride + usableHeightPx
      if (bottom <= pageBottom + 2) continue
      console.log('[enforce] overflow block, bottom:', Math.round(bottom), 'pageBottom:', Math.round(pageBottom), 'page:', pageIndex)

      // Блок пересёк низ листа — определяем его узел в документе.
      // Блоки верхнего уровня лежат на глубине 1: $p.node(1).
      // $p.nodeAfter/parent могут дать текстовый узел — проверяем оба пути.
      let nodeStart = -1
      try {
        nodeStart = editor.view.posAtDOM(child, 0)
      } catch {
        continue
      }
      if (nodeStart < 0) continue
      let node = null as any
      let blockStart = nodeStart
      try {
        const $p = editor.state.doc.resolve(nodeStart)
        if ($p.depth > 0) {
          node = $p.node(1)
          blockStart = $p.before(1)
        } else {
          node = $p.nodeAfter
        }
      } catch {
        continue
      }
      if (!node || !splittableTypes.has(node.type.name)) {
        console.log('[enforce] not splittable:', node?.type?.name)
        continue
      }

      // Находим позицию в документе, соответствующую линии границы листа.
      // X берём по центру блока — у края может быть пустое поле без текста,
      // тогда posAtCoords возвращает начало узла вместо точки разрыва.
      const boundaryClientY = editorRect.top + pageBottom - 4
      let hit = editor.view.posAtCoords({ left: r.left + r.width / 2, top: boundaryClientY })
      if (!hit || hit.pos <= blockStart + 1) {
        hit = editor.view.posAtCoords({ left: r.left + r.width * 0.7, top: boundaryClientY })
      }
      if (!hit || hit.pos <= blockStart + 1) {
        hit = editor.view.posAtCoords({ left: r.left + r.width * 0.3, top: boundaryClientY })
      }
      if (!hit) {
        console.log('[enforce] posAtCoords null')
        continue
      }
      const nodeEnd = blockStart + node.nodeSize
      if (hit.pos <= blockStart + 1 || hit.pos >= nodeEnd - 1) {
        console.log('[enforce] hit.pos out of node:', hit.pos, 'node:', blockStart, '-', nodeEnd)
        continue
      }

      // Node Splitting: блоки имеют defining:true — обычный tr.split
      // молча не работает. Режем вручную: удаляем хвост текста из первого
      // узла и вставляем его новым узлом того же типа сразу после.
      isSplittingRef.current = true
      try {
        const state = editor.state
        const selFrom = state.selection.from
        const tail = state.doc.slice(hit.pos, nodeEnd - 1).content
        const tr = state.tr
        tr.delete(hit.pos, nodeEnd - 1)
        // После удаления первый узел заканчивается на hit.pos,
        // позиция сразу за ним = hit.pos + 1
        tr.insert(hit.pos + 1, node.type.create(node.attrs, tail))
        const mapped = Math.min(tr.mapping.map(selFrom), tr.doc.content.size)
        tr.setSelection(TextSelection.near(tr.doc.resolve(mapped), -1))
        editor.view.dispatch(tr)
        console.log('[enforce] SPLIT at', hit.pos)

        // Мгновенно подвигаем вторую половину на начало следующего листа —
        // не ждём пересчёта виртуального счётчика (~150мс "зависание" в зазоре)
        const targetY = (pageIndex + 1) * stride
        setTimeout(() => {
          const nextEl = editorDom.children[ci + 1] as HTMLElement | undefined
          if (nextEl) {
            const rect = nextEl.getBoundingClientRect()
            const push = targetY - (rect.top - editorDom.getBoundingClientRect().top)
            if (push > 0) nextEl.style.setProperty('padding-top', `${push}px`, 'important')
          }
        }, 0)
      } catch (err) {
        console.error('[enforce] split error', err)
      } finally {
        setTimeout(() => { isSplittingRef.current = false }, 0)
      }
      break // один сплит за проход — следующий onUpdate доведёт остаток
    }
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

    // Ctrl+D — Multi-cursor: выделить слово / добавить следующее совпадение
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault()
      if (editor) {
        multiCursorRef.current.addNextMatch(editor)
      }
      return true
    }

    // Escape — выйти из multi-selection
    if (event.key === 'Escape' && isMultiSelectingRef.current) {
      event.preventDefault()
      multiCursorRef.current.exitMultiSelection(editor)
      return true
    }

    // Стрелки — сбрасывают multi-selection
    if (isMultiSelectingRef.current && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      multiCursorRef.current.exitMultiSelection(editor)
      return false // позволяем стандартное перемещение курсора
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

    // Ctrl+1..7 (Cmd+1..7 на Mac) — быстрое переключение типа блока (сохраняет текст)
    if ((event.ctrlKey || event.metaKey) && altKeyMap[event.key]) {
      event.preventDefault()
      editor?.chain().setNode(altKeyMap[event.key]).run()
      return true
    }

    // Ctrl+Shift+S (Cmd+Shift+S на Mac) — новая сцена
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
      event.preventDefault()

      const nextNumber = getNextSceneNumber(view.state.doc)
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
    }

    // Tab — цикл переключения типов блока (сохраняет текст)
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const { state } = view
      const { selection } = state
      const { $from } = selection
      const currentNode = $from.node()
      const currentType = currentNode?.type.name

      // Авто-добавление персонажа в cast при уходе с sceneCharacter
      if (currentType === 'sceneCharacter' && autoExtractCharactersRef.current) {
        addCharacterToSceneCast(editor!)
      }

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
          const nextNumber = getNextSceneNumber(view.state.doc)
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

    const maybeUpdateCast = () => {
      if (autoExtractCharactersRef.current && editor) {
        updateSceneCastBlocks(editor)
      }
    }

    // 1. Если plain text похож на сценарий → парсим в блоки
    if (plainText && isScreenplayContent(plainText)) {
      event.preventDefault()
      const blocks = parseScreenplayText(plainText)
      if (blocks.length > 0) {
        const html = blocksToHtml(blocks)
        editor?.chain().insertContent(html).run()
        maybeUpdateCast()
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
        maybeUpdateCast()
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
      maybeUpdateCast()
      return true
    }

    // 5. Fallback: если есть plain text → вставляем его (уже sanitized)
    if (plainText && plainText.length > 0) {
      event.preventDefault()
      editor?.chain().insertContent(plainText).run()
      maybeUpdateCast()
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
      calculateAndReportStats(editorInstance)
      pageCountTimeoutRef.current = null
    }, 150)

    // Строгие границы А4: режем узел, пересекающий низ листа (Node Splitting)
    enforcePageBoundaries()

    // Отключаем автоформатирование при active multi-selection
    if (isMultiSelectingRef.current) {
      smartTypeRef.current.closeSuggestions()
      return
    }

    autoDetectPerChar(editorInstance)

    // Определение типа блока для персонажей/диалога/ремарки/перехода — только после Enter
    if (lastKeyWasEnterRef.current) {
      lastKeyWasEnterRef.current = false
      autoDetectBlockTypeAfterEnter(editorInstance)

      // Авто-добавление персонажа в cast сцены после Enter в диалоге
      if (autoExtractCharactersRef.current) {
        addCharacterToSceneCast(editorInstance)
      }
    }
    
    const { state } = editorInstance
    const { selection } = state
    const { $from } = selection
    const currentType = getCurrentBlockType(editorInstance)
    
    const st = smartTypeRef.current
    if (currentType === 'sceneHeader' || currentType === 'paragraph' || currentType === 'sceneCharacter' || currentType === 'sceneCast') {
      const currentNode = $from.node()
      const nodeText = currentNode?.textContent || ''
      const nodeStartPos = $from.start()
      const posInNode = selection.from - nodeStartPos
      const smartTypeBlockType = currentType === 'sceneCharacter' ? 'sceneCharacter' : currentType === 'sceneCast' ? 'sceneCast' : 'sceneHeader'
      st.updateSuggestions(nodeText, posInNode, smartTypeBlockType)
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

  // Перехватываем Ctrl+D на уровне window, чтобы браузер не открывал диалог закладок
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        if (editor) {
          multiCursorRef.current.addNextMatch(editor)
        }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
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

  // Хелпер: обновить sceneCast блоки в редакторе из диалогов (при загрузке / вставке)
  const updateSceneCastBlocks = useCallback((editorInstance: Editor) => {
    const { doc, tr } = editorInstance.state
    let modified = false

    // Собираем ВСЕ блоки верхнего уровня документа
    const blockNodes: Array<{ node: any; pos: number }> = []
    doc.forEach((node: any, offset: number) => {
      blockNodes.push({ node, pos: offset })
    })

    // Обрабатываем каждую сцену: ищем sceneHeader → sceneCast → sceneCharacter в пределах сцены
    const scenesToUpdate: Array<{
      castPos: number
      castEndPos: number
      currentCastText: string
      dialogChars: string[]
      sceneNumber: string
    }> = []

    for (let i = 0; i < blockNodes.length; i++) {
      const { node } = blockNodes[i]
      if (node.type.name !== 'sceneHeader') continue

      const headerText = node.textContent.trim()
      const numMatch = headerText.match(/^(\d+(?:-\d+)?)\./)
      const sceneNumber = numMatch ? numMatch[1] : '?'

      let castPos = -1
      let castEndPos = -1
      let currentCastText = ''
      const dialogChars: string[] = []
      const seenChars = new Set<string>()

      // Сканируем блоки ПОСЛЕ текущего sceneHeader ДО следующего
      for (let j = i + 1; j < blockNodes.length; j++) {
        const { node: childNode, pos: childPos } = blockNodes[j]

        // Достигли следующей сцены — стоп
        if (childNode.type.name === 'sceneHeader') break

        // Первый cast блок после шапки
        if (childNode.type.name === 'sceneCast' && castPos === -1) {
          castPos = childPos
          castEndPos = childPos + childNode.nodeSize
          currentCastText = childNode.textContent.trim()
        }

        // Персонажи из диалогов ТОЛЬКО внутри этой сцены
        if (childNode.type.name === 'sceneCharacter') {
          const charName = childNode.textContent.trim().toUpperCase()
          if (charName && !seenChars.has(charName)) {
            seenChars.add(charName)
            dialogChars.push(childNode.textContent.trim())
          }
        }
      }

      if (castPos !== -1) {
        scenesToUpdate.push({ castPos, castEndPos, currentCastText, dialogChars, sceneNumber })
      }
    }

    // Обрабатываем в обратном порядке (справа налево), чтобы позиции не съезжали
    for (let i = scenesToUpdate.length - 1; i >= 0; i--) {
      const { castPos, castEndPos, currentCastText, dialogChars } = scenesToUpdate[i]

      if (dialogChars.length === 0) {
        continue
      }

      // Разбираем текущий cast
      const currentNames = currentCastText
        ? currentCastText.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : []

      const seen = new Set(currentNames.map((n: string) => n.toUpperCase()))
      const newNames: string[] = []

      // Добавляем новых из диалогов
      dialogChars.forEach((name) => {
        const upper = name.toUpperCase()
        if (!seen.has(upper)) {
          seen.add(upper)
          newNames.push(name)
        }
      })

      if (newNames.length === 0) {
        continue
      }

      // Обновляем текст cast блока: текущий + новые
      const mergedCast = currentNames.length > 0
        ? `${currentNames.join(', ')}, ${newNames.join(', ')}`
        : newNames.join(', ')

      tr.insertText(mergedCast, castPos + 1, castEndPos - 1)
      modified = true
    }

    if (modified) {
      tr.setMeta('addToHistory', false)
      editorInstance.view.dispatch(tr)
    }
  }, [])

  // Хелпер: авто-добавление персонажа в cast текущей сцены при Enter после диалога
  const addCharacterToSceneCast = useCallback((editorInstance: Editor) => {
    const { state } = editorInstance
    const { selection } = state

    // Собираем все блоки верхнего уровня
    const blocks: Array<{ node: PMNode; pos: number }> = []
    state.doc.forEach((node: PMNode, pos: number) => {
      blocks.push({ node, pos })
    })

    // Найти текущий блок по позиции курсора
    let currentIndex = -1
    for (let i = 0; i < blocks.length; i++) {
      const { node, pos } = blocks[i]
      const end = pos + node.nodeSize
      if (pos <= selection.from && selection.from <= end) {
        currentIndex = i
        break
      }
    }
    if (currentIndex === -1) return

    const currentBlock = blocks[currentIndex].node
    const currentType = currentBlock.type.name

    // Работаем только после Enter в sceneCharacter или sceneDialog
    let charName = ''
    if (currentType === 'sceneCharacter') {
      charName = currentBlock.textContent.trim()
    } else if (currentType === 'sceneDialog') {
      // Ищем ближайший sceneCharacter выше (внутри той же сцены)
      for (let i = currentIndex - 1; i >= 0; i--) {
        if (blocks[i].node.type.name === 'sceneCharacter') {
          charName = blocks[i].node.textContent.trim()
          break
        }
        if (blocks[i].node.type.name === 'sceneHeader') break
      }
    }

    if (!charName || charName.length < 2) return

    // Идём вверх до ближайшего sceneHeader и берём его cast блок
    let castBlock: { pos: number; end: number; text: string } | null = null
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (blocks[i].node.type.name === 'sceneHeader') {
        const nextBlock = blocks[i + 1]
        if (nextBlock && nextBlock.node.type.name === 'sceneCast') {
          castBlock = {
            pos: nextBlock.pos,
            end: nextBlock.pos + nextBlock.node.nodeSize,
            text: nextBlock.node.textContent.trim(),
          }
        }
        break
      }
    }

    if (!castBlock) return

    // Проверяем, есть ли уже
    const names = castBlock.text
      ? castBlock.text.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
      : []
    const upperName = charName.toUpperCase()
    const exists = names.some((n: string) => n.toUpperCase() === upperName)

    if (exists) return

    // Добавляем
    const newText = castBlock.text
      ? `${castBlock.text}, ${charName}`
      : charName

    const tr = state.tr
    tr.insertText(newText, castBlock.pos + 1, castBlock.end - 1)
    tr.setMeta('addToHistory', false)
    editorInstance.view.dispatch(tr)
  }, [])

  // Хелпер: расчёт статистики и отправка в коллбэки (используется в onUpdate и при загрузке)
  const calculateAndReportStats = useCallback((editorInstance: Editor) => {
    const html = editorInstance.getHTML()
    const result = pageCounterRef.current!.calculatePagesWithBreaks(
      html,
      (_formatRef.current as 'russian' | 'hollywood') || 'russian'
    )
    setPrecisePages(result.totalPages)
    precisePagesRef.current = result.totalPages

    const { scenes: extractedScenes, stats } = extractScenesFromDocument({
      doc: editorInstance.state.doc,
      forcedPages: result.totalPages,
      precisePagesFallback: precisePagesRef.current,
      timingSystem: timingSystemRef.current,
      genreCoefficient: genreCoefficientRef.current,
    })
    onScenesChangeRef.current?.(extractedScenes)
    onStatsChangeRef.current?.(stats)

    // Обучаем SmartType
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

    pageBreaksRef.current = result.breaks
    applyPageBreaks()
    // И на загруженном/вставленном контенте тоже режем переполненные блоки —
    // не только на update при печати
    enforcePageBoundaries()
  }, [])

  // Загружаем контент только при создании редактора / смене скрипта
  useEffect(() => {
    if (!editor || initialContentLoadedRef.current) return
    if (initialContent) {
      editor.commands.setContent(initialContent)
    }
    initialContentLoadedRef.current = true

    // После setContent нужно принудительно пересчитать статистику,
    // потому что onUpdate НЕ срабатывает при setContent
    setTimeout(() => {
      if (editor && editor.isDestroyed) {
        return
      }
      calculateAndReportStats(editor)

      // При загрузке: если авто-добавление включено — обновить sceneCast блоки
      if (autoExtractCharacters) {
        updateSceneCastBlocks(editor)
      }
    }, 100)
  }, [editor, initialContent, calculateAndReportStats, autoExtractCharacters])

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
      }
    }

    onConvertReady(convertFormat)
  }, [editor, onConvertReady])

  // Регистрация функции автоформатирования — возвращает текст редактора
  useEffect(() => {
    if (!editor || !onFormatReady) return
    onFormatReady(() => {
      return editor.getText({ blockSeparator: '\n' })
    })
  }, [editor, onFormatReady])

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
    multiCursorCount: multiCursor.activeCount,
  }
}
