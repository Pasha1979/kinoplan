import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Типы данных для модуля сценария

export type ScriptFormat = 'russian' | 'hollywood' | 'custom'
export type TimingSystem = 'page' | 'character' | 'flexible' | 'manual'
export type SceneType = 'INT' | 'EXT' | 'INT/EXT'
export type TimeOfDay = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS'
// Обратная совместимость: type хранится как строка (русский вариант: 'ИНТ', 'ЭКСТ')
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
  projectId: string
  number: string // «1», «2А», «3» — может быть буквенным
  type: string // 'ИНТ' | 'ЭКСТ' | 'ИНТ-ЭКСТ' (единый формат с editor)
  location: string // «КВАРТИРА ИВАНА»
  timeOfDay: TimeOfDay
  time: string // русское время суток ('ДЕНЬ', 'НОЧЬ'...) — для отображения
  charCount?: number // символов в сцене
  duration?: number // секунд хронометража
  synopsis: string // краткое описание действия
  pages: number // хронометраж в страницах (0.125 = 1/8 стр.)
  cast: string[] // имена персонажей в сцене
  breakdownElements: BreakdownElement[]
  scriptText?: string // полный текст сцены (из редактора)
  colorTag?: string // цветная ревизия (белый/синий/розовый...)
  isOmitted: boolean // сцена исключена из съёмок
  order: number // порядок в сценарии
  
  // Заделы для продакшена (Фаза 2, шаг 2.2)
  shootDate?: string // дата съёмки
  shootDayNumber?: number // номер съёмочного дня
  priority?: ScenePriority // приоритет съёмки
  status?: SceneStatus // статус сцены
  productionNotes?: string // заметки для съёмочной группы
  
  // Bookmarking (Фаза 1, шаг 1.9)
  isBookmarked?: boolean
  bookmarkColor?: BookmarkColor
}

export interface Character {
  id: string
  projectId: string
  name: string // «ИВАН» — всегда капслок
  description?: string
  sceneCount: number // сколько сцен участвует (вычисляется)
}

export interface TitlePage {
  title: string
  authors: string[]
  contacts: string[]
  logline?: string
  copyright?: string
}

export interface Script {
  id: string
  projectId: string
  title: string
  version: string // «Съёмочный», «Режиссёрский», «Черновик v3»
  format: ScriptFormat
  scenes: Scene[]
  characters: Character[]
  createdAt: string
  updatedAt: string
  
  // Настройки хронометража (Фаза 1, шаг 1.2)
  timingSystem: TimingSystem
  genreCoefficient: number
  
  // Настройки шрифта (Фаза 1, шаг 1.2)
  fontFamily: string // 'Courier New', 'Courier Prime', etc.
  fontSize: number // 12
  
  // Title Page (Фаза 1, шаг 1.7)
  titlePage?: TitlePage
}

export interface ScriptDraft {
  id: string
  scriptId: string
  version: string
  changeLog: string[]
  createdAt: string
  isActive: boolean
  
  // Заделы для продакшена (Фаза 2, шаг 2.4)
  impact?: {
    budgetChange?: number
    scheduleChange?: string
  }
}

export interface ScriptNote {
  id: string
  sceneId: string
  lineNumber: number
  text: string
  author: string
  createdAt: string
}

// ScriptStore

interface ScriptStore {
  scripts: Script[]
  currentScriptId: string | null
  drafts: ScriptDraft[]
  notes: ScriptNote[]
  
  // CRUD для Script
  addScript: (script: Script) => void
  updateScript: (id: string, updates: Partial<Script>) => void
  deleteScript: (id: string) => void
  setCurrentScript: (id: string) => void
  getCurrentScript: () => Script | null
  
  // CRUD для Scene
  addScene: (scriptId: string, scene: Scene) => void
  updateScene: (scriptId: string, sceneId: string, updates: Partial<Scene>) => void
  deleteScene: (scriptId: string, sceneId: string) => void
  reorderScenes: (scriptId: string, sceneIds: string[]) => void
  
  // CRUD для Character
  addCharacter: (scriptId: string, character: Character) => void
  updateCharacter: (scriptId: string, characterId: string, updates: Partial<Character>) => void
  deleteCharacter: (scriptId: string, characterId: string) => void
  
  // CRUD для ScriptDraft
  addDraft: (draft: ScriptDraft) => void
  updateDraft: (draftId: string, updates: Partial<ScriptDraft>) => void
  deleteDraft: (draftId: string) => void
  setActiveDraft: (draftId: string) => void
  
  // CRUD для ScriptNote
  addNote: (note: ScriptNote) => void
  updateNote: (noteId: string, updates: Partial<ScriptNote>) => void
  deleteNote: (noteId: string) => void
}

export const useScriptStore = create<ScriptStore>()(
  persist(
    (set, get) => ({
      scripts: [],
      currentScriptId: null,
      drafts: [],
      notes: [],
      
      // Script CRUD
      addScript: (script) =>
        set((state) => ({ scripts: [...state.scripts, script] })),
      
      updateScript: (id, updates) =>
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
          ),
        })),
      
      deleteScript: (id) =>
        set((state) => ({
          scripts: state.scripts.filter((s) => s.id !== id),
          currentScriptId: state.currentScriptId === id ? null : state.currentScriptId,
        })),
      
      setCurrentScript: (id) =>
        set({ currentScriptId: id }),
      
      getCurrentScript: () => {
        const { scripts, currentScriptId } = get()
        return scripts.find((s) => s.id === currentScriptId) ?? null
      },
      
      // Scene CRUD
      addScene: (scriptId, scene) =>
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === scriptId
              ? { ...s, scenes: [...s.scenes, scene], updatedAt: new Date().toISOString() }
              : s
          ),
        })),
      
      updateScene: (scriptId, sceneId, updates) =>
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === scriptId
              ? {
                  ...s,
                  scenes: s.scenes.map((scene) =>
                    scene.id === sceneId ? { ...scene, ...updates } : scene
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        })),
      
      deleteScene: (scriptId, sceneId) =>
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === scriptId
              ? {
                  ...s,
                  scenes: s.scenes.filter((scene) => scene.id !== sceneId),
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        })),
      
      reorderScenes: (scriptId, sceneIds) =>
        set((state) => ({
          scripts: state.scripts.map((s) => {
            if (s.id !== scriptId) return s
            
            const sceneMap = new Map(s.scenes.map((scene) => [scene.id, scene]))
            const reorderedScenes = sceneIds
              .map((id) => sceneMap.get(id))
              .filter((scene): scene is Scene => scene !== undefined)
              .map((scene, index) => ({ ...scene, order: index }))
            
            return { ...s, scenes: reorderedScenes, updatedAt: new Date().toISOString() }
          }),
        })),
      
      // Character CRUD
      addCharacter: (scriptId, character) =>
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === scriptId
              ? { ...s, characters: [...s.characters, character], updatedAt: new Date().toISOString() }
              : s
          ),
        })),
      
      updateCharacter: (scriptId, characterId, updates) =>
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === scriptId
              ? {
                  ...s,
                  characters: s.characters.map((c) =>
                    c.id === characterId ? { ...c, ...updates } : c
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        })),
      
      deleteCharacter: (scriptId, characterId) =>
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === scriptId
              ? {
                  ...s,
                  characters: s.characters.filter((c) => c.id !== characterId),
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        })),
      
      // ScriptDraft CRUD
      addDraft: (draft) =>
        set((state) => ({ drafts: [...state.drafts, draft] })),
      
      updateDraft: (draftId, updates) =>
        set((state) => ({
          drafts: state.drafts.map((d) => (d.id === draftId ? { ...d, ...updates } : d)),
        })),
      
      deleteDraft: (draftId) =>
        set((state) => ({ drafts: state.drafts.filter((d) => d.id !== draftId) })),
      
      setActiveDraft: (draftId) =>
        set((state) => ({
          drafts: state.drafts.map((d) => ({ ...d, isActive: d.id === draftId })),
        })),
      
      // ScriptNote CRUD
      addNote: (note) =>
        set((state) => ({ notes: [...state.notes, note] })),
      
      updateNote: (noteId, updates) =>
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? { ...n, ...updates } : n)),
        })),
      
      deleteNote: (noteId) =>
        set((state) => ({ notes: state.notes.filter((n) => n.id !== noteId) })),
    }),
    { name: 'kinoplan-scripts' }
  )
)
