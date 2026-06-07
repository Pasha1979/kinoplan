import { useEffect, useRef, useState } from 'react'
import type { SmartTypeSuggestion } from '../hooks/useSmartType'
import { safeGetWindow } from '../utils/env'

interface SmartTypePopupProps {
  editor: any
  suggestions: SmartTypeSuggestion[]
  activeIndex: number
  isOpen: boolean
  onSelect: (suggestion: SmartTypeSuggestion) => void
  onClose: () => void
  onNavigate: (direction: 'up' | 'down') => void
  isDark?: boolean
}

export function SmartTypePopup({
  editor,
  suggestions,
  activeIndex,
  isOpen,
  onSelect,
  onClose,
  isDark = true,
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
    const win = safeGetWindow()
    
    setPosition({
      top: coords.bottom + (win?.scrollY || 0) + 5,
      left: coords.left + (win?.scrollX || 0),
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

    const win = safeGetWindow()
    win?.addEventListener('mousedown', handleClickOutside)
    return () => win?.removeEventListener('mousedown', handleClickOutside)
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
        background: isDark ? '#1a1a2e' : '#ffffff',
        borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.25)',
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)',
      }}
    >
      <div className="px-2 py-1 text-xs border-b"
        style={{ color: isDark ? '#6b7280' : '#9ca3af', borderColor: isDark ? '#1f2937' : '#e5e7eb' }}>
        SmartType (Enter — выбрать, Esc — закрыть)
      </div>
      {suggestions.map((suggestion, index) => (
        <div
          key={suggestion.id}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
          style={{
            background: index === activeIndex ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
          }}
          onClick={() => onSelect(suggestion)}
          onMouseEnter={() => {}}
        >
          <span className="text-lg">{getTypeIcon(suggestion.type)}</span>
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: isDark ? '#f1f5f9' : '#111827' }}>
              {suggestion.text}
            </div>
            <div className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
              {getTypeLabel(suggestion.type)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
