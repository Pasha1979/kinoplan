import { useState } from 'react'
import { X } from 'lucide-react'

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
  renderTab: (tabId: string, colors: HelpColors) => React.ReactNode
  onClose: () => void
}

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

export default function HelpModalBase({ isDark, title = 'Помощь', tabs, defaultTab, renderTab, onClose }: HelpModalBaseProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? tabs[0]?.id ?? '')

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
          </div>
          <button
            onClick={onClose}
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

        {/* Табы */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: `1px solid ${border}` }}>
          {tabs.map(tab => (
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
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>
          {renderTab(activeTab, { bgSecondary, border, textPrimary, textMuted })}
        </div>
      </div>
    </div>
  )
}
