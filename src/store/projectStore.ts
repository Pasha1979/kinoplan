import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ProjectType = 'serial' | 'film' | 'ad' | 'clip' | 'other'
export type ProjectStatus = 'preproduction' | 'shooting' | 'postproduction' | 'completed'

export type ShootingDayType =
  // Съёмочные
  | 'shoot'            // 🟠 Съёмочный день
  | 'conflict'         // 🔴 Конфликт в расписании
  // Пре-продакшн — работа с людьми
  | 'rehearsal'        // 🟣 Репетиция (актёрская)
  | 'stunt_rehearsal'  // 🟤 Репетиция трюков (каскадёры)
  | 'casting_session'  // 🟡 Кастинг / пробы
  | 'fitting'          // 🟢 Примерка костюмов
  // Пре-продакшн — подготовка
  | 'scouting'         // 🟫 Скаутинг локаций
  | 'tech_survey'      // 🔧 Технический осмотр (ТС, объект)
  | 'vfx_prep'         // 🩵 VFX-подготовка
  | 'table_read'       // 📖 Читка сценария / КПП
  | 'meeting'          // 💛 Собрание (по отделу или общее)
  // Логистика / прочее
  | 'travel'           // 🔵 Переезд
  | 'holiday'          // 🎉 Праздник / нерабочий день (РФ)
  | 'day_off'          // ⬜ Выходной

export interface ShootingDay {
  date: string               // ISO дата YYYY-MM-DD
  type: ShootingDayType
  location?: string
  sceneNumbers?: string[]
  notes?: string
  // Для собраний и мероприятий
  title?: string             // заголовок события
  attendees?: string[]       // участники
  linkedModule?: string      // 'locations' | 'casting' | 'costumes' | ...
}

export type TaskStatus = 'todo' | 'inProgress' | 'done' | 'overdue'

export interface Task {
  id: string
  projectId: string
  title: string
  deadline?: string          // ISO дата
  assignee?: string
  status: TaskStatus
  module: string
}

export type ActivityType = 'schedule' | 'callsheet' | 'casting' | 'conflict' | 'script' | 'general'

export interface ActivityEvent {
  id: string
  projectId: string
  text: string
  timestamp: string          // ISO
  type: ActivityType
}

export interface Project {
  id: string
  name: string
  type: ProjectType
  status: ProjectStatus
  // Для сериала
  episodesCount?: number
  episodeDuration?: number
  // Для фильма и остальных
  totalDuration?: number
  // Общие поля
  dailyOutput: number        // минуты экранного времени в день
  shootingGroups: 1 | 2 | 3
  plannedShootingDays: number
  startDate?: string         // ISO дата
  endDate?: string           // ISO дата
  cloudStorage: 'none' | 'yandex' | 'vk' | 'later'
  createdAt: string
  updatedAt: string
  // Статистика (заглушки — заполнятся из модулей)
  scriptProgress: number     // 0-100%
  castingProgress: number
  locationsProgress: number
  scheduleProgress: number
  // Съёмочная статистика (заполняется из модуля Планирования)
  shotDays: number           // снято дней
  scheduledDays: number      // запланировано дней в расписании
  // Вызывные
  callSheetsSent: number
  callSheetsConfirmed: number
  // Расписание дней (заполняется из модуля Планирования)
  shootingDays: ShootingDay[]
  // Локации — заглушки (заполнятся из модуля Локаций, Фаза 2)
  locationsTotal: number       // объектов в сценарии
  locationsApproved: number    // утверждено
  locationsInScout: number     // на скаутинге
  // Хронометраж факт vs план — заглушки (Фаза 3, скрипт-супервайзер)
  shotMinutes: number          // реально снятых минут экранного времени
  totalMinutes: number         // итоговый хронометраж продукта
  // Smart Alerts — кол-во конфликтов (заполнится из alertStore, Фаза 2)
  conflicts: number
}

interface ProjectStore {
  projects: Project[]
  currentProjectId: string | null
  addProject: (project: Project) => void
  deleteProject: (id: string) => void
  setCurrentProject: (id: string) => void
  getCurrentProject: () => Project | null
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
  projects: [],
  currentProjectId: null,

  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),

  deleteProject: (id) =>
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

  setCurrentProject: (id) =>
    set({ currentProjectId: id }),

  getCurrentProject: () => {
    const { projects, currentProjectId } = get()
    return projects.find((p) => p.id === currentProjectId) ?? null
  },
  }),
  { name: 'kinoplan-projects' }
)
)
