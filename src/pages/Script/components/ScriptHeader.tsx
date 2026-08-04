import { memo } from 'react'
import { ChevronLeft, Save, Settings, X, ChevronRight, AlertTriangle, HelpCircle, Clock, Lock, Unlock, Search, Maximize2, Columns2, MessageSquareText, Wand2 } from 'lucide-react'
import type { Scene, Script } from '../../../store/scriptStore'
import { calculateSceneTiming, formatDuration } from '../../../utils/sceneTiming'

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
  formatLocked: boolean
  onBack: () => void
  onSave: () => void
  onOpenSettings: () => void
  onHelp: () => void
  onToggleAutoFix: () => void
  onToggleRightPanel: () => void
  onToggleFormatLock: () => void
  onOpenSearch: () => void
  isFocusMode?: boolean
  onToggleFocusMode?: () => void
  isSplitScreen?: boolean
  onToggleSplitScreen?: () => void
  dialogueActiveCharacter?: string | null
  onToggleDialoguePicker?: () => void
  onFormat?: () => void
}

function ScriptHeader({
  isDark,
  colors,
  selectedScene,
  currentScript,
  isSaving,
  enableAutoFix,
  rightPanelOpen,
  formatLocked,
  onBack,
  onSave,
  onOpenSettings,
  onHelp,
  onToggleAutoFix,
  onToggleRightPanel,
  onToggleFormatLock,
  onOpenSearch,
  isFocusMode = false,
  onToggleFocusMode,
  isSplitScreen = false,
  onToggleSplitScreen,
  dialogueActiveCharacter,
  onToggleDialoguePicker,
  onFormat,
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
                        return formatDuration(duration)
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
        {/* Кнопка Автоформатирование */}
        {onFormat && (
          <button
            onClick={onFormat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
            style={{
              background: 'rgba(168,85,247,0.15)',
              color: '#a855f7',
              border: '1px solid rgba(168,85,247,0.3)',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.25)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.15)'}
            title="Автоформатирование — распознать блоки и отформатировать"
          >
            <Wand2 size={13} />
            Формат
          </button>
        )}
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
        {/* Кнопка Dialogue Mode */}
        {onToggleDialoguePicker && (
          <button
            onClick={onToggleDialoguePicker}
            className="h-8 rounded-lg flex items-center justify-center gap-1 cursor-pointer px-2"
            style={{
              color: dialogueActiveCharacter ? '#f59e0b' : textSecondary,
              background: dialogueActiveCharacter ? 'rgba(245,158,11,0.15)' : 'transparent',
              border: dialogueActiveCharacter ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
              minWidth: 32,
            }}
            onMouseEnter={e => !dialogueActiveCharacter && ((e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6')}
            onMouseLeave={e => !dialogueActiveCharacter && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            title="Dialogue Mode — диалоги персонажа"
          >
            <MessageSquareText size={15} />
            {dialogueActiveCharacter && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dialogueActiveCharacter}
              </span>
            )}
          </button>
        )}
        {/* Кнопка Split Screen */}
        {onToggleSplitScreen && (
          <button
            onClick={onToggleSplitScreen}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{
              color: isSplitScreen ? '#818cf8' : textSecondary,
              background: isSplitScreen ? 'rgba(99,102,241,0.15)' : 'transparent',
            }}
            onMouseEnter={e => !isSplitScreen && ((e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6')}
            onMouseLeave={e => !isSplitScreen && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            title="Split Screen — два окна редактора"
          >
            <Columns2 size={15} />
          </button>
        )}
        {/* Кнопка Focus Mode */}
        {onToggleFocusMode && (
          <button
            onClick={onToggleFocusMode}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{
              color: isFocusMode ? '#818cf8' : textSecondary,
              background: isFocusMode ? 'rgba(99,102,241,0.15)' : 'transparent',
            }}
            onMouseEnter={e => !isFocusMode && ((e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6')}
            onMouseLeave={e => !isFocusMode && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            title="Focus Mode — полноэкранный режим"
          >
            <Maximize2 size={15} />
          </button>
        )}
        {/* Кнопка Поиск */}
        <button
          onClick={onOpenSearch}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ color: textSecondary }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title="Поиск (Ctrl+F)"
        >
          <Search size={15} />
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
        {/* Кнопка Замок формата */}
        <button
          onClick={onToggleFormatLock}
          className="w-8 h-8 rounded-lg flex items-center justify-center relative"
          style={{
            color: formatLocked ? '#f59e0b' : textSecondary,
            background: formatLocked ? 'rgba(245,158,11,0.15)' : 'transparent',
          }}
          onMouseEnter={e => !formatLocked && ((e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6')}
          onMouseLeave={e => !formatLocked && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          title={formatLocked ? 'Формат заблокирован — автоопределение отключено' : 'Формат открыт — автоопределение включено'}
        >
          {formatLocked ? <Lock size={15} /> : <Unlock size={15} />}
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

export default memo(ScriptHeader)
