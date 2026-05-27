import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Save, X, FileText, Sparkles } from 'lucide-react'
import { useScriptStore } from '../../store/scriptStore'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'

export default function CreateScriptPage() {
  const navigate = useNavigate()
  const { addScript } = useScriptStore()
  const { getCurrentProject } = useProjectStore()
  const { theme } = useUiStore()
  const project = getCurrentProject()
  const isDark = theme === 'dark'

  const bg = isDark ? '#0f0f20' : '#f8fafc'
  const cardBg = isDark ? '#1a1a35' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const textSecondary = isDark ? '#94a3b8' : '#64748b'

  const handleCreate = () => {
    if (!project) {
      alert('Проект не выбран')
      return
    }

    const newScript = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: project.name,
      version: 'Черновик v1',
      format: 'russian' as const,
      scenes: [],
      characters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timingSystem: 'page' as const,
      genreCoefficient: 1.0,
      fontFamily: 'Courier New',
      fontSize: 12,
    }

    addScript(newScript)
    navigate(`/project/${project.id}/script`)
  }

  const handleCancel = () => {
    navigate(`/project/${project?.id}/script`)
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: bg }}>
      {/* Шапка */}
      <div className="shrink-0 flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: border }}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
              color: isDark ? '#e5e7eb' : '#374151',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            }}
          >
            <ChevronLeft size={14} />
            Отмена
          </button>
          <div>
            <h1 className="text-sm font-bold" style={{ color: textPrimary }}>Создание сценария</h1>
            {project && <p className="text-xs" style={{ color: textSecondary }}>{project.name}</p>}
          </div>
        </div>
      </div>

      {/* Форма */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-xl">
          <div className="rounded-3xl p-10 text-center" style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.4)' : '0 20px 60px rgba(0,0,0,0.08)' }}>
            
            {/* Иконка */}
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 8px 30px rgba(99,102,241,0.4)' }}>
              <FileText size={36} className="text-white" />
            </div>

            {/* Заголовок */}
            <h2 className="text-2xl font-bold mb-3" style={{ color: textPrimary }}>
              Создать сценарий
            </h2>
            <p className="text-sm mb-8" style={{ color: textSecondary }}>
              Название сценария будет совпадать с названием проекта. Настройки можно изменить позже.
            </p>

            {/* Информация о проекте */}
            {project && (
              <div className="rounded-2xl p-6 mb-8 text-left"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', border: `1px solid ${border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} style={{ color: '#818cf8' }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                    Проект
                  </span>
                </div>
                <p className="text-base font-semibold mb-1" style={{ color: textPrimary }}>
                  {project.name}
                </p>
                <p className="text-xs" style={{ color: textSecondary }}>
                  Тип: {project.type === 'film' ? 'Полнометражный фильм' : project.type === 'serial' ? 'Сериал' : project.type}
                </p>
              </div>
            )}

            {/* Кнопки */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                  color: isDark ? '#e5e7eb' : '#475569',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}
              >
                <X size={16} />
                Отмена
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  color: '#ffffff',
                  border: '1px solid rgba(99,102,241,0.3)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 25px rgba(99,102,241,0.5)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)' }}
              >
                <Save size={16} />
                Создать сценарий
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
