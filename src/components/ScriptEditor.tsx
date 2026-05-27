import { useState, useRef, useEffect } from 'react'
import type { ScriptFormat } from '../store/scriptStore'

type BlockType = 'scene_header' | 'action' | 'character' | 'dialog' | 'parenthetical' | 'transition'

interface Block {
  id: string
  type: BlockType
  content: string
}

interface ScriptEditorProps {
  format: ScriptFormat
  fontFamily: string
  fontSize: number
  isDark: boolean
  genreCoefficient: number
  onSceneCountChange?: (count: number) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
}

export default function ScriptEditor({ format, fontFamily, fontSize, isDark, genreCoefficient, onSceneCountChange, onStatsChange }: ScriptEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: '1', type: 'scene_header', content: '' },
  ])
  const [showTutorial, setShowTutorial] = useState(true)
  const editorRef = useRef<HTMLDivElement>(null)

  // Проверяем, начал ли пользователь писать
  const hasContent = blocks.some(b => b.content.trim().length > 0)

  // Подсчёт статистики
  useEffect(() => {
    // Количество сцен
    const scenes = blocks.filter(b => b.type === 'scene_header').length

    // Подсчёт страниц (примерно: 1 страница = 2500 символов для action блоков)
    const actionBlocks = blocks.filter(b => b.type === 'action')
    const totalCharacters = actionBlocks.reduce((sum, b) => sum + b.content.length, 0)
    const pages = totalCharacters > 0 ? totalCharacters / 2500 : 0

    // Хронометраж: 1 страница = 55 секунд × жанровый коэффициент
    const duration = pages * 55 * genreCoefficient

    // Сообщаем родителю
    if (onSceneCountChange) {
      onSceneCountChange(scenes)
    }
    if (onStatsChange) {
      onStatsChange({ scenes, pages, duration })
    }
  }, [blocks, genreCoefficient, onSceneCountChange, onStatsChange])

  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const editorBg = isDark ? '#111126' : '#fefefe'

  // Отступы по форматам
  const getIndent = (type: BlockType) => {
    if (format === 'russian') {
      switch (type) {
        case 'scene_header': return '0px'
        case 'action': return '0px'
        case 'character': return '150px'
        case 'dialog': return '100px'
        case 'parenthetical': return '200px'
        case 'transition': return '300px'
        default: return '0px'
      }
    } else {
      // Голливудский (WGA)
      switch (type) {
        case 'scene_header': return '0px'
        case 'action': return '0px'
        case 'character': return '250px'
        case 'dialog': return '150px'
        case 'parenthetical': return '200px'
        case 'transition': return '350px'
        default: return '0px'
      }
    }
  }

  const getWidth = () => {
    // Все блоки на полную ширину
    return '100%'
  }

  // Автоопределение типа блока по содержимому
  const detectBlockType = (content: string): BlockType => {
    const trimmed = content.trim().toUpperCase()
    
    // Заголовок сцены: начинается с цифры и точки
    if (/^\d+\./.test(trimmed)) {
      return 'scene_header'
    }
    
    // Переход: содержит слова НАПЛЫВ, РАСТЯЖКА, ПЕРЕХОД и т.д.
    if (/НАПЛЫВ|РАСТЯЖКА|ПЕРЕХОД|ПРИБЛИЖЕНИЕ|ОТЪЕЗД/.test(trimmed)) {
      return 'transition'
    }
    
    // Ремарка: в скобках
    if (/^\(.*\)$/.test(content.trim())) {
      return 'parenthetical'
    }
    
    // Персонаж: короткая строка в верхнем регистре без цифр
    if (trimmed.length < 30 && /^[А-ЯA-Z\s]+$/.test(trimmed) && !/\d/.test(trimmed)) {
      return 'character'
    }
    
    // По умолчанию - действие
    return 'action'
  }

  const getUppercase = (type: BlockType) => {
    return type === 'scene_header' || type === 'character' || type === 'transition'
  }

  const handleKeyDown = (e: React.KeyboardEvent, blockId: string) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      // Tab переключает тип блока
      const blockIndex = blocks.findIndex(b => b.id === blockId)
      if (blockIndex === -1) return

      const types: BlockType[] = ['scene_header', 'action', 'character', 'dialog', 'parenthetical', 'transition']
      const currentType = blocks[blockIndex].type
      const currentIndex = types.indexOf(currentType)
      const nextIndex = e.shiftKey ? (currentIndex - 1 + types.length) % types.length : (currentIndex + 1) % types.length

      setBlocks(blocks.map((b, i) => 
        i === blockIndex ? { ...b, type: types[nextIndex] } : b
      ))
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Enter создаёт новый блок
      const blockIndex = blocks.findIndex(b => b.id === blockId)
      if (blockIndex === -1) return

      const currentBlock = blocks[blockIndex]
      let nextType: BlockType = 'action'

      // Определяем тип следующего блока
      if (currentBlock.type === 'scene_header') nextType = 'action'
      else if (currentBlock.type === 'action') nextType = 'character'
      else if (currentBlock.type === 'character') nextType = 'dialog'
      else if (currentBlock.type === 'dialog') nextType = 'character'
      else if (currentBlock.type === 'parenthetical') nextType = 'dialog'
      else if (currentBlock.type === 'transition') nextType = 'scene_header'

      const newBlock: Block = {
        id: crypto.randomUUID(),
        type: nextType,
        content: '',
      }

      const newBlocks = [...blocks]
      newBlocks.splice(blockIndex + 1, 0, newBlock)
      setBlocks(newBlocks)

      // Фокус на новый блок
      setTimeout(() => {
        const newBlockEl = document.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLTextAreaElement
        if (newBlockEl) newBlockEl.focus()
      }, 0)
    }

    if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter — новая строка в том же блоке
      // Разрешаем стандартное поведение
    }
  }

  const handleContentChange = (blockId: string, content: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId) {
        // Автоопределение типа блока если контент изменился
        const autoType = detectBlockType(content)
        return { ...b, content, type: autoType }
      }
      return b
    }))
  }

  return (
    <div 
      ref={editorRef}
      className="flex-1 overflow-y-auto py-10 px-8 relative"
      style={{ background: editorBg }}
    >
      {/* Окно обучения */}
      {showTutorial && (
        <div className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="max-w-lg p-8 rounded-2xl"
            style={{ background: isDark ? '#1a1a35' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: textPrimary }}>Как пользоваться редактором</h3>
            <ul className="space-y-3 text-sm mb-6" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
              <li><strong>Tab</strong> — переключить тип блока</li>
              <li><strong>Shift+Tab</strong> — переключить назад</li>
              <li><strong>Enter</strong> — создать новый блок</li>
              <li><strong>Shift+Enter</strong> — новая строка в том же блоке</li>
            </ul>
            <button
              onClick={() => setShowTutorial(false)}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#ffffff' }}
            >
              Понятно, начинаю писать
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto" style={{ fontFamily: `${fontFamily}, monospace`, fontSize: `${fontSize}pt` }}>
        {/* Объяснение если сценарий пустой */}
        {!hasContent && (
          <div className="py-10 text-center mb-4">
            <h3 className="text-sm font-bold mb-2" style={{ color: textPrimary }}>
              Начните писать сценарий
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
              Нажмите <strong>Tab</strong> для переключения типа блока,<br />
              <strong>Enter</strong> для создания нового блока
            </p>
          </div>
        )}

        {/* Блоки сценария */}
        {blocks.map((block) => (
          <div
            key={block.id}
            data-block-id={block.id}
            className="mb-3 w-full"
          >
            <textarea
              value={block.content}
              onChange={(e) => handleContentChange(block.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, block.id)}
              className="w-full bg-transparent resize-none outline-none text-sm leading-relaxed"
              style={{
                color: textPrimary,
                lineHeight: '1.8',
                textTransform: getUppercase(block.type) ? 'uppercase' : 'none',
                minHeight: 
                  block.type === 'action' ? '90px' : 
                  block.type === 'scene_header' ? '60px' : 
                  block.type === 'dialog' ? '60px' : 
                  block.type === 'parenthetical' ? '40px' : 
                  block.type === 'transition' ? '40px' : '30px',
                fontWeight: block.type === 'character' ? 'bold' : 'normal',
              }}
              rows={
                block.type === 'action' ? 4 : 
                block.type === 'scene_header' ? 3 : 
                block.type === 'dialog' ? 3 : 
                block.type === 'parenthetical' ? 2 : 
                block.type === 'transition' ? 2 : 1
              }
              placeholder={block.type === 'scene_header' ? '1. ИНТ. ЛОКАЦИЯ — ДЕНЬ' : ''}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
