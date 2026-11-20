import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

export interface HelpTab {
  id: string
  label: string
  icon: React.ReactNode
}

export interface HelpColors {
  bgSecondary: string
  border: string
  textPrimary: string
  textMuted: string
}

interface HelpModalBaseProps {
  isDark: boolean
  title?: string
  tabs: HelpTab[]
  defaultTab?: string
  renderTab: (tabId: string, colors: HelpColors, query: string) => React.ReactNode
  /** число совпадений поиска на вкладке — бейдж на табе + автопереключение */
  countMatches?: (tabId: string, query: string) => number
  onClose: () => void
}

declare const __APP_VERSION__: string | undefined

export function KeyBadge({ k }: { k: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: 5,
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 600,
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(99,102,241,0.3)',
        color: '#818cf8',
        whiteSpace: 'nowrap',
      }}
    >
      {k}
    </span>
  )
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function HelpModalBase({ isDark, title = 'Помощь', tabs, defaultTab, renderTab, countMatches, onClose }: HelpModalBaseProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? tabs[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const restoreFocusRef = useRef<Element | null>(null)

  // Начальный фокус → поле поиска; запоминаем триггер для возврата фокуса
  useEffect(() => {
    restoreFocusRef.current = document.activeElement
    searchRef.current?.focus()
    // Блокировка прокрутки фона под модалкой
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      ;(restoreFocusRef.current as HTMLElement | null)?.focus?.()
    }
  }, [])

  // Escape — capture: закрываем сами и не пускаем клавишу в Focus/Dialogue-режимы
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onClose()
        return
      }
      // Фокус-трап: Tab ходит по элементам модалки по кругу
      if (e.key === 'Tab' && dialogRef.current) {
        const els = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
          .filter((el) => el.offsetParent !== null)
        if (!els.length) return
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // Автопереключение: на активной вкладке 0 совпадений, а на других есть → туда
  useEffect(() => {
    if (!countMatches || !query.trim()) return
    if (countMatches(activeTab, query) > 0) return
    const first = tabs.find((t) => countMatches(t.id, query) > 0)
    if (first) setActiveTab(first.id)
  }, [query, activeTab, tabs, countMatches])

  const bg         = isDark ? '#1e1e2e' : '#ffffff'
  const bgSecondary= isDark ? '#252535' : '#f8f9fc'
  const border     = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const textPrimary= isDark ? '#f1f5f9' : '#111827'
  const textMuted  = isDark ? '#9ca3af' : '#6b7280'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 14,
          width: 680,
          maxWidth: '95vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        {/* Шапка */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 0',
            borderBottom: `1px solid ${border}`,
            paddingBottom: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>{title}</span>
            {/* Поиск по всему контенту текущей страницы */}
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: textMuted, pointerEvents: 'none' }} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск…"
                style={{
                  width: 160, padding: '4px 24px 4px 26px', fontSize: 12,
                  borderRadius: 8, border: `1px solid ${border}`, outline: 'none',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: textPrimary,
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Очистить поиск"
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 0, display: 'flex' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть справку"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: textMuted,
              padding: 4,
              borderRadius: 6,
              marginBottom: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Табы — скроллятся по горизонтали на узких экранах */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: `1px solid ${border}`, overflowX: 'auto' }}>
          {tabs.map(tab => {
            const hits = query.trim() && countMatches ? countMatches(tab.id, query) : 0
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? '#818cf8' : textMuted,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #818cf8' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                  marginBottom: -1,
                  flexShrink: 0,
                }}
              >
                {tab.icon}
                {tab.label}
                {hits > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', background: 'rgba(129,140,248,0.15)', borderRadius: 8, padding: '0 6px', lineHeight: '16px' }}>
                    {hits}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Контент */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>
          {renderTab(activeTab, { bgSecondary, border, textPrimary, textMuted }, query)}
        </div>

        {/* Футер */}
        <div style={{ padding: '8px 20px', borderTop: `1px solid ${border}`, textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: textMuted }}>
            KinoPlan v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
          </span>
        </div>
      </div>
    </div>
  )
}
