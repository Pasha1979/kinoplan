import { useNormalizedProjectStore } from '../store/useProjectStore'
import { useToastStore } from '../store/toastStore'
import type { Project } from '../store/projectStore'
import type { Scene } from '../store/useProjectStore'

const MOCK_DELAY = 100

export const projectService = {
  async getProjects(): Promise<Project[]> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await new Promise((r) => setTimeout(r, MOCK_DELAY))
      const { projects } = useNormalizedProjectStore.getState()
      return Object.values(projects)
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось загрузить проекты')
      useToastStore.getState().showToast('Не удалось загрузить проекты', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await new Promise((r) => setTimeout(r, MOCK_DELAY))

      const newProject: Project = {
        id: `proj-${Date.now()}`,
        name: data.name ?? 'Новый проект',
        type: data.type ?? 'film',
        status: data.status ?? 'preproduction',
        dailyOutput: data.dailyOutput ?? 3,
        shootingGroups: data.shootingGroups ?? 1,
        plannedShootingDays: data.plannedShootingDays ?? 30,
        cloudStorage: data.cloudStorage ?? 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scriptProgress: 0,
        castingProgress: 0,
        locationsProgress: 0,
        scheduleProgress: 0,
        shotDays: 0,
        scheduledDays: 0,
        callSheetsSent: 0,
        callSheetsConfirmed: 0,
        shootingDays: [],
        locationsTotal: 0,
        locationsApproved: 0,
        locationsInScout: 0,
        shotMinutes: 0,
        totalMinutes: 0,
        conflicts: 0,
        ...data,
      }

      const existing = Object.values(useNormalizedProjectStore.getState().projects)
      useNormalizedProjectStore.getState().setProjects([...existing, newProject])

      return newProject
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось создать проект')
      useToastStore.getState().showToast('Не удалось создать проект', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  async saveScenesBatch(projectId: string, scenes: Scene[]): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await new Promise((r) => setTimeout(r, MOCK_DELAY))
      const scopedScenes = scenes.map((s) => ({ ...s, projectId }))
      useNormalizedProjectStore.getState().setScenesBatch(scopedScenes)
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось сохранить сцены')
      useToastStore.getState().showToast('Не удалось сохранить сцены', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  async deleteProject(projectId: string): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await new Promise((r) => setTimeout(r, MOCK_DELAY))
      useNormalizedProjectStore.getState().deleteProject(projectId)
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось удалить проект')
      useToastStore.getState().showToast('Не удалось удалить проект', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  async updateScene(sceneId: string, updates: Partial<Scene>): Promise<void> {
    try {
      useNormalizedProjectStore.getState().updateScene(sceneId, updates)
      await new Promise((r) => setTimeout(r, MOCK_DELAY))
    } catch (error) {
      useNormalizedProjectStore.getState().revertScene(sceneId)
      useNormalizedProjectStore.getState().setError('Не удалось сохранить сцену')
      useToastStore.getState().showToast('Не удалось сохранить сцену', 'error')
      throw error
    }
  },

  async exportProjectToJSON(projectId: string): Promise<string> {
    try {
      const { projects, scenes } = useNormalizedProjectStore.getState()
      const project = projects[projectId]
      if (!project) {
        throw new Error('Проект не найден')
      }
      const projectScenes = Object.values(scenes).filter((s) => s.projectId === projectId)
      const exportData = {
        project,
        scenes: projectScenes,
        exportedAt: new Date().toISOString(),
      }
      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось экспортировать проект')
      useToastStore.getState().showToast('Не удалось экспортировать проект', 'error')
      throw error
    }
  },

  async importProjectFromJSON(jsonString: string): Promise<Project> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await new Promise((r) => setTimeout(r, MOCK_DELAY))

      const parsed = JSON.parse(jsonString)
      if (!parsed.project || !parsed.project.id || !parsed.project.name) {
        throw new Error('Неверный формат JSON: отсутствуют обязательные поля')
      }

      const importedProject: Project = {
        ...parsed.project,
        id: `proj-${Date.now()}`,
        createdAt: parsed.project.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const existing = Object.values(useNormalizedProjectStore.getState().projects)
      useNormalizedProjectStore.getState().setProjects([...existing, importedProject])

      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        const importedScenes = parsed.scenes.map((s: Scene) => ({
          ...s,
          projectId: importedProject.id,
        }))
        const { scenes: existingScenes } = useNormalizedProjectStore.getState()
        useNormalizedProjectStore.getState().setScenesBatch([
          ...Object.values(existingScenes),
          ...importedScenes,
        ])
      }

      return importedProject
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось импортировать проект')
      useToastStore.getState().showToast('Не удалось импортировать проект', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },
}
