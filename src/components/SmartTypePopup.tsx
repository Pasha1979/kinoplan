import { useEffect, useRef, useState } from 'react'
import type { SmartTypeSuggestion } from '../hooks/useSmartType'

interface SmartTypePopupProps {
  editor: any
  suggestions: SmartTypeSuggestion[]
  activeIndex: number
  isOpen: boolean
  onSelect: (suggestion: SmartTypeSuggestion) => void
  onClose: () => void
  onNavigate: (direction: 'up' | 'down') => void
}

export function SmartTypePopup({
  editor,
  suggestions,
  activeIndex,
  isOpen,
  onSelect,
  onClose,
}: SmartTypePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  // Получаем позицию курсора
  useEffect(() => {
    if (!isOpen || !editor) return

    const { state } = editor
    const { selection } = state
    const { from } = selection

    // Получаем координаты курсора
    const coords = editor.view.coordsAtPos(from)
    
    setPosition({
      top: coords.bottom + window.scrollY + 5,
      left: coords.left + window.scrollX,
    })
  }, [isOpen, editor, suggestions])

  // Закрытие при клике вне
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen || suggestions.length === 0) return null

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'character': return '👤'
      case 'location': return '📍'
      case 'time': return '🕐'
      case 'prop': return '🎭'
      case 'scene_prefix': return '🎬'
      default: return '•'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'character': return 'Персонаж'
      case 'location': return 'Локация'
      case 'time': return 'Время'
      case 'prop': return 'Реквизит'
      case 'scene_prefix': return 'Тип сцены'
      default: return ''
    }
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 rounded-lg shadow-xl border overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        minWidth: '200px',
        maxWidth: '300px',
        background: '#1a1a2e',
        borderColor: 'rgba(99, 102, 241, 0.3)',
      }}
    >
      <div className="px-2 py-1 text-xs text-gray-400 border-b border-gray-700">
        SmartType (Enter — выбрать, Esc — закрыть)
      </div>
      {suggestions.map((suggestion, index) => (
        <div
          key={suggestion.id}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
          style={{
            background: index === activeIndex ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
          }}
          onClick={() => onSelect(suggestion)}
          onMouseEnter={() => {}}
        >
          <span className="text-lg">{getTypeIcon(suggestion.type)}</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">
              {suggestion.text}
            </div>
            <div className="text-xs text-gray-500">
              {getTypeLabel(suggestion.type)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
