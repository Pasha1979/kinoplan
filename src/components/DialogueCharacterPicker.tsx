import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface DialogueCharacterPickerProps {
  characters: string[]
  activeCharacter: string | null
  isDark: boolean
  onSelect: (name: string) => void
  onClose: () => void
}

export default function DialogueCharacterPicker({
  characters,
  activeCharacter,
  isDark,
  onSelect,
  onClose,
}: DialogueCharacterPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Закрыть по клику вне панели
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const bg = isDark ? '#1a1a2e' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 9000,
        minWidth: 220,
        maxWidth: 320,
        maxHeight: 320,
        overflowY: 'auto',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.55)'
          : '0 8px 32px rgba(0,0,0,0.15)',
        marginTop: 6,
        padding: '6px 0',
      }}
    >
      {/* Заголовок */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px 8px',
        borderBottom: `1px solid ${border}`,
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Диалоги персонажа
        </span>
        <button
          onClick={onClose}
          style={{ color: textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
        >
          <X size={13} />
        </button>
      </div>

      {characters.length === 0 ? (
        <div style={{ padding: '8px 12px', fontSize: 12, color: textSecondary }}>
          Персонажи не найдены
        </div>
      ) : (
        characters.map(name => {
          const isActive = activeCharacter === name
          return (
            <button
              key={name}
              onClick={() => onSelect(name)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? '#f59e0b' : textPrimary,
                background: isActive
                  ? 'rgba(245,158,11,0.12)'
                  : 'transparent',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.03em',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background =
                  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {isActive ? '✓ ' : ''}{name}
            </button>
          )
        })
      )}

      {/* Кнопка сброса — если есть активный персонаж */}
      {activeCharacter && (
        <>
          <div style={{ height: 1, background: border, margin: '4px 0' }} />
          <button
            onClick={() => onSelect(activeCharacter)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '7px 14px',
              fontSize: 11,
              color: textSecondary,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            Сбросить фильтр
          </button>
        </>
      )}
    </div>
  )
}
