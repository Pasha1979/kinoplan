import { Sun, Moon, Bell, Lock, Globe, Database, Trash2, ChevronRight } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export default function SettingsPage() {
  const { theme, toggleTheme } = useUiStore()
  const isDark = theme === 'dark'

  const bg = isDark ? '#0f0f20' : '#f5f7fa'
  const cardBg = isDark ? '#1a1a35' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'
  const sectionLabel = isDark ? '#4b5563' : '#d1d5db'

  const ComingSoonRow = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
    <div className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: `1px solid ${border}` }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: textSecondary }}>{icon}</span>
        <span className="text-sm font-medium" style={{ color: textSecondary }}>{label}</span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)', color: isDark ? '#818cf8' : '#6366f1' }}
        >
          Скоро
        </span>
      </div>
      <ChevronRight size={16} style={{ color: sectionLabel }} />
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: bg }}>
      <div className="max-w-2xl mx-auto px-6 py-8">

        <h1 className="text-2xl font-bold mb-8" style={{ color: textPrimary }}>Настройки</h1>

        {/* ─── Внешний вид ─── */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1"
          style={{ color: sectionLabel }}>Внешний вид</p>

        <div className="rounded-2xl overflow-hidden mb-6"
          style={{ background: cardBg, border: `1px solid ${border}` }}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              {isDark
                ? <Moon size={18} style={{ color: '#818cf8' }} />
                : <Sun size={18} style={{ color: '#f59e0b' }} />
              }
              <div>
                <p className="text-sm font-medium" style={{ color: textPrimary }}>Тема оформления</p>
                <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
                  {isDark ? 'Тёмная тема' : 'Светлая тема'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                color: isDark ? '#818cf8' : '#6366f1',
                border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}`,
              }}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              {isDark ? 'Светлая' : 'Тёмная'}
            </button>
          </div>

          <ComingSoonRow icon={<Globe size={18} />} label="Язык интерфейса" />

          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span style={{ color: textSecondary }}><Globe size={18} /></span>
              <span className="text-sm font-medium" style={{ color: textSecondary }}>Размер шрифта</span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)', color: isDark ? '#818cf8' : '#6366f1' }}
              >
                Скоро
              </span>
            </div>
          </div>
        </div>

        {/* ─── Уведомления ─── */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1"
          style={{ color: sectionLabel }}>Уведомления</p>

        <div className="rounded-2xl overflow-hidden mb-6"
          style={{ background: cardBg, border: `1px solid ${border}` }}
        >
          <ComingSoonRow icon={<Bell size={18} />} label="Push-уведомления" />
          <ComingSoonRow icon={<Bell size={18} />} label="Email-уведомления" />
        </div>

        {/* ─── Данные ─── */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1"
          style={{ color: sectionLabel }}>Данные и безопасность</p>

        <div className="rounded-2xl overflow-hidden mb-6"
          style={{ background: cardBg, border: `1px solid ${border}` }}
        >
          <ComingSoonRow icon={<Database size={18} />} label="Резервное копирование" />
          <ComingSoonRow icon={<Lock size={18} />} label="Конфиденциальность" />
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Trash2 size={18} style={{ color: '#f87171' }} />
              <span className="text-sm font-medium" style={{ color: '#f87171' }}>Очистить кэш</span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}
              >
                Скоро
              </span>
            </div>
          </div>
        </div>

        {/* ─── О приложении ─── */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1"
          style={{ color: sectionLabel }}>О приложении</p>

        <div className="rounded-2xl overflow-hidden"
          style={{ background: cardBg, border: `1px solid ${border}` }}
        >
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${border}` }}
          >
            <span className="text-sm font-medium" style={{ color: textSecondary }}>Версия</span>
            <span className="text-sm font-mono" style={{ color: textSecondary }}>0.1.0-alpha</span>
          </div>
          <div className="px-5 py-4">
            <span className="text-sm font-medium" style={{ color: textSecondary }}>КиноПлан — инструмент кинопроизводства</span>
          </div>
        </div>

      </div>
    </div>
  )
}
