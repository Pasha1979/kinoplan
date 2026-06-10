import { Globe } from 'lucide-react'
import type { ScriptFormat } from '../../../store/scriptStore'

interface FormatSelectModalProps {
  isDark: boolean
  textPrimary: string
  textSecondary: string
  onSelect: (format: ScriptFormat) => void
  onClose: () => void
}

export default function FormatSelectModal({ isDark, textPrimary, textSecondary, onSelect, onClose }: FormatSelectModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl"
        style={{ background: isDark ? '#1a1a35' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
        <h3 className="text-xl font-bold mb-2" style={{ color: textPrimary }}>Выберите формат сценария</h3>
        <p className="text-sm mb-6" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          Формат будет применён ко всему сценарию. Его можно изменить позже.
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => onSelect('russian')}
            className="w-full p-4 rounded-xl text-left transition-all"
            style={{
              background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Globe size={20} style={{ color: '#818cf8' }} />
              <span className="font-bold" style={{ color: textPrimary }}>Российский формат</span>
            </div>
            <p className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              1. ИНТ. КУХНЯ — ДЕНЬ<br />
              Автонумерация сцен, кириллица
            </p>
          </button>

          <button
            onClick={() => onSelect('hollywood')}
            className="w-full p-4 rounded-xl text-left transition-all"
            style={{
              background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)',
              border: '1px solid rgba(34,197,94,0.25)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Globe size={20} style={{ color: '#22c55e' }} />
              <span className="font-bold" style={{ color: textPrimary }}>Голливудский формат</span>
            </div>
            <p className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              INT. KITCHEN - DAY<br />
              Международный стандарт, латиница
            </p>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: textSecondary }}
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
