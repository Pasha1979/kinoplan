import { Film, Tv, Megaphone, Music, Folder, Calendar, Clock } from 'lucide-react'
import type { Project } from '../../store/projectStore'

const TYPE_LABELS: Record<Project['type'], string> = {
  serial: 'Сериал',
  film: 'Полный метр',
  ad: 'Реклама',
  clip: 'Клип',
  other: 'Другое',
}

const STATUS_LABELS: Record<Project['status'], string> = {
  preproduction: 'Пре-продакшн',
  shooting: 'В съёмке',
  postproduction: 'Пост-продакшн',
  completed: 'Завершён',
}

const STATUS_COLORS: Record<Project['status'], string> = {
  preproduction: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  shooting: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  postproduction: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
}

const TYPE_ICONS: Record<Project['type'], React.ReactNode> = {
  serial: <Tv size={18} />,
  film: <Film size={18} />,
  ad: <Megaphone size={18} />,
  clip: <Music size={18} />,
  other: <Folder size={18} />,
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface ProjectCardProps {
  project: Project
  onClick: () => void
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const overallProgress = Math.round(
    (project.scriptProgress + project.castingProgress + project.locationsProgress + project.scheduleProgress) / 4
  )

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-[#13132a] border border-white/8 rounded-2xl p-5 hover:border-orange-500/40 hover:bg-[#16163a] transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1 active:translate-y-0"
    >
      {/* Шапка карточки */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center text-orange-400">
            {TYPE_ICONS[project.type]}
          </div>
          <div>
            <h3 className="text-white font-semibold text-base leading-tight group-hover:text-orange-300 transition-colors">
              {project.name}
            </h3>
            <span className="text-gray-500 text-xs">{TYPE_LABELS[project.type]}</span>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${STATUS_COLORS[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/3 rounded-lg p-2.5 text-center">
          <div className="text-white font-semibold text-lg leading-none">{project.plannedShootingDays}</div>
          <div className="text-gray-500 text-xs mt-1">дней съёмок</div>
        </div>
        <div className="bg-white/3 rounded-lg p-2.5 text-center">
          <div className="text-white font-semibold text-lg leading-none">
            {project.type === 'serial' ? project.episodesCount ?? '—' : '—'}
          </div>
          <div className="text-gray-500 text-xs mt-1">
            {project.type === 'serial' ? 'серий' : 'мин. хронометраж'}
          </div>
        </div>
        <div className="bg-white/3 rounded-lg p-2.5 text-center">
          <div className="text-orange-400 font-semibold text-lg leading-none">{overallProgress}%</div>
          <div className="text-gray-500 text-xs mt-1">готовность</div>
        </div>
      </div>

      {/* Полоса общей готовности */}
      <div className="mb-3">
        <ProgressBar value={overallProgress} color="bg-gradient-to-r from-orange-500 to-red-500" />
      </div>

      {/* Детализация по модулям */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Сценарий</span>
          <span className="text-gray-400">{project.scriptProgress}%</span>
        </div>
        <ProgressBar value={project.scriptProgress} color="bg-blue-400" />
        <div className="flex items-center justify-between text-xs mt-2">
          <span className="text-gray-500">Расписание</span>
          <span className="text-gray-400">{project.scheduleProgress}%</span>
        </div>
        <ProgressBar value={project.scheduleProgress} color="bg-purple-400" />
      </div>

      {/* Даты */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar size={12} />
          <span>{formatDate(project.startDate)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={12} />
          <span>Изменён {formatDate(project.updatedAt)}</span>
        </div>
      </div>
    </button>
  )
}
