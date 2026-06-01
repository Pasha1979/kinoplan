import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
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
  currentSeries: number
  fontFamily: string
  fontSize: number
  isDark: boolean
  genreCoefficient: number
  onSceneCountChange?: (count: number) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
  onBlocksChange?: (blocks: any[]) => void
  onScenesChange?: (scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number }>) => void
  focusSceneId?: string
  // SmartType данные (вместо hardcoded)
  smartTypeCharacters?: string[]
  smartTypeLocations?: string[]
  smartTypeTimes?: string[]
}

export default function ScriptEditorTiptap({
  format: _format,
  projectType,
  currentSeries,
  fontFamily,
  fontSize,
  isDark,
  onScenesChange,
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

  const editor = useEditor({
    extensions: [
      StarterKit,
      SceneNode,
      SceneHeader,
      SceneCast,
      SceneAction,
      SceneCharacter,
      SceneDialog,
      SceneTransition,
      Placeholder.configure({
        placeholder: 'Начните писать сценарий...',
      }),
    ],
    content: '<p>1. ИНТ. ЛОКАЦИЯ — ДЕНЬ</p><p></p>',
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
      
      // Сохраняем в localStorage (сразу — легкая операция)
      localStorage.setItem('kinoplan_tiptap_draft', html)
      
      // Извлекаем сцены из SceneNode (мгновенно)
      extractScenesFromDocument()
      
      // Автоопределение типа блока
      autoDetectBlockType(editor)
      
      // SmartType — обновляем подсказки (только для шапки сцены)
      const { state } = editor
      const { selection } = state
      const { $from } = selection
      const currentType = getCurrentBlockType(editor)
      
      // Подсказки ИНТ/ЭКСТ и времени только в шапке сцены
      if (currentType === 'sceneHeader') {
        // Получаем текст текущей ноды и позицию внутри неё
        const currentNode = $from.node()
        const nodeText = currentNode?.textContent || ''
        const nodeStartPos = $from.start()
        const posInNode = selection.from - nodeStartPos
        
        smartType.updateSuggestions(nodeText, posInNode, currentType)
      } else {
        // Закрываем подсказки если не в шапке
        smartType.closeSuggestions()
      }
    },
  })

  // Извлечение сцен из SceneNode (мгновенно, без debounced)
  const extractScenesFromDocument = () => {
    if (!editor) return
    
    const scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number }> = []
    
    // Проходим по всем узлам документа и ищем SceneNode
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'scene') {
        const attrs = node.attrs
        const headerNode = node.child(0) // Первый ребенок — sceneHeader
        
        if (headerNode && headerNode.type.name === 'sceneHeader') {
          const headerText = headerNode.textContent
          
          // Парсим шапку: "1-1. ИНТ. КВАРТИРА — ДЕНЬ"
          const headerMatch = headerText.match(/^(\d+(?:-\d+)?)\.\s*(ИНТ\.?|ЭКСТ\.?|ИНТ-ЭКСТ\.?)\s+(.+)$/i)
          
          if (headerMatch) {
            const sceneNumber = headerMatch[1]
            const sceneType = headerMatch[2].toUpperCase().startsWith('Э') ? 'ЭКСТ' : 'ИНТ'
            const locationPart = headerMatch[2]
            
            // Разделяем локацию и время
            const parts = locationPart.split(/[—–\-]/)
            const location = parts[0]?.trim().replace(/\.$/, '') || ''
            const time = parts[parts.length - 1]?.trim().replace(/\.$/, '') || 'ДЕНЬ'
            
            scenes.push({
              id: attrs.id || `scene-${sceneNumber}`,
              number: sceneNumber,
              type: sceneType,
              location,
              time,
              cast: [],
              pages: 0.5,
            })
          }
        }
      }
    })
    
    if (onScenesChange) {
      onScenesChange(scenes)
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
    // Требуем: ИНТ/ЭКСТ/ИНТ-ЭКСТ + пробел + заглавная буква (начало локации)
    const headerPattern = /^(\d+(?:-\d+)?\.\s*)?(ИНТ\.?|ЭКСТ\.?|ИНТ-ЭКСТ\.?)(\s+[А-ЯЁA-Z]|\.?$)/i
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
      // Если это sceneHeader — сначала меняем тип, потом оборачиваем в SceneNode
      if (newType === 'sceneHeader') {
        const sceneId = `scene-${Date.now()}`
        editor.chain()
          .setNode('sceneHeader')
          .wrapIn('scene', { id: sceneId, seriesNumber: currentSeries, sceneNumber: 1 })
          .run()
      } else {
        editor.chain().setNode(newType).run()
      }
    }
    
    // Нормализация текста шапки — всегда капслок + авто-нумерация серий
    if (currentType === 'sceneHeader' || newType === 'sceneHeader') {
      let upperText = textContent.toUpperCase()
      
      // Авто-нумерация серий для сериалов
      if (projectType === 'serial' && currentSeries > 0) {
        // Паттерн: "1. ИНТ." или "1 ИНТ." → "1-1. ИНТ."
        const sceneNumberPattern = /^(\d+)(?:\.|\s+)(ИНТ\.?|ЭКСТ\.?|ИНТ-ЭКСТ\.?)/i
        const match = upperText.match(sceneNumberPattern)
        
        if (match) {
          const sceneNumber = match[1]
          const extType = match[2]
          // Заменяем "1. ИНТ." на "1-1. ИНТ." (где первая 1 — номер серии)
          upperText = upperText.replace(sceneNumberPattern, `${currentSeries}-${sceneNumber}. ${extType}`)
        }
      }
      
      if (upperText !== textContent) {
        // Сохраняем позицию курсора относительно начала ноды
        const cursorOffset = selection.from - $from.start()
        
        // Заменяем текст на капслок + номер серии
        const nodeStart = $from.start()
        const nodeEnd = $from.end()
        editor
          .chain()
          .deleteRange({ from: nodeStart, to: nodeEnd })
          .insertContent(upperText)
          .setTextSelection(nodeStart + cursorOffset)
          .run()
      }
      
      // Если время закончилось точкой — переходим на новую строку (только один раз)
      const timePattern = /\s(ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ)\.$/
      if (timePattern.test(upperText)) {
        // Создаём уникальный ключ для шапки (позиция + текст)
        const headerKey = `${$from.pos}-${upperText}`
        
        // Только если эту шапку ещё не обрабатывали
        if (!processedHeadersRef.current.has(headerKey)) {
          processedHeadersRef.current.add(headerKey)
          // Создаём новый блок для списка персонажей (cast)
          editor.chain().splitBlock().setNode('sceneCast').run()
        }
      }
    }
  }

  // Загружаем сохранённый черновик при монтировании
  useEffect(() => {
    if (editor) {
      const saved = localStorage.getItem('kinoplan_tiptap_draft')
      if (saved) {
        editor.commands.setContent(saved)
        // Сбрасываем отслеживание при загрузке нового контента
        processedHeadersRef.current.clear()
      }
    }
  }, [editor])

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
          {(editor.getText().length / 2500).toFixed(1)} стр.
        </span>
      </div>

      {/* SmartType Popup */}
      <SmartTypePopup
        editor={editor}
        suggestions={smartType.suggestions}
        activeIndex={smartType.activeIndex}
        isOpen={smartType.isOpen}
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
