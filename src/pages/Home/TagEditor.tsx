import { useState } from 'react'
import { X, Tag } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { usePopoverPosition, usePopoverClose } from './ContextMenu'

interface TagEditorProps {
  x: number
  y: number
  tags: string[]
  onChange: (tags: string[]) => void
  onClose: () => void
}

export default function TagEditor({ x, y, tags, onChange, onClose }: TagEditorProps) {
  const { theme } = useUiStore()
  const { ref, style } = usePopoverPosition(x, y)
  usePopoverClose(onClose)
  const [input, setInput] = useState('')
  const isDark = theme === 'dark'

  const addTag = () => {
    const tag = input.trim()
    if (!tag) return
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onChange([...tags, tag])
    }
    setInput('')
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div
      ref={ref}
      style={style}
      data-popover
      className={`w-64 rounded-xl border shadow-xl p-3 ${
        isDark ? 'bg-[#1e1e3a] border-white/12 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-300/50'
      }`}
    >
      <div className={`text-xs font-medium mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <Tag size={12} />
        Теги проекта
      </div>

      {/* Текущие теги */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-100 text-orange-700'
              }`}
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="opacity-60 hover:opacity-100"
                title="Убрать тег"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Добавление тега */}
      <input
        autoFocus
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag()
          }
        }}
        placeholder="Новый тег, Enter — добавить"
        className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none transition-colors ${
          isDark
            ? 'bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-orange-500/40'
            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400'
        }`}
      />
    </div>
  )
}
