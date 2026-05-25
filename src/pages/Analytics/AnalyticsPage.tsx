import { BarChart2 } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export default function AnalyticsPage() {
  const { theme } = useUiStore()
  const isDark = theme === 'dark'
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: isDark ? '#13132a' : '#f4f4f8' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)' }}>
        <BarChart2 size={32} className="text-orange-400" />
      </div>
      <h1 className="text-xl font-bold" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Аналитика</h1>
      <p className="text-sm text-center max-w-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Сводные отчёты по хронометражу, прогрессу съёмок, выработке за смену и отклонениям от плана.
      </p>
      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c' }}>Скоро</span>
    </div>
  )
}
