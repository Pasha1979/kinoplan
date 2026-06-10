import { useNormalizedProjectStore } from '../store/useProjectStore'
import { useToastStore } from '../store/toastStore'
import type { Project } from '../store/projectStore'
import type { Scene } from '../types/scene'
import { API_MOCK_DELAY_MS } from '../constants/scriptConstants'
import { safeRemoveLocalStorage } from '../utils/env'

async function delayWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timeoutId)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

interface ImportProjectPayload {
  project?: {
    id?: unknown
    name?: unknown
    type?: unknown
    [key: string]: unknown
  }
  scenes?: Array<{
    id?: unknown
    number?: unknown
    type?: unknown
    location?: unknown
    time?: unknown
    cast?: unknown
    pages?: unknown
  }>
}

function validateImportedData(raw: unknown): { project: Partial<Project>; scenes?: Scene[] } {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Некорректный формат JSON: ожидался объект')
  }

  const parsed = raw as ImportProjectPayload

  // 1. Валидация проекта
  if (!parsed.project || typeof parsed.project !== 'object') {
    throw new Error('Неверный формат: отсутствует объект project')
  }

  const proj = parsed.project
  if (typeof proj.name !== 'string' || proj.name.trim() === '') {
    throw new Error('Поле project.name обязательно и должно быть непустой строкой')
  }

  if (proj.type !== 'film' && proj.type !== 'serial') {
    throw new Error('Поле project.type должно иметь значение "film" или "serial"')
  }

  const restOfProj = { ...proj }
  delete restOfProj.id
  const validatedProject: Partial<Project> = {
    ...(restOfProj as Partial<Project>),
    name: proj.name.trim(),
    type: proj.type as 'film' | 'serial',
  }

  // 2. Валидация сцен (если есть)
  let validatedScenes: Scene[] | undefined
  if ('scenes' in parsed && parsed.scenes !== undefined) {
    if (!Array.isArray(parsed.scenes)) {
      throw new Error('Поле scenes должно быть массивом')
    }

    validatedScenes = parsed.scenes.map((scene, idx: number) => {
      if (!scene || typeof scene !== 'object') {
        throw new Error(`Сцена под индексом ${idx} не является объектом`)
      }

      const importedScene = scene as Record<string, unknown>

      if (typeof importedScene.id !== 'string' || importedScene.id.trim() === '') {
        throw new Error(`У сцены под индексом ${idx} отсутствует или некорректен id`)
      }

      if (typeof importedScene.number !== 'string' || (importedScene.number as string).trim() === '') {
        throw new Error(`У сцены ${importedScene.id} отсутствует или некорректен номер`)
      }

      // Валидируем и нормализуем тип сцены (ИНТ | ЭКСТ | ИНТ-ЭКСТ | ПАВ)
      let sceneType = importedScene.type
      if (typeof sceneType === 'string') {
        sceneType = sceneType.toUpperCase().trim()
        if (sceneType === 'INT') sceneType = 'ИНТ'
        if (sceneType === 'EXT') sceneType = 'ЭКСТ'
        if (sceneType === 'INT-EXT' || sceneType === 'INT/EXT' || sceneType === 'ИНТ/ЭКСТ') sceneType = 'ИНТ-ЭКСТ'
        if (sceneType === 'PAV' || sceneType === 'ПАВ') sceneType = 'ПАВ'
      }

      if (sceneType !== 'ИНТ' && sceneType !== 'ЭКСТ' && sceneType !== 'ИНТ-ЭКСТ' && sceneType !== 'ПАВ') {
        throw new Error(`У сцены ${importedScene.id} некорректный тип: ${importedScene.type}. Ожидалось ИНТ, ЭКСТ, ИНТ-ЭКСТ или ПАВ`)
      }

      if (typeof importedScene.location !== 'string') {
        throw new Error(`У сцены ${importedScene.id} поле location должно быть строкой`)
      }

      if (typeof importedScene.time !== 'string') {
        throw new Error(`У сцены ${importedScene.id} поле time должно быть строкой`)
      }

      if (!Array.isArray(importedScene.cast) || !(importedScene.cast as unknown[]).every((item: unknown) => typeof item === 'string')) {
        throw new Error(`У сцены ${importedScene.id} поле cast должно быть массивом строк`)
      }

      if (typeof importedScene.pages !== 'number' || isNaN(importedScene.pages as number) || (importedScene.pages as number) < 0) {
        throw new Error(`У сцены ${importedScene.id} поле pages должно быть положительным числом`)
      }

      return {
        id: importedScene.id as string,
        projectId: '', // будет заменено на id импортированного проекта
        number: (importedScene.number as string).trim(),
        type: sceneType as 'ИНТ' | 'ЭКСТ' | 'ИНТ-ЭКСТ' | 'ПАВ',
        location: (importedScene.location as string).trim(),
        sublocation: typeof importedScene.sublocation === 'string'
          ? importedScene.sublocation.trim()
          : undefined,
        time: (importedScene.time as string).trim(),
        cast: (importedScene.cast as string[]).map((c: string) => c.trim()).filter(Boolean),
        pages: importedScene.pages as number,
        manualDuration: typeof importedScene.manualDuration === 'number' && !isNaN(importedScene.manualDuration)
          ? importedScene.manualDuration
          : undefined,
      }
    })
  }

  return { project: validatedProject, scenes: validatedScenes }
}

export const projectService = {
  async getProjects(signal?: AbortSignal): Promise<Project[]> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await delayWithSignal(API_MOCK_DELAY_MS, signal)
      const { projects } = useNormalizedProjectStore.getState()
      return Object.values(projects)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      useNormalizedProjectStore.getState().setError('Не удалось загрузить проекты')
      useToastStore.getState().showToast('Не удалось загрузить проекты', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  async createProject(data: Partial<Project>, signal?: AbortSignal): Promise<Project> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await delayWithSignal(API_MOCK_DELAY_MS, signal)

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

  async saveScenesBatch(projectId: string, scenes: Scene[], signal?: AbortSignal): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await delayWithSignal(API_MOCK_DELAY_MS, signal)
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

  async deleteProject(projectId: string, signal?: AbortSignal): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await delayWithSignal(API_MOCK_DELAY_MS, signal)
      useNormalizedProjectStore.getState().deleteProject(projectId)

      // Удаляем черновики редактора из localStorage
      safeRemoveLocalStorage(`kinoplan_draft_${projectId}`)
      if (typeof window !== 'undefined') {
        const prefix = `kinoplan_draft_${projectId}_s`
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i)
          if (key && key.startsWith(prefix)) {
            safeRemoveLocalStorage(key)
          }
        }
      }
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось удалить проект')
      useToastStore.getState().showToast('Не удалось удалить проект', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  async updateScene(sceneId: string, updates: Partial<Scene>, signal?: AbortSignal): Promise<void> {
    try {
      useNormalizedProjectStore.getState().updateScene(sceneId, updates)
      await delayWithSignal(API_MOCK_DELAY_MS, signal)
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

  async importProjectFromJSON(jsonString: string, signal?: AbortSignal): Promise<Project> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)
      await delayWithSignal(API_MOCK_DELAY_MS, signal)

      const parsed = JSON.parse(jsonString)
      const { project: validatedProj, scenes: validatedScenes } = validateImportedData(parsed)

      const importedProject: Project = {
        ...validatedProj,
        id: `proj-${Date.now()}`,
        createdAt: validatedProj.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Project

      const existing = Object.values(useNormalizedProjectStore.getState().projects)
      useNormalizedProjectStore.getState().setProjects([...existing, importedProject])

      if (validatedScenes && validatedScenes.length > 0) {
        const importedScenes = validatedScenes.map((s) => ({
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
