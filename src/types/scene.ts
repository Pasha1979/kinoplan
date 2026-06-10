export type ScriptFormat = 'russian' | 'hollywood' | 'custom'
export type TimingSystem = 'page' | 'character' | 'flexible' | 'manual'
export type SceneType = 'INT' | 'EXT' | 'INT/EXT' | 'PAV'
export type TimeOfDay = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS'
export type BookmarkColor = 'red' | 'yellow' | 'blue'
export type ScenePriority = 'high' | 'medium' | 'low'
export type SceneStatus = 'not_planned' | 'planned' | 'shot'

export type BreakdownCategory =
  | 'cast'
  | 'extras'
  | 'props'
  | 'costumes'
  | 'locations'
  | 'vehicles'
  | 'sfx'
  | 'stunts'
  | 'vfx'
  | 'notes'

export interface BreakdownElement {
  id: string
  category: BreakdownCategory
  name: string
  notes?: string
}

export interface Scene {
  id: string
  projectId?: string
  number: string // «1», «2А», «3» — может быть буквенным
  type: string // 'ИНТ' | 'ЭКСТ' | 'ИНТ-ЭКСТ' | 'ПАВ' (единый формат с editor)
  location: string // «КВАРТИРА ИВАНА»
  sublocation?: string // «Кабинет директора» (из «Школа.Кабинет директора»)
  timeOfDay?: TimeOfDay
  time: string // русское время суток ('ДЕНЬ', 'НОЧЬ'...) — для отображения
  charCount?: number // символов в сцене
  duration?: number // секунд хронометража
  manualDuration?: number // ручной хронометраж из шапки (мм:сс) в секундах
  synopsis?: string // краткое описание действия
  pages: number // хронометраж в страницах (0.125 = 1/8 стр.)
  cast: string[] // имена персонажей в сцене
  breakdownElements?: BreakdownElement[]
  scriptText?: string // полный текст сцены (из редактора)
  colorTag?: string // цветная ревизия (белый/синий/розовый...)
  isOmitted?: boolean // сцена исключена из съёмок
  order?: number // порядок в сценарии
  
  // Заделы для продакшена (Шаг 2.2)
  shootDate?: string // дата съёмки
  shootDayNumber?: number // номер съёмочного дня
  priority?: ScenePriority // приоритет съёмки
  status?: SceneStatus // статус сцены
  productionNotes?: string // заметки для съёмочной группы
  
  // Bookmarking (Шаг 1.9)
  isBookmarked?: boolean
  bookmarkColor?: BookmarkColor
}
