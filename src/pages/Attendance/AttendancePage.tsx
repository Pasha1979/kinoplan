import { ScrollText } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export default function AttendancePage() {
  const { theme } = useUiStore()
  const isDark = theme === 'dark'
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: isDark ? '#13132a' : '#f4f4f8' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.12)' }}>
        <ScrollText size={32} className="text-blue-400" />
      </div>
      <h1 className="text-xl font-bold" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Явочный лист</h1>
      <p className="text-sm text-center max-w-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Отметка присутствия членов съёмочной группы и актёров на съёмочной смене.
      </p>
      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>Скоро</span>
    </div>
  )
}
