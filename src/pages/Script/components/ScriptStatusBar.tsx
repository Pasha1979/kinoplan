import { Hash, AlignLeft, Clock, AlertTriangle } from 'lucide-react'
import { formatDuration } from '../../../utils/sceneTiming'

interface ScriptStatusBarProps {
  isDark: boolean
  colors: {
    sidebarBg: string
    border: string
    textPrimary: string
    textSecondary: string
  }
  scenesCount: number
  seriesPages: number
  seriesDuration: number
  targetDuration?: number
}

export default function ScriptStatusBar({
  isDark,
  colors,
  scenesCount,
  seriesPages,
  seriesDuration,
  targetDuration,
}: ScriptStatusBarProps) {
  const { sidebarBg, border, textPrimary, textSecondary } = colors

  return (
    <div className="shrink-0 flex items-center gap-6 px-6 py-2 border-t"
      style={{ background: sidebarBg, borderColor: border }}>
      <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
        <Hash size={11} />
        {scenesCount} сцен
      </span>
      <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
        <AlignLeft size={11} />
        {seriesPages.toFixed(1)} стр.
      </span>
      <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
        <Clock size={11} />
        {formatDuration(seriesDuration)}
      </span>

      {/* Прогресс-бар хронометража серии (из навигатора — единый источник) */}
      {targetDuration && (
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium" style={{ color: textSecondary }}>
                Хронометраж
              </span>
              <span className="text-[10px] font-semibold" style={{
                color: seriesDuration / 60 > targetDuration ? '#ef4444' : textPrimary
              }}>
                {Math.min(100, Math.round((seriesDuration / 60 / targetDuration) * 100))}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, (seriesDuration / 60 / targetDuration) * 100)}%`,
                  background: seriesDuration / 60 > targetDuration
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : 'linear-gradient(90deg, #10b981, #34d399)'
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] shrink-0">
            <span style={{ color: textSecondary }}>
              {formatDuration(seriesDuration)} / {targetDuration}:00
            </span>
            {Math.abs(Math.round(seriesDuration / 60) - targetDuration) > 0 && (
              <span style={{
                color: seriesDuration / 60 > targetDuration ? '#ef4444' : '#10b981',
                fontWeight: 500
              }}>
                {seriesDuration / 60 > targetDuration && <AlertTriangle size={10} className="inline mr-0.5" />}
                ({seriesDuration / 60 > targetDuration ? '+' : ''}{Math.round(seriesDuration / 60) - targetDuration})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
