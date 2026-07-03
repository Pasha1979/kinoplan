import { useState, useRef, useCallback } from 'react'
import { Minimize2 } from 'lucide-react'

interface FocusModeOverlayProps {
  scriptTitle?: string
  isDark: boolean
  onExit: () => void
}

export default function FocusModeOverlay({ scriptTitle, isDark, onExit }: FocusModeOverlayProps) {
  const [barVisible, setBarVisible] = useState(false)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showBar = useCallback(() => {
    setBarVisible(true)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => setBarVisible(false), 2200)
  }, [])

  const keepBar = useCallback(() => {
    setBarVisible(true)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
  }, [])

  const startHide = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => setBarVisible(false), 600)
  }, [])

  return (
    <>
      {/* Невидимая зона-триггер в верхней части экрана */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 12,
          zIndex: 9999,
          cursor: 'default',
        }}
        onMouseEnter={showBar}
      />

      {/* Floating bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: isDark
            ? 'rgba(17, 17, 38, 0.88)'
            : 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: isDark
            ? '1px solid rgba(255,255,255,0.07)'
            : '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          transform: barVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: barVisible ? 'auto' : 'none',
        }}
        onMouseEnter={keepBar}
        onMouseLeave={startHide}
      >
        {/* Название сценария */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isDark ? '#f1f5f9' : '#111827',
            opacity: 0.85,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100% - 160px)',
          }}
        >
          {scriptTitle || 'Сценарий'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              color: isDark ? '#9ca3af' : '#6b7280',
              letterSpacing: '0.03em',
            }}
          >
            Focus Mode · Escape для выхода
          </span>
          <button
            onClick={onExit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
              color: isDark ? '#e5e7eb' : '#374151',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
            }}
          >
            <Minimize2 size={13} />
            Выйти
          </button>
        </div>
      </div>
    </>
  )
}
