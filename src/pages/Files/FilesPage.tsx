import { FolderOpen } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export default function FilesPage() {
  const { theme } = useUiStore()
  const isDark = theme === 'dark'
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: isDark ? '#13132a' : '#f4f4f8' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)' }}>
        <FolderOpen size={32} className="text-emerald-400" />
      </div>
      <h1 className="text-xl font-bold" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Медиатека</h1>
      <p className="text-sm text-center max-w-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Единое хранилище всех документов проекта — сценарии, раскадровки, фото локаций, контракты и прочее.
      </p>
      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>Скоро</span>
    </div>
  )
}
