import { Calendar } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export default function SchedulePage() {
  const { theme } = useUiStore()
  const isDark = theme === 'dark'

  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)' }}>
          <Calendar size={32} style={{ color: isDark ? '#818cf8' : '#6366f1' }} />
        </div>
        <p className="text-lg font-medium mb-2" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>
          Планирование
        </p>
        <p className="text-sm" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
          Стрипборд и расписание съёмок появятся в следующем обновлении
        </p>
      </div>
    </div>
  )
}
