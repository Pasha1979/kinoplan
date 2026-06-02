import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Project } from './projectStore'

export interface Scene {
  id: string
  projectId: string
  number: string
  type: 'ИНТ' | 'ЭКСТ' | 'ИНТ-ЭКСТ'
  location: string
  time: string
  cast: string[]
  pages: number
}

interface NormalizedProjectState {
  projects: Record<string, Project>
  scenes: Record<string, Scene>
  isLoading: boolean
  error: string | null
}

interface NormalizedProjectActions {
  setProjects: (projects: Project[]) => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  revertScene: (sceneId: string) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
}

type NormalizedProjectStore = NormalizedProjectState & NormalizedProjectActions

const initialState: NormalizedProjectState = {
  projects: {},
  scenes: {},
  isLoading: false,
  error: null,
}

export const useNormalizedProjectStore = create<NormalizedProjectStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      setProjects: (projects) =>
        set((state) => {
          state.projects = projects.reduce<Record<string, Project>>((acc, p) => {
            acc[p.id] = p
            return acc
          }, {})
        }),

      updateScene: (sceneId, updates) =>
        set((state) => {
          if (state.scenes[sceneId]) {
            Object.assign(state.scenes[sceneId], updates)
          }
        }),

      revertScene: (_sceneId) => {
        // TODO: реализовать откат при ошибке сохранения (Этап 2)
      },

      setError: (error) =>
        set((state) => {
          state.error = error
        }),

      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading
        }),
    })),
    { name: 'kinoplan-normalized-projects' }
  )
)
