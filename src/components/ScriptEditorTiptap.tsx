import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback } from 'react'
import type { ScriptFormat } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { SceneHeader, SceneAction, SceneCharacter, SceneDialog, SceneTransition } from './tiptap'
import { Film, AlignLeft, User, MessageSquare, ArrowRight } from 'lucide-react'
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
}

export default function ScriptEditorTiptap({
  format,
  projectType,
  currentSeries,
  fontFamily,
  fontSize,
  isDark,
  onScenesChange,
}: ScriptEditorTiptapProps) {
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const editorBg = isDark ? '#111126' : '#fefefe'

  // SmartType — подсказки при наборе
  const smartType = useSmartType({
    characters: ['ПЕТЯ', 'МАША', 'ВАСЯ', 'ОЛЯ', 'ДИМА'],
    locations: ['КВАРТИРА', 'ПАРК', 'ОФИС', 'УЛИЦА', 'КАФЕ'],
    times: ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ'],
  })

  const editor = useEditor({
    extensions: [
      StarterKit,
      SceneHeader,
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
        class: 'prose prose-sm max-w-none focus:outline-none',
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
        
        return false // Пропускаем остальные клавиши
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const text = editor.getText()
      
      // Сохраняем в localStorage
      localStorage.setItem('kinoplan_tiptap_draft', html)
      
      // Парсим сцены для списка
      parseScenes(text)
      
      // Автоопределение типа блока
      autoDetectBlockType(editor)
      
      // SmartType — обновляем подсказки
      const { state } = editor
      const { selection } = state
      const { $from } = selection
      const currentType = getCurrentBlockType(editor)
      
      // Получаем текст текущей ноды и позицию внутри неё
      const currentNode = $from.node()
      const nodeText = currentNode?.textContent || ''
      const nodeStartPos = $from.start()
      const posInNode = selection.from - nodeStartPos
      
      smartType.updateSuggestions(nodeText, posInNode, currentType)
    },
  })

  // Парсинг сцен из текста
  const parseScenes = (text: string) => {
    const lines = text.split('\n')
    const scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number }> = []
    let sceneIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Проверяем шапку сцены: 1. ИНТ. ЛОКАЦИЯ — ДЕНЬ
      const headerMatch = line.match(/^(?:\d+(?:-\d+)?\.\s*)?([ИЭ]К?С?Т?\.?)\s+(.+)$/i)
      
      if (headerMatch) {
        sceneIndex++
        const sceneType = headerMatch[1].toUpperCase().startsWith('Э') ? 'ЭКСТ' : 'ИНТ'
        const locationPart = headerMatch[2]
        
        // Разделяем локацию и время
        const parts = locationPart.split(/[—–\-]/)
        const location = parts[0]?.trim().replace(/\.$/, '') || ''
        const time = parts[parts.length - 1]?.trim().replace(/\.$/, '') || 'ДЕНЬ'

        scenes.push({
          id: `scene-${sceneIndex}`,
          number: projectType === 'serial' ? `${currentSeries}-${sceneIndex}` : String(sceneIndex),
          type: sceneType,
          location,
          time,
          cast: [],
          pages: 0.5,
        })
      }
    }

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
    
    // 1. Шапка сцены: ИНТ. / ЭКСТ. / И. / Э. / ИНТ.-ЭКСТ.
    // Поддерживает: "1. ИНТ.", "1-1. ИНТ.", "5. ЭКСТ.", просто "ИНТ."
    const headerPattern = /^(\d+(?:-\d+)?\.\s*)?(ИНТ\.?|И\.?|ЭКСТ\.?|Э\.?|ИНТ-ЭКСТ\.?)(\s+|$)/i
    if (headerPattern.test(textContent)) {
      newType = 'sceneHeader'
    }
    // 2. Переходы: РАССВЕТ, ЗАТЕМНЕНИЕ, ПЕРЕХОД, СМЕНА
    else if (/^(РАССВЕТ|ЗАТЕМНЕНИЕ|ПЕРЕХОД|СМЕНА|CUT TO|FADE IN|FADE OUT)$/i.test(textContent)) {
      newType = 'sceneTransition'
    }
    // 3. Персонаж: капслок, 2-25 символов
    // Поддерживаем русский и английский капслок
    else if (
      textContent.length >= 2 && 
      textContent.length <= 25 &&
      !textContent.includes('.') && // Без точек
      textContent === textContent.toUpperCase() && // Точно капслок
      /^[А-ЯЁA-Z\s\-']+$/.test(textContent) && // Только буквы, пробелы, дефисы
      /[А-ЯЁA-Z]/.test(textContent) // Хотя бы одна буква
    ) {
      newType = 'sceneCharacter'
    }
    // 4. Диалог: если после персонажа (проверяем предыдущий блок)
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
    
    // Нормализация текста шапки — всегда капслок
    if (currentType === 'sceneHeader' || newType === 'sceneHeader') {
      const upperText = textContent.toUpperCase()
      if (upperText !== textContent) {
        // Заменяем текст на капслок
        const nodeStart = $from.start()
        const nodeEnd = $from.end()
        editor
          .chain()
          .deleteRange({ from: nodeStart, to: nodeEnd })
          .insertContent(upperText)
          .run()
      }
      
      // Если время закончилось точкой — переходим на новую строку
      const timePattern = /\s(ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ)\.$/
      if (timePattern.test(upperText)) {
        // Создаём новый блок действия
        editor.chain().splitBlock().setNode('sceneAction').run()
      }
    }
  }

  // Загружаем сохранённый черновик при монтировании
  useEffect(() => {
    if (editor) {
      const saved = localStorage.getItem('kinoplan_tiptap_draft')
      if (saved) {
        editor.commands.setContent(saved)
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
        className="flex-1 overflow-y-auto p-8"
        style={{
          background: editorBg,
          color: textPrimary,
        }}
      >
        <EditorContent
          editor={editor}
          className="h-full tiptap-editor"
          style={{
            fontFamily,
            fontSize: `${fontSize}pt`,
            lineHeight: '1.5',
          }}
        />
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
