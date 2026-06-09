import { describe, it, expect, beforeEach, vi } from 'vitest'
import { projectService } from './projectService'
import { useNormalizedProjectStore } from '../store/useProjectStore'
import type { Scene } from '../store/useProjectStore'
import type { Project } from '../store/projectStore'

beforeEach(() => {
  useNormalizedProjectStore.setState({
    projects: {},
    scenes: {},
    isLoading: false,
    error: null,
  })
})

describe('projectService.getProjects', () => {
  it('должен успешно разрешить промис и вернуть массив', async () => {
    const mockProject: Project = {
      id: 'p1',
      name: 'Тестовый проект',
      type: 'film',
      status: 'preproduction',
      dailyOutput: 3,
      shootingGroups: 1,
      plannedShootingDays: 30,
      cloudStorage: 'none',
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
    }

    useNormalizedProjectStore.setState({ projects: { p1: mockProject } })

    const result = await projectService.getProjects()

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
    expect(result[0].name).toBe('Тестовый проект')
  })

  it('должен сбрасывать isLoading после завершения', async () => {
    await projectService.getProjects()
    expect(useNormalizedProjectStore.getState().isLoading).toBe(false)
  })
})

describe('projectService.createProject', () => {
  it('должен создать проект и добавить его в стор', async () => {
    const created = await projectService.createProject({ name: 'Новый фильм', type: 'film' })

    expect(created.id).toBeTruthy()
    expect(created.name).toBe('Новый фильм')
    expect(created.type).toBe('film')

    const { projects } = useNormalizedProjectStore.getState()
    expect(projects[created.id]).toBeDefined()
    expect(projects[created.id].name).toBe('Новый фильм')
  })

  it('должен сбрасывать isLoading после завершения', async () => {
    await projectService.createProject({ name: 'Проект' })
    expect(useNormalizedProjectStore.getState().isLoading).toBe(false)
  })
})

describe('projectService.updateScene', () => {
  it('должен обновить данные сцены в сторе и разрешить промис', async () => {
    const scene: Scene = {
      id: 'scene-1',
      projectId: 'proj-1',
      number: '1',
      type: 'ИНТ',
      location: 'КВАРТИРА',
      time: 'ДЕНЬ',
      cast: ['ИВАН'],
      pages: 1,
    }
    useNormalizedProjectStore.setState({ scenes: { 'scene-1': scene } })

    await projectService.updateScene('scene-1', { location: 'ОФИС', pages: 2 })

    const updated = useNormalizedProjectStore.getState().scenes['scene-1']
    expect(updated.location).toBe('ОФИС')
    expect(updated.pages).toBe(2)
    expect(updated.type).toBe('ИНТ')
  })

  it('должен вызывать setError и revertScene при ошибке внутри updateScene', async () => {
    const setErrorSpy = vi.spyOn(useNormalizedProjectStore.getState(), 'setError')
    const revertSpy = vi.spyOn(useNormalizedProjectStore.getState(), 'revertScene')

    vi.spyOn(useNormalizedProjectStore.getState(), 'updateScene').mockImplementationOnce(() => {
      throw new Error('Ошибка сети')
    })

    await expect(
      projectService.updateScene('scene-1', { location: 'ОФИС' })
    ).rejects.toThrow('Ошибка сети')

    expect(revertSpy).toHaveBeenCalledWith('scene-1')
    expect(setErrorSpy).toHaveBeenCalledWith('Не удалось сохранить сцену')
  })
})

describe('projectService.importProjectFromJSON', () => {
  it('должен успешно импортировать корректный проект со сценами', async () => {
    const validJson = JSON.stringify({
      project: {
        id: 'some-old-id',
        name: 'Новый фильм для импорта',
        type: 'film',
        status: 'production',
      },
      scenes: [
        {
          id: 'scene-id-1',
          number: '1',
          type: 'INT',
          location: 'ДОМ',
          time: 'УТРО',
          cast: ['АЛИСА'],
          pages: 1.5,
        },
      ],
    })

    const imported = await projectService.importProjectFromJSON(validJson)

    expect(imported.id).toBeTruthy()
    expect(imported.name).toBe('Новый фильм для импорта')
    expect(imported.type).toBe('film')

    const storeState = useNormalizedProjectStore.getState()
    expect(storeState.projects[imported.id]).toBeDefined()

    // Сцена должна быть импортирована, а её тип нормализован к 'ИНТ'
    const importedScene = Object.values(storeState.scenes).find(s => s.number === '1')
    expect(importedScene).toBeDefined()
    expect(importedScene?.location).toBe('ДОМ')
    expect(importedScene?.type).toBe('ИНТ') // Нормализовано из INT
    expect(importedScene?.projectId).toBe(imported.id)
  })

  it('должен выбросить ошибку если отсутствует имя проекта', async () => {
    const invalidJson = JSON.stringify({
      project: {
        type: 'film',
      },
    })

    await expect(
      projectService.importProjectFromJSON(invalidJson)
    ).rejects.toThrow('Поле project.name обязательно')
  })

  it('должен выбросить ошибку если сцена невалидна', async () => {
    const invalidJson = JSON.stringify({
      project: {
        name: 'Фильм',
        type: 'film',
      },
      scenes: [
        {
          id: 'sc-1',
          number: '1',
          type: 'INVALID_TYPE', // Ошибка!
        },
      ],
    })

    await expect(
      projectService.importProjectFromJSON(invalidJson)
    ).rejects.toThrow('некорректный тип')
  })
})
