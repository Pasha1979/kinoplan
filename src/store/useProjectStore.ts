import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { pouchStorage } from '../services/storageService'
import { immer } from 'zustand/middleware/immer'
import type { Project } from './projectStore'
import type { Scene } from '../types/scene'
export type { Scene }

interface NormalizedProjectState {
  projects: Record<string, Project>
  scenes: Record<string, Scene>
  currentProjectId: string | null
  isLoading: boolean
  error: string | null
}

interface NormalizedProjectActions {
  setProjects: (projects: Project[]) => void
  deleteProject: (projectId: string) => void
  setCurrentProjectId: (id: string | null) => void
  updateProject: (projectId: string, updates: Partial<Project>) => void
  updateLastOpenedAt: (projectId: string) => void
  toggleFavorite: (projectId: string) => void
  reorderProjects: (orderedIds: string[]) => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  revertScene: (sceneId: string) => void
  setScenesBatch: (scenes: Scene[]) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
}

type NormalizedProjectStore = NormalizedProjectState & NormalizedProjectActions

const initialState: NormalizedProjectState = {
  projects: {},
  scenes: {},
  currentProjectId: null,
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

      deleteProject: (projectId) =>
        set((state) => {
          delete state.projects[projectId]
          // Удаляем сцены, принадлежащие этому проекту
          Object.keys(state.scenes).forEach((sceneId) => {
            if (state.scenes[sceneId].projectId === projectId) {
              delete state.scenes[sceneId]
            }
          })
        }),

      setCurrentProjectId: (id) =>
        set((state) => {
          state.currentProjectId = id
        }),

      updateProject: (projectId, updates) =>
        set((state) => {
          if (state.projects[projectId]) {
            Object.assign(state.projects[projectId], updates)
          }
        }),

      updateLastOpenedAt: (projectId: string) =>
        set((state) => {
          if (state.projects[projectId]) {
            state.projects[projectId].lastOpenedAt = new Date().toISOString()
          }
        }),

      toggleFavorite: (projectId) =>
        set((state) => {
          if (state.projects[projectId]) {
            state.projects[projectId].isFavorite = !state.projects[projectId].isFavorite
          }
        }),

      reorderProjects: (orderedIds) =>
        set((state) => {
          orderedIds.forEach((id, index) => {
            if (state.projects[id]) {
              state.projects[id].sortOrder = index
            }
          })
        }),

      setScenesBatch: (scenes) =>
        set((state) => {
          state.scenes = scenes.reduce<Record<string, Scene>>((acc, s) => {
            acc[s.id] = s
            return acc
          }, {})
        }),

      updateScene: (sceneId, updates) =>
        set((state) => {
          if (state.scenes[sceneId]) {
            Object.assign(state.scenes[sceneId], updates)
          }
        }),

      revertScene: () => {
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
    { name: 'kinoplan-normalized-projects', storage: createJSONStorage(() => pouchStorage) }
  )
)
