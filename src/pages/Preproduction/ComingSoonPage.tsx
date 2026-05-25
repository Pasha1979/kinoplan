import type { ReactNode } from 'react'
import { useUiStore } from '../../store/uiStore'

interface Props {
  icon: ReactNode
  title: string
  description: string
  phase: string
  accentColor: string
  features: string[]
}

export default function ComingSoonPage({ icon, title, description, phase, accentColor, features }: Props) {
  const { theme } = useUiStore()
  const isDark = theme === 'dark'

  const bg = isDark ? '#13132a' : '#f8f9ff'
  const cardBg = isDark ? '#1a1a35' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: bg }}>
      <div className="max-w-lg w-full text-center">

        {/* Иконка */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl"
          style={{ background: `${accentColor}18`, border: `2px solid ${accentColor}30` }}
        >
          {icon}
        </div>

        {/* Заголовок */}
        <h1 className="text-2xl font-bold mb-2" style={{ color: textPrimary }}>{title}</h1>
        <p className="text-sm mb-2" style={{ color: textSecondary }}>{description}</p>

        {/* Бейдж фазы */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
          style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
          <span className="text-xs font-semibold" style={{ color: accentColor }}>{phase}</span>
        </div>

        {/* Карточка с планируемым функционалом */}
        <div className="rounded-2xl p-6 text-left"
          style={{ background: cardBg, border: `1px solid ${border}` }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: textSecondary }}>
            Что будет в этом модуле
          </p>
          <ul className="space-y-3">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs"
                  style={{ background: `${accentColor}20`, color: accentColor }}
                >✓</span>
                <span className="text-sm" style={{ color: textSecondary }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}
