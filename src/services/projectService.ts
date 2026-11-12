import { useNormalizedProjectStore } from '../store/useProjectStore'
import { useScriptStore, type Script } from '../store/scriptStore'
import { useToastStore } from '../store/toastStore'
import type { Project } from '../types/project'
import type { Scene } from '../types/scene'
import { safeRemoveLocalStorage } from '../utils/env'


interface ImportProjectPayload {
  schemaVersion?: number
  project?: {
    id?: unknown
    name?: unknown
    type?: unknown
    [key: string]: unknown
  }
  /** v2: полные скрипты с content/titlePage/development */
  scripts?: Array<Record<string, unknown>>
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

function validateImportedData(raw: unknown): { project: Partial<Project>; scenes?: Scene[]; scripts?: Script[] } {
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

  const VALID_TYPES: Project['type'][] = ['film', 'serial', 'ad', 'clip', 'other']
  if (!VALID_TYPES.includes(proj.type as Project['type'])) {
    throw new Error(`Поле project.type должно быть одним из: ${VALID_TYPES.join(', ')}`)
  }

  const restOfProj = { ...proj }
  delete restOfProj.id
  const validatedProject: Partial<Project> = {
    ...(restOfProj as Partial<Project>),
    name: proj.name.trim(),
    type: proj.type as Project['type'],
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

  // 3. Скрипты (v2) — сами скрипты с текстом сценария
  let validatedScripts: Script[] | undefined
  if (Array.isArray(parsed.scripts) && parsed.scripts.length > 0) {
    validatedScripts = parsed.scripts.map((raw, idx) => {
      const s = raw as Partial<Script>
      if (!s || typeof s !== 'object' || typeof s.title !== 'string') {
        throw new Error(`Скрипт под индексом ${idx} некорректен`)
      }
      return {
        ...s,
        id: '', // будет перегенерирован при импорте — чужие id не сохраняем
        projectId: '',
      } as Script
    })
  }

  return { project: validatedProject, scenes: validatedScenes, scripts: validatedScripts }
}

export const projectService = {
  async getProjects(signal?: AbortSignal): Promise<Project[]> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)      if (signal?.aborted) { throw new DOMException('Aborted', 'AbortError') }
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
      useNormalizedProjectStore.getState().setLoading(true)      if (signal?.aborted) { throw new DOMException('Aborted', 'AbortError') }

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
      if (error instanceof DOMException && error.name === 'AbortError') { throw error }
      useNormalizedProjectStore.getState().setError('Не удалось создать проект')
      useToastStore.getState().showToast('Не удалось создать проект', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  async saveScenesBatch(projectId: string, scenes: Scene[], signal?: AbortSignal): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)      if (signal?.aborted) { throw new DOMException('Aborted', 'AbortError') }
      const scopedScenes = scenes.map((s) => ({ ...s, projectId }))
      useNormalizedProjectStore.getState().setScenesBatch(scopedScenes)
      // Честный статус «Сохранено»: ждём реальной записи на диск,
      // иначе UI показывал бы «Сохранено» до фактической записи
      const { flushWrites } = await import('./storageService')
      await Promise.all([
        flushWrites('kinoplan-normalized-projects'),
        flushWrites('kinoplan-scripts'),
      ])
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') { throw error }
      useNormalizedProjectStore.getState().setError('Не удалось сохранить сцены')
      useToastStore.getState().showToast('Не удалось сохранить сцены', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  async deleteProject(projectId: string, signal?: AbortSignal): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)      if (signal?.aborted) { throw new DOMException('Aborted', 'AbortError') }
      useNormalizedProjectStore.getState().deleteProject(projectId)

      // Каскад: удаляем все сценарии проекта (самый тяжёлый контент — HTML)
      const { scripts, currentScriptId } = useScriptStore.getState()
      const orphanIds = scripts.filter((s) => s.projectId === projectId).map((s) => s.id)
      orphanIds.forEach((id) => useScriptStore.getState().deleteScript(id))
      if (currentScriptId && orphanIds.includes(currentScriptId)) {
        useScriptStore.setState({ currentScriptId: null })
      }

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
      if (error instanceof DOMException && error.name === 'AbortError') { throw error }
      useNormalizedProjectStore.getState().setError('Не удалось удалить проект')
      useToastStore.getState().showToast('Не удалось удалить проект', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },

  // Удаление с возможностью отмены: снапшот → удаление → тост «Отменить» (10 сек)
  async deleteProjectWithUndo(projectId: string, signal?: AbortSignal): Promise<void> {
    const proj = useNormalizedProjectStore.getState().projects[projectId]
    const normScenes = useNormalizedProjectStore.getState().scenes
    const scenesSnapshot = Object.values(normScenes).filter((s) => s.projectId === projectId)
    const scriptState = useScriptStore.getState()
    const scriptsSnapshot = scriptState.scripts.filter((s) => s.projectId === projectId)
    const prevScriptId = scriptState.currentScriptId

    // Снапшот черновиков редактора из localStorage
    const draftSnapshot: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(`kinoplan_draft_${projectId}`)) {
          const v = localStorage.getItem(key)
          if (v !== null) draftSnapshot[key] = v
        }
      }
    }

    await this.deleteProject(projectId, signal)

    useToastStore.getState().showToast(`Проект «${proj?.name ?? ''}» удалён`, 'info', 10000, {
      label: 'Отменить',
      onClick: () => {
        if (proj) {
          useNormalizedProjectStore.setState((state) => ({
            projects: { ...state.projects, [proj.id]: proj },
            scenes: {
              ...state.scenes,
              ...Object.fromEntries(scenesSnapshot.map((s) => [s.id, s])),
            },
          }))
        }
        scriptsSnapshot.forEach((s) => useScriptStore.getState().addScript(s))
        if (prevScriptId) useScriptStore.setState({ currentScriptId: prevScriptId })
        Object.entries(draftSnapshot).forEach(([k, v]) => {
          try { localStorage.setItem(k, v) } catch { /* quota */ }
        })
        useToastStore.getState().showToast('Проект восстановлен', 'success')
      },
    })
  },

  async updateScene(sceneId: string, updates: Partial<Scene>, signal?: AbortSignal): Promise<void> {
    try {
      // SSoT: источник — scriptStore (script.scenes), normalized — проекция.
      // Сначала пишем в источник, иначе следующая синхронизация редактора затрёт правку.
      const scriptStore = useScriptStore.getState()
      const owner = scriptStore.scripts.find((s) => s.scenes?.some((sc) => sc.id === sceneId))
      if (owner?.scenes) {
        scriptStore.updateScript(owner.id, {
          scenes: owner.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...updates } : sc)),
        })
      }
      useNormalizedProjectStore.getState().updateScene(sceneId, updates)
      if (signal?.aborted) { throw new DOMException('Aborted', 'AbortError') }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') { throw error }
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
      const projectScripts = useScriptStore.getState().scripts.filter((s) => s.projectId === projectId)
      const exportData = {
        schemaVersion: 2,
        project,
        scripts: projectScripts,
        scenes: projectScenes,
        exportedAt: new Date().toISOString(),
      }
      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') { throw error }
      useNormalizedProjectStore.getState().setError('Не удалось экспортировать проект')
      useToastStore.getState().showToast('Не удалось экспортировать проект', 'error')
      throw error
    }
  },

  async importProjectFromJSON(jsonString: string, signal?: AbortSignal): Promise<Project> {
    try {
      useNormalizedProjectStore.getState().setLoading(true)      if (signal?.aborted) { throw new DOMException('Aborted', 'AbortError') }

      const parsed = JSON.parse(jsonString)
      const { project: validatedProj, scenes: validatedScenes, scripts: validatedScripts } = validateImportedData(parsed)

      const importedProject: Project = {
        // Дефолты обязательных полей — защита от минимального JSON (краш Dashboard на shootingDays)
        dailyOutput: 0, shootingGroups: 1, plannedShootingDays: 0,
        scriptProgress: 0, castingProgress: 0, locationsProgress: 0, scheduleProgress: 0,
        shotDays: 0, scheduledDays: 0, callSheetsSent: 0, callSheetsConfirmed: 0,
        shootingDays: [], locationsTotal: 0, locationsApproved: 0, locationsInScout: 0,
        shotMinutes: 0, totalMinutes: 0, conflicts: 0, cloudStorage: 'none',
        ...validatedProj,
        id: `proj-${Date.now()}`,
        createdAt: validatedProj.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Project

      const existing = Object.values(useNormalizedProjectStore.getState().projects)
      useNormalizedProjectStore.getState().setProjects([...existing, importedProject])

      // Скрипты импортируем с новыми id — они несут текст сценария
      if (validatedScripts && validatedScripts.length > 0) {
        const { addScript } = useScriptStore.getState()
        validatedScripts.forEach((s) => {
          // data-scene-id в HTML — стабильные UUID сцен; регенерируем,
          // чтобы не пересечься со сценами исходного проекта
          const content = s.content?.replace(/data-scene-id="[^"]*"/g, () => `data-scene-id="${crypto.randomUUID()}"`)
          addScript({ ...s, content, id: crypto.randomUUID(), projectId: importedProject.id })
        })
      }

      // Нормализованные сцены — только если скриптов нет (они регенерируются при открытии)
      if ((!validatedScripts || validatedScripts.length === 0) && validatedScenes && validatedScenes.length > 0) {
        const importedScenes = validatedScenes.map((s) => ({
          ...s,
          // Уникальные id — scene-1 из файла не должна перезаписать scene-1 другого проекта
          id: `${s.id}-imp-${importedProject.id}`,
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
      if (error instanceof DOMException && error.name === 'AbortError') { throw error }
      useNormalizedProjectStore.getState().setError('Не удалось импортировать проект')
      useToastStore.getState().showToast('Не удалось импортировать проект', 'error')
      throw error
    } finally {
      useNormalizedProjectStore.getState().setLoading(false)
    }
  },
}
