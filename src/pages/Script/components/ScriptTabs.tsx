import { FileText, BookOpen, Hash, Settings, Clock, AlignLeft } from 'lucide-react'
import type { ScriptTab } from '../useScriptPageLogic'

interface ScriptTabsProps {
  isDark: boolean
  border: string
  activeTab: ScriptTab
  onTabChange: (tab: ScriptTab) => void
}

const TABS: { id: ScriptTab; label: string; icon: typeof FileText }[] = [
  { id: 'text', label: 'ТЕКСТ', icon: FileText },
  { id: 'title', label: 'ТИТУЛ', icon: BookOpen },
  { id: 'breakdown', label: 'РАЗБИВКА', icon: Hash },
  { id: 'cards', label: 'КАРТОЧКИ', icon: Hash },
  { id: 'development', label: 'РАЗРАБОТКА', icon: Settings },
  { id: 'plan', label: 'ПЛАН', icon: Clock },
  { id: 'statistics', label: 'СТАТИСТИКА', icon: AlignLeft },
]

export default function ScriptTabs({ isDark, border, activeTab, onTabChange }: ScriptTabsProps) {
  return (
    <div className="shrink-0 px-6 py-3 border-b"
      style={{ background: isDark ? 'rgba(15,15,26,0.8)' : 'rgba(248,250,252,0.9)', borderColor: border }}>
      <div className="flex items-center gap-1 p-1 rounded-xl"
        style={{
          background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
          boxShadow: isDark ? 'inset 0 2px 4px rgba(0,0,0,0.4)' : 'inset 0 2px 4px rgba(0,0,0,0.06)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          width: 'fit-content'
        }}>
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 relative"
              style={{
                background: isActive
                  ? (isDark ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.95)')
                  : 'transparent',
                color: isActive
                  ? '#ffffff'
                  : (isDark ? '#9ca3af' : '#64748b'),
                boxShadow: isActive
                  ? (isDark ? '0 2px 8px rgba(99,102,241,0.4)' : '0 2px 8px rgba(99,102,241,0.3)')
                  : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                  ;(e.currentTarget as HTMLElement).style.color = isDark ? '#d1d5db' : '#374151'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = isDark ? '#9ca3af' : '#64748b'
                }
              }}
            >
              <Icon size={12} style={{ opacity: isActive ? 1 : 0.7 }} />
              <span style={{ letterSpacing: '0.02em' }}>{tab.label}</span>
              {isActive && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/50" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
