import { ChevronLeft, Save, Settings, X, ChevronRight, AlertTriangle, HelpCircle, Clock } from 'lucide-react'
import type { Scene, Script } from '../../../store/scriptStore'
import { calculateSceneTiming } from '../../../utils/sceneTiming'

interface ScriptHeaderProps {
  isDark: boolean
  colors: {
    sidebarBg: string
    border: string
    textPrimary: string
    textSecondary: string
  }
  selectedScene: Scene | null
  currentScript: Script | null
  isSaving: boolean
  enableAutoFix: boolean
  rightPanelOpen: boolean
  onBack: () => void
  onSave: () => void
  onOpenSettings: () => void
  onHelp: () => void
  onToggleAutoFix: () => void
  onToggleRightPanel: () => void
}

export default function ScriptHeader({
  isDark,
  colors,
  selectedScene,
  currentScript,
  isSaving,
  enableAutoFix,
  rightPanelOpen,
  onBack,
  onSave,
  onOpenSettings,
  onHelp,
  onToggleAutoFix,
  onToggleRightPanel,
}: ScriptHeaderProps) {
  const { sidebarBg, border, textPrimary, textSecondary } = colors

  return (
    <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b"
      style={{ background: sidebarBg, borderColor: border }}>

      <div className="flex items-center gap-3">
        {/* Кнопка возврата */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
            color: isDark ? '#e5e7eb' : '#374151',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.14)' : '#e5e5e5' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0' }}
        >
          <ChevronLeft size={14} />
          Назад
        </button>
        <span style={{ color: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb' }}>|</span>

        {/* Информация о выбранной сцене */}
        <div>
          {selectedScene ? (
            <>
              <p className="text-sm font-bold" style={{ color: textPrimary }}>
                Сц. {selectedScene.number} · {selectedScene.type}. {selectedScene.location} — {selectedScene.time}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                {selectedScene.cast.map(c => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-md"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: textSecondary }}>
                    {c}
                  </span>
                ))}
                {/* Хронометраж выбранной сцены */}
                {selectedScene.pages > 0 && (
                  <>
                    <span style={{ color: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb' }}>·</span>
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: isDark ? '#10b981' : '#059669' }}>
                      <Clock size={10} />
                      {(() => {
                        const { duration } = calculateSceneTiming(
                          { pages: selectedScene.pages, charCount: selectedScene.charCount },
                          currentScript?.timingSystem || 'page',
                          currentScript?.genreCoefficient || 1.0
                        )
                        return `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
                      })()}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: textSecondary }}>
              Нет сцен — начните писать
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Кнопка Сохранить — подтверждает автосохранение */}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
          style={{
            background: 'rgba(99,102,241,0.15)',
            color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.3)',
          }}
          onMouseEnter={e => { if (!isSaving) (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.25)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)' }}
        >
          <Save size={13} />
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
        {/* Кнопка Настройки — открывает модальное окно */}
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ color: textSecondary }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title="Настройки хронометража"
        >
          <Settings size={15} />
        </button>
        {/* Кнопка Помощь — заглушка, потом мини-обучение */}
        <button
          onClick={onHelp}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ color: textSecondary }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title="Помощь"
        >
          <HelpCircle size={15} />
        </button>
        {/* Кнопка Format Assistant */}
        <button
          onClick={onToggleAutoFix}
          className="w-8 h-8 rounded-lg flex items-center justify-center relative"
          style={{
            color: enableAutoFix ? '#818cf8' : textSecondary,
            background: enableAutoFix ? 'rgba(99,102,241,0.15)' : 'transparent',
          }}
          onMouseEnter={e => !enableAutoFix && ((e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6')}
          onMouseLeave={e => !enableAutoFix && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          title="Проверка форматирования"
        >
          <AlertTriangle size={15} />
        </button>
        {/* Кнопка правой панели */}
        <button
          onClick={onToggleRightPanel}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ color: textSecondary }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          {rightPanelOpen ? <X size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>
    </div>
  )
}
