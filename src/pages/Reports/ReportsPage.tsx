import { ClipboardCheck } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export default function ReportsPage() {
  const { theme } = useUiStore()
  const isDark = theme === 'dark'
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: isDark ? '#13132a' : '#f4f4f8' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)' }}>
        <ClipboardCheck size={32} className="text-orange-400" />
      </div>
      <h1 className="text-xl font-bold" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Производственные отчёты</h1>
      <p className="text-sm text-center max-w-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Ввод факта съёмки за день — что сняли, что перенесли, выработка за смену.
      </p>
      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c' }}>Скоро</span>
    </div>
  )
}
