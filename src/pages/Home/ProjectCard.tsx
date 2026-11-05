import { Film, Tv, Megaphone, Music, Folder, Calendar, Clock, Trash2, Download, Star } from 'lucide-react'
import type { Project } from '../../store/projectStore'
import { formatRelativeTime } from '../../utils/relativeTime'

export const TYPE_LABELS: Record<Project['type'], string> = {
  serial: 'Сериал',
  film: 'Полный метр',
  ad: 'Реклама',
  clip: 'Клип',
  other: 'Другое',
}

export const STATUS_LABELS: Record<Project['status'], string> = {
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
    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
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

export function getOverallProgress(project: Project): number {
  return Math.round(
    (project.scriptProgress + project.castingProgress + project.locationsProgress + project.scheduleProgress) / 4
  )
}

interface ProjectCardProps {
  project: Project
  onClick: () => void
  onDelete: () => void
  onExport?: () => void
  onToggleFavorite?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  cardHeight?: number
}

export default function ProjectCard({ project, onClick, onDelete, onExport, onToggleFavorite, onContextMenu, cardHeight }: ProjectCardProps) {
  const overallProgress = getOverallProgress(project)

  return (
    <div className="group relative" style={cardHeight ? { height: cardHeight } : undefined}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
        className="w-full h-full text-left cursor-pointer bg-[#13132a] border border-white/8 rounded-lg p-3 hover:border-orange-500/40 hover:bg-[#16163a] transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1 active:translate-y-0 overflow-hidden flex flex-col"
      >
        {/* Шапка карточки */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              {TYPE_ICONS[project.type]}
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-semibold text-sm leading-tight truncate group-hover:text-orange-300 transition-colors">
                {project.name}
              </h3>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <span className="text-gray-500 text-[10px]">{TYPE_LABELS[project.type]}</span>
                {project.tags?.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-1 py-px rounded bg-orange-500/15 text-orange-300"
                  >
                    {tag}
                  </span>
                ))}
                {(project.tags?.length ?? 0) > 2 && (
                  <span className="text-[9px] text-gray-500">+{project.tags!.length - 2}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Звёздочка избранного */}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite()
                }}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                  project.isFavorite
                    ? 'text-yellow-400 bg-yellow-400/10'
                    : 'text-gray-600 hover:text-yellow-400 hover:bg-yellow-400/5'
                }`}
                title={project.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              >
                <Star size={13} fill={project.isFavorite ? 'currentColor' : 'none'} />
              </button>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[project.status]}`}>
              {STATUS_LABELS[project.status]}
            </span>
          </div>
        </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <div className="bg-white/3 rounded p-1 text-center">
          <div className="text-white font-semibold text-xs leading-none">{project.plannedShootingDays}</div>
          <div className="text-gray-500 text-[9px] mt-0.5">дней съёмок</div>
        </div>
        <div className="bg-white/3 rounded p-1 text-center">
          <div className="text-white font-semibold text-xs leading-none">
            {project.type === 'serial' ? project.episodesCount ?? '—' : '—'}
          </div>
          <div className="text-gray-500 text-[9px] mt-0.5">
            {project.type === 'serial' ? 'серий' : 'мин. хронометраж'}
          </div>
        </div>
        <div className="bg-white/3 rounded p-1 text-center">
          <div className="text-orange-400 font-semibold text-xs leading-none">{overallProgress}%</div>
          <div className="text-gray-500 text-[9px] mt-0.5">готовность</div>
        </div>
      </div>

      {/* Полоса общей готовности */}
      <div className="mb-2">
        <ProgressBar value={overallProgress} color="bg-gradient-to-r from-orange-500 to-red-500" />
      </div>

      {/* Детализация по модулям */}
      <div className="space-y-1 mb-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">Сценарий</span>
          <span className="text-gray-300 font-medium">{project.scriptProgress}%</span>
        </div>
        <ProgressBar value={project.scriptProgress} color="bg-blue-400" />
        <div className="flex items-center justify-between text-[10px] mt-1">
          <span className="text-gray-500">Расписание</span>
          <span className="text-gray-300 font-medium">{project.scheduleProgress}%</span>
        </div>
        <ProgressBar value={project.scheduleProgress} color="bg-purple-400" />
      </div>

      {/* Даты */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Calendar size={10} />
          <span>{formatDate(project.startDate)}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Clock size={10} />
          <span>
            {project.lastOpenedAt
              ? `Открыт ${formatRelativeTime(project.lastOpenedAt)}`
              : `Изменён ${formatDate(project.updatedAt)}`}
          </span>
        </div>
      </div>
      </div>

      {/* Кнопки действий */}
      <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onExport && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onExport()
            }}
            className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/20"
            title="Экспорт проекта"
          >
            <Download size={14} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Удалить проект "${project.name}"? Это действие нельзя отменить.`)) {
              onDelete()
            }
          }}
          className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/20"
          title="Удалить проект"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
