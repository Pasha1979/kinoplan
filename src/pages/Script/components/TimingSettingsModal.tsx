import { useState } from 'react'
import { X } from 'lucide-react'
import type { ScriptFormat, TimingSystem } from '../../../store/scriptStore'

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

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="max-w-md w-full mx-4 p-6 rounded-2xl"
        style={{ background: isDark ? '#1a1a35' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: textPrimary }}>Настройки сценария</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: textSecondary }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Переключатель языка формата */}
        <div className="mb-4 p-3 rounded-xl"
          style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
          <label className="text-xs font-medium mb-2 block" style={{ color: textPrimary }}>
            Формат сценария
          </label>
          <div className="flex items-center gap-1 p-1 rounded-lg"
            style={{ background: isDark ? 'rgba(0,0,0,0.3)' : '#e5e7eb' }}>
            <button
              onClick={() => {
                setTempFormat('russian')
                onFormatSwitch('russian')
              }}
              className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
              style={{
                background: tempFormat === 'russian'
                  ? (isDark ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.95)')
                  : 'transparent',
                color: tempFormat === 'russian' ? '#ffffff' : (isDark ? '#9ca3af' : '#64748b'),
                boxShadow: tempFormat === 'russian' ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
              }}
            >
              🇷🇺 Русский (RU)
            </button>
            <button
              onClick={() => {
                setTempFormat('hollywood')
                onFormatSwitch('hollywood')
              }}
              className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
              style={{
                background: tempFormat === 'hollywood'
                  ? (isDark ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.95)')
                  : 'transparent',
                color: tempFormat === 'hollywood' ? '#ffffff' : (isDark ? '#9ca3af' : '#64748b'),
                boxShadow: tempFormat === 'hollywood' ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
              }}
            >
              🇺🇸 Hollywood (EN)
            </button>
          </div>
          <p className="text-[10px] mt-2" style={{ color: textSecondary }}>
            Переключает форматирование сценария между русским и голливудским стандартом
          </p>
        </div>

        <p className="text-sm mb-4" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          Выберите систему расчёта хронометража для сценария.
        </p>

        {/* Система хронометража */}
        <div className="mb-4">
          <label className="text-xs font-medium mb-2 block" style={{ color: textPrimary }}>
            Система расчёта
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'page' as TimingSystem, label: 'Постраничный', tooltip: '1 страница = 55 секунд' },
              { value: 'character' as TimingSystem, label: 'Посимвольный', tooltip: '1 символ = 0.05 секунды' },
              { value: 'flexible' as TimingSystem, label: 'Гибкий', tooltip: 'Страницы + диалоги' },
              { value: 'manual' as TimingSystem, label: 'Ручной', tooltip: 'Установка вручную' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTempTimingSystem(option.value)}
                className="p-3 rounded-lg text-left transition-all text-xs"
                style={{
                  background: tempTimingSystem === option.value ? 'rgba(99,102,241,0.15)' : isDark ? 'rgba(255,255,255,0.03)' : '#f3f4f6',
                  border: `1px solid ${tempTimingSystem === option.value ? 'rgba(99,102,241,0.3)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: tempTimingSystem === option.value ? '#818cf8' : textPrimary,
                }}
                title={option.tooltip}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-[10px] mt-1" style={{ color: textSecondary }}>
                  {option.tooltip}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Жанровый коэффициент */}
        <div className="mb-6">
          <label className="text-xs font-medium mb-2 block" style={{ color: textPrimary }}>
            Жанровый коэффициент
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'auto', label: 'Авто (1.0)' },
              { value: '0.9', label: '0.9 (Мюзикл)' },
              { value: '1.15', label: '1.15 (Комедия)' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTempGenreCoefficient(option.value)}
                className="p-2 rounded-lg text-center transition-all text-xs"
                style={{
                  background: tempGenreCoefficient === option.value ? 'rgba(99,102,241,0.15)' : isDark ? 'rgba(255,255,255,0.03)' : '#f3f4f6',
                  border: `1px solid ${tempGenreCoefficient === option.value ? 'rgba(99,102,241,0.3)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: tempGenreCoefficient === option.value ? '#818cf8' : textPrimary,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: textSecondary }}
          >
            Отмена
          </button>
          <button
            onClick={() => onApply(tempTimingSystem, tempGenreCoefficient)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  )
}
