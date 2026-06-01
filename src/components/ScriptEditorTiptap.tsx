import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DragHandle from '@tiptap/extension-drag-handle'
import { useEffect, useCallback, useRef } from 'react'
import type { ScriptFormat } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneNode } from './tiptap'
import { Film, AlignLeft, User, Users, MessageSquare, ArrowRight } from 'lucide-react'
import { useSmartType } from '../hooks/useSmartType'
import { SmartTypePopup } from './SmartTypePopup'

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
  onSceneCountChange?: (count: number) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
  onScenesChange?: (scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number }>) => void
  focusSceneId?: string
  onConvertReady?: (convertFn: (from: ScriptFormat, to: ScriptFormat) => void) => void
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
  genreCoefficient,
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

  // Отслеживаем шапки с уже созданным переходом (избегаем дублирования)
  const processedHeadersRef = useRef<Set<string>>(new Set())
  // Флаг защиты от двойной авто-замены
  const isReplacingRef = useRef(false)

  // 1.1 Ключ localStorage: для сериала — отдельный черновик на каждую серию
  const draftKey = projectId
    ? (projectType === 'serial' && currentSeries > 0
        ? `kinoplan_draft_${projectId}_s${currentSeries}`
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
      handleKeyDown: (view, event) => {
        // Если SmartType открыт и нажат Enter — выбираем подсказку
        if (smartType.isOpen && (event.key === 'Enter' || event.key === 'Tab')) {
          event.preventDefault()
          const suggestion = smartType.suggestions[smartType.activeIndex]
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
              
              // Для времени автоматически добавляем точку
              const textToInsert = suggestion.type === 'time' 
                ? suggestion.text + '.' 
                : suggestion.text
              
              editor
                .chain()
                .focus()
                .deleteRange({ from: wordStartPos, to: wordEndPos })
                .insertContent(textToInsert)
                .run()
              
              smartType.closeSuggestions()
            }
          }
          return true // Предотвращаем стандартное поведение
        }
        
        // Если SmartType открыт и нажаты стрелки — навигация
        if (smartType.isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault()
          smartType.navigateSuggestions(event.key === 'ArrowDown' ? 'down' : 'up')
          return true
        }
        
        // Если SmartType открыт и нажат Escape — закрываем
        if (smartType.isOpen && event.key === 'Escape') {
          event.preventDefault()
          smartType.closeSuggestions()
          return true
        }
        
        // Автоматические переходы между типами блоков при Enter
        if (event.key === 'Enter' && !event.shiftKey) {
          const { state } = view
          const { selection } = state
          const { $from } = selection
          const currentNode = $from.node()
          const currentType = currentNode?.type.name
          
          // 1. После SceneHeader → создаём SceneCast для персонажей
          if (currentType === 'sceneHeader') {
            event.preventDefault()
            editor?.chain().splitBlock().setNode('sceneCast').run()
            return true
          }
          
          // 2. После SceneCast → создаём SceneAction (описание)
          if (currentType === 'sceneCast') {
            event.preventDefault()
            editor?.chain().splitBlock().setNode('sceneAction').run()
            return true
          }
          
          // 3. После SceneCharacter → создаём SceneDialog
          if (currentType === 'sceneCharacter') {
            event.preventDefault()
            editor?.chain().splitBlock().setNode('sceneDialog').run()
            return true
          }
          
          // 4. После SceneDialog → создаём SceneAction (или проверяем капслок)
          if (currentType === 'sceneDialog') {
            event.preventDefault()
            editor?.chain().splitBlock().setNode('sceneAction').run()
            return true
          }
        }
        
        return false // Пропускаем остальные клавиши
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      
      // 1.1 Сохраняем в localStorage с ключом по projectId
      localStorage.setItem(draftKey, html)
      
      // Извлекаем сцены из SceneNode (мгновенно)
      extractScenesFromDocument()
      
      // Автоопределение типа блока
      autoDetectBlockType(editor)
      
      // SmartType — обновляем подсказки (для шапки сцены и paragraph где набирается шапка)
      const { state } = editor
      const { selection } = state
      const { $from } = selection
      const currentType = getCurrentBlockType(editor)
      
      // 3.1 SmartType работает в шапке, paragraph и блоке персонажа
      if (currentType === 'sceneHeader' || currentType === 'paragraph' || currentType === 'sceneCharacter') {
        const currentNode = $from.node()
        const nodeText = currentNode?.textContent || ''
        const nodeStartPos = $from.start()
        const posInNode = selection.from - nodeStartPos
        smartType.updateSuggestions(nodeText, posInNode, currentType === 'sceneCharacter' ? 'sceneCharacter' : 'sceneHeader')
      } else {
        smartType.closeSuggestions()
      }
    },
  })

  // 2.2 Извлечение сцен напрямую из sceneHeader (без SceneNode)
  // 2.1 Исправлен баг: locationPart = headerMatch[3] (не [2])
  const extractScenesFromDocument = () => {
    if (!editor) return

    type SceneEntry = { id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number }
    const scenes: SceneEntry[] = []

    // Собираем только блоки верхнего уровня документа (не inline-узлы)
    const blockNodes: any[] = []
    editor.state.doc.forEach((node: any) => {
      blockNodes.push(node)
    })

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

      // Считаем символы до следующей sceneHeader для приблизительного кол-ва страниц
      let charCount = headerText.length
      for (let i = index + 1; i < blockNodes.length; i++) {
        const n = blockNodes[i]
        if (n.type.name === 'sceneHeader') break
        charCount += n.textContent.length
      }
      const pages = Math.max(0.1, parseFloat((charCount / 1800).toFixed(1)))

      scenes.push({ id: `scene-${sceneNumber}`, number: sceneNumber, type: sceneType, location, time, cast, pages })
    })

    if (onScenesChange) {
      onScenesChange(scenes)
    }
    if (onStatsChange) {
      const totalPages = scenes.reduce((sum, s) => sum + s.pages, 0)
      const coeff = genreCoefficient || 1.0
      onStatsChange({
        scenes: scenes.length,
        pages: parseFloat(totalPages.toFixed(1)),
        duration: Math.round(totalPages * 55 * coeff),
      })
    }
  }

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
    
    // Если определили новый тип и он отличается от текущего — меняем
    if (newType && newType !== currentType) {
      editor.chain().setNode(newType).run()
    }
    
    const isHeader = currentType === 'sceneHeader' || newType === 'sceneHeader'
    const isCharacter = currentType === 'sceneCharacter' || newType === 'sceneCharacter'
    
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
        setTimeout(() => { isReplacingRef.current = false }, 100)
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
          setTimeout(() => { isReplacingRef.current = false }, 100)
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
          setTimeout(() => { isReplacingRef.current = false }, 100)
          return
        }
      }
      
      // Если время закончилось точкой — переходим на новую строку (только один раз)
      const timePattern = /\s(ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ)\.$/
      if (timePattern.test(upperText)) {
        const headerKey = `${$from.pos}-${upperText}`
        if (!processedHeadersRef.current.has(headerKey)) {
          processedHeadersRef.current.add(headerKey)
          editor.chain().splitBlock().setNode('sceneCast').run()
        }
      }
    }
  }

  // Обновляем CSS-класс формата при переключении RU/EN
  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom as HTMLElement
    el.classList.remove('format-russian', 'format-hollywood', 'format-custom')
    el.classList.add(`format-${_format || 'russian'}`)
  }, [editor, _format])

  // Загружаем черновик при монтировании И при смене серии (draftKey меняется)
  useEffect(() => {
    if (editor) {
      const saved = localStorage.getItem(draftKey)
      // При смене серии — очищаем редактор и загружаем нужный черновик (или пустой)
      editor.commands.setContent(saved || '<p></p>')
      processedHeadersRef.current.clear()
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
    editor.state.doc.descendants((node, pos) => {
      if (found) return false
      if (node.type.name === 'sceneHeader') {
        const headerText = node.textContent
        const headerMatch = headerText.match(/^(\d+(?:-\d+)?)\./)
        if (headerMatch) {
          const sceneNum = headerMatch[1]
          if (focusSceneId.includes(sceneNum) || focusSceneId === `scene-${sceneNum}`) {
            found = true
            const domNode = editor.view.nodeDOM(pos) as HTMLElement | null
            if (domNode) {
              domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        }
      }
    })
  }, [focusSceneId, editor])

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
    <div className="flex-1 flex flex-col overflow-hidden relative">
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
          {(editor.getText().length / 1800).toFixed(1)} стр.
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
