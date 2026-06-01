import type { Project } from './projectStore'

export type AlertLevel = 'critical' | 'warning' | 'info'

export interface SmartAlert {
  id: string
  level: AlertLevel
  title: string
  description: string
  action?: { label: string; path: string }
  module: string
}

export function computeAlerts(project: Project): SmartAlert[] {
  const alerts: SmartAlert[] = []
  const now = new Date(); now.setHours(0, 0, 0, 0)

  const startDate = project.startDate ? new Date(project.startDate) : null
  const endDate   = project.endDate   ? new Date(project.endDate)   : null
  if (startDate) startDate.setHours(0, 0, 0, 0)
  if (endDate)   endDate.setHours(0, 0, 0, 0)

  const daysToStart = startDate ? Math.round((startDate.getTime() - now.getTime()) / 86400000) : null
  const daysToEnd   = endDate   ? Math.round((endDate.getTime()   - now.getTime()) / 86400000) : null

  // ─── CRITICAL ─────────────────────────────────────────────────────────────

  // Проект просрочен (дата финиша прошла)
  if (daysToEnd !== null && daysToEnd < 0) {
    alerts.push({
      id: 'overdue',
      level: 'critical',
      title: 'Проект просрочен',
      description: `Дата завершения прошла ${Math.abs(daysToEnd)} дн. назад. Обновите расписание.`,
      module: 'Планирование',
      action: { label: 'Открыть расписание', path: `/project/${project.id}/schedule` },
    })
  }

  // Старт через 7 дней, кастинг < 30%
  if (daysToStart !== null && daysToStart <= 7 && daysToStart >= 0 && project.castingProgress < 30) {
    alerts.push({
      id: 'casting_critical',
      level: 'critical',
      title: `Кастинг не закрыт — старт через ${daysToStart} дн.`,
      description: `Кастинг готов на ${project.castingProgress}%. До старта съёмок осталось мало времени.`,
      module: 'Кастинг',
      action: { label: 'Открыть кастинг', path: `/project/${project.id}/casting` },
    })
  }

  // Нет ни одного съёмочного дня в расписании
  if (project.shootingDays.length === 0 && daysToStart !== null && daysToStart <= 30) {
    alerts.push({
      id: 'no_schedule',
      level: 'critical',
      title: 'Расписание не заполнено',
      description: 'Ни одного съёмочного дня не добавлено. Заполните стрипборд.',
      module: 'Планирование',
      action: { label: 'Создать расписание', path: `/project/${project.id}/schedule` },
    })
  }

  // ─── WARNING ──────────────────────────────────────────────────────────────

  // До финиша < 14 дней
  if (daysToEnd !== null && daysToEnd > 0 && daysToEnd <= 14) {
    alerts.push({
      id: 'deadline_soon',
      level: 'warning',
      title: `До финиша ${daysToEnd} дн.`,
      description: 'Проверьте готовность всех отделов перед завершением.',
      module: 'Dashboard',
    })
  }

  // Сценарий < 50% и до старта < 21 дня
  if (daysToStart !== null && daysToStart <= 21 && project.scriptProgress < 50) {
    alerts.push({
      id: 'script_low',
      level: 'warning',
      title: 'Сценарий не готов',
      description: `Готово ${project.scriptProgress}% сценария. До старта ${daysToStart} дн.`,
      module: 'Сценарий',
      action: { label: 'К сценарию', path: `/project/${project.id}/script` },
    })
  }

  // Локации < 50% и до старта < 30 дней
  if (daysToStart !== null && daysToStart <= 30 && project.locationsProgress < 50) {
    alerts.push({
      id: 'locations_low',
      level: 'warning',
      title: 'Локации не утверждены',
      description: `Утверждено ${project.locationsProgress}% локаций. До старта ${daysToStart} дн.`,
      module: 'Локации',
      action: { label: 'Открыть локации', path: `/project/${project.id}/locations` },
    })
  }

  // ─── INFO ─────────────────────────────────────────────────────────────────

  // Общий прогресс < 20%
  const overall = Math.round(
    (project.scriptProgress + project.castingProgress + project.locationsProgress + project.scheduleProgress) / 4
  )
  if (overall < 20 && daysToStart !== null && daysToStart > 30) {
    alerts.push({
      id: 'low_progress',
      level: 'info',
      title: 'Проект только начинается',
      description: `Общая готовность ${overall}%. Заполните модули пре-продакшна.`,
      module: 'Dashboard',
    })
  }

  // Сортируем: critical → warning → info
  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
}
