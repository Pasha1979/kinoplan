import { useState } from 'react'
import {
  X,
  Settings,
  Globe,
  Clock,
  Sliders,
  Type,
  HelpCircle,
  Check,
  Music,
  Laugh,
  Zap,
  FileText,
  Film,
} from 'lucide-react'
import type { ScriptFormat, TimingSystem } from '../../../store/scriptStore'
import { useScriptStore } from '../../../store/scriptStore'

interface TimingSettingsModalProps {
  isDark: boolean
  textPrimary: string
  textSecondary: string
  initialTimingSystem: TimingSystem
  initialGenreCoefficient: string
  initialFormat: ScriptFormat
  onFormatSwitch: (format: ScriptFormat) => void
  onApply: (timingSystem: TimingSystem, genreCoefficient: string) => void
  onClose: () => void
}

const timingOptions: Array<{
  value: TimingSystem
  label: string
  description: string
  icon: React.ReactNode
}> = [
  {
    value: 'page',
    label: 'Постраничный',
    description: '1 страница ≈ 55 секунд экранного времени',
    icon: <FileText size={18} />,
  },
  {
    value: 'character',
    label: 'Посимвольный',
    description: 'Точный подсчёт по количеству символов',
    icon: <Type size={18} />,
  },
  {
    value: 'flexible',
    label: 'Гибкий',
    description: 'Учитывает страницы и объём диалогов',
    icon: <Sliders size={18} />,
  },
  {
    value: 'manual',
    label: 'Ручной',
    description: 'Вы задаёте хронометраж для каждой сцены',
    icon: <Clock size={18} />,
  },
]

const genreOptions: Array<{
  value: string
  label: string
  description: string
  icon: React.ReactNode
}> = [
  {
    value: 'auto',
    label: 'Авто',
    description: 'Стандартный темп (1.0)',
    icon: <Zap size={16} />,
  },
  {
    value: '0.9',
    label: 'Медленный',
    description: '0.9 · Мюзиклы, мелодрамы',
    icon: <Music size={16} />,
  },
  {
    value: '1.15',
    label: 'Быстрый',
    description: '1.15 · Комедии, боевики',
    icon: <Laugh size={16} />,
  },
]

export default function TimingSettingsModal({
  isDark,
  textPrimary,
  textSecondary,
  initialTimingSystem,
  initialGenreCoefficient,
  initialFormat,
  onFormatSwitch,
  onApply,
  onClose,
}: TimingSettingsModalProps) {
  const [tempTimingSystem, setTempTimingSystem] = useState<TimingSystem>(initialTimingSystem)
  const [tempGenreCoefficient, setTempGenreCoefficient] = useState(initialGenreCoefficient)
  const [tempFormat, setTempFormat] = useState<ScriptFormat>(initialFormat)
  const showPlaceholders = useScriptStore((s) => s.showPlaceholders)
  const toggleShowPlaceholders = useScriptStore((s) => s.toggleShowPlaceholders)

  const surfaceBg = isDark ? '#1e1e3a' : '#ffffff'
  const sectionBg = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const accent = '#6366f1'
  const accentLight = '#818cf8'

  const handleFormatChange = (format: ScriptFormat) => {
    setTempFormat(format)
    onFormatSwitch(format)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: surfaceBg, border: `1px solid ${borderColor}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 rounded-t-2xl"
          style={{ background: surfaceBg, borderBottom: `1px solid ${borderColor}` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'rgba(99,102,241,0.15)', color: accentLight }}
            >
              <Settings size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: textPrimary }}>Настройки редактора</h3>
              <p className="text-[11px]" style={{ color: textSecondary }}>Формат, хронометраж и внешний вид</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: textSecondary }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Формат сценария */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} style={{ color: accentLight }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: textPrimary }}>
                Формат сценария
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleFormatChange('russian')}
                className="relative flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all"
                style={{
                  background: tempFormat === 'russian' ? 'rgba(99,102,241,0.12)' : sectionBg,
                  border: `1.5px solid ${tempFormat === 'russian' ? accent : borderColor}`,
                  color: textPrimary,
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-2xl">🇷🇺</span>
                  {tempFormat === 'russian' && (
                    <div
                      className="flex items-center justify-center w-5 h-5 rounded-full"
                      style={{ background: accent, color: '#fff' }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold">Русский</div>
                  <div className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
                    Российский стандарт оформления
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleFormatChange('hollywood')}
                className="relative flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all"
                style={{
                  background: tempFormat === 'hollywood' ? 'rgba(99,102,241,0.12)' : sectionBg,
                  border: `1.5px solid ${tempFormat === 'hollywood' ? accent : borderColor}`,
                  color: textPrimary,
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-2xl">🇺🇸</span>
                  {tempFormat === 'hollywood' && (
                    <div
                      className="flex items-center justify-center w-5 h-5 rounded-full"
                      style={{ background: accent, color: '#fff' }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold">Hollywood</div>
                  <div className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
                    Американский стандарт оформления
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* Система хронометража */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} style={{ color: accentLight }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: textPrimary }}>
                Хронометраж
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {timingOptions.map((option) => {
                const selected = tempTimingSystem === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => setTempTimingSystem(option.value)}
                    className="relative flex flex-col items-start gap-2 p-3.5 rounded-xl text-left transition-all"
                    style={{
                      background: selected ? 'rgba(99,102,241,0.12)' : sectionBg,
                      border: `1.5px solid ${selected ? accent : borderColor}`,
                      color: textPrimary,
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div style={{ color: selected ? accentLight : textSecondary }}>{option.icon}</div>
                      {selected && (
                        <div
                          className="flex items-center justify-center w-4 h-4 rounded-full"
                          style={{ background: accent, color: '#fff' }}
                        >
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{option.label}</div>
                      <div className="text-[10px] mt-0.5 leading-tight" style={{ color: textSecondary }}>
                        {option.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Жанровый коэффициент */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Film size={16} style={{ color: accentLight }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: textPrimary }}>
                Жанровый коэффициент
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {genreOptions.map((option) => {
                const selected = tempGenreCoefficient === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => setTempGenreCoefficient(option.value)}
                    className="relative flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all"
                    style={{
                      background: selected ? 'rgba(99,102,241,0.12)' : sectionBg,
                      border: `1.5px solid ${selected ? accent : borderColor}`,
                      color: textPrimary,
                    }}
                  >
                    <div style={{ color: selected ? accentLight : textSecondary }}>{option.icon}</div>
                    <div>
                      <div className="text-xs font-semibold">{option.label}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                        {option.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Подсказки в пустых блоках */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle size={16} style={{ color: accentLight }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: textPrimary }}>
                Редактор
              </span>
            </div>
            <div
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: sectionBg, border: `1px solid ${borderColor}` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{ background: 'rgba(99,102,241,0.1)', color: accentLight }}
                >
                  <Type size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: textPrimary }}>Подсказки в пустых блоках</div>
                  <div className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
                    Показывать пример текста, когда блок не заполнен
                  </div>
                </div>
              </div>
              <button
                onClick={toggleShowPlaceholders}
                className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                style={{
                  background: showPlaceholders ? accent : isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db',
                }}
                aria-checked={showPlaceholders}
                role="switch"
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{
                    left: showPlaceholders ? '24px' : '2px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </button>
            </div>
          </section>
        </div>

        {/* Подвал */}
        <div
          className="sticky bottom-0 flex gap-3 px-6 py-4 rounded-b-2xl"
          style={{ background: surfaceBg, borderTop: `1px solid ${borderColor}` }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: textSecondary }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'
            }}
          >
            Отмена
          </button>
          <button
            onClick={() => onApply(tempTimingSystem, tempGenreCoefficient)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: accent, color: '#ffffff' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#4f46e5'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = accent
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
