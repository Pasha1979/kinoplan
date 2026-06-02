import { describe, it, expect, beforeEach } from 'vitest'
import { useNormalizedProjectStore } from './useProjectStore'
import type { Scene } from './useProjectStore'

beforeEach(() => {
  useNormalizedProjectStore.setState({
    projects: {},
    scenes: {},
    isLoading: false,
    error: null,
  })
})

describe('useNormalizedProjectStore — начальное состояние', () => {
  it('должно иметь нормализованную структуру (словари по ID, не массивы)', () => {
    const state = useNormalizedProjectStore.getState()
    expect(state.projects).toEqual({})
    expect(state.scenes).toEqual({})
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('useNormalizedProjectStore — updateScene', () => {
  it('должно обновлять конкретную сцену по ID', () => {
    const sceneA: Scene = {
      id: 'scene-1',
      projectId: 'proj-1',
      number: '1',
      type: 'ИНТ',
      location: 'КВАРТИРА ИВАНА',
      time: 'ДЕНЬ',
      cast: ['ИВАН'],
      pages: 1,
    }
    const sceneB: Scene = {
      id: 'scene-2',
      projectId: 'proj-1',
      number: '2',
      type: 'ЭКСТ',
      location: 'УЛИЦА',
      time: 'НОЧЬ',
      cast: ['МАРИЯ'],
      pages: 0.5,
    }

    useNormalizedProjectStore.setState({ scenes: { 'scene-1': sceneA, 'scene-2': sceneB } })

    useNormalizedProjectStore.getState().updateScene('scene-1', { location: 'КВАРТИРА МАШИ', pages: 2 })

    const updated = useNormalizedProjectStore.getState().scenes
    expect(updated['scene-1'].location).toBe('КВАРТИРА МАШИ')
    expect(updated['scene-1'].pages).toBe(2)
    expect(updated['scene-1'].type).toBe('ИНТ')
  })

  it('не должно мутировать другие сцены при обновлении одной', () => {
    const sceneA: Scene = {
      id: 'scene-1',
      projectId: 'proj-1',
      number: '1',
      type: 'ИНТ',
      location: 'КВАРТИРА',
      time: 'ДЕНЬ',
      cast: [],
      pages: 1,
    }
    const sceneB: Scene = {
      id: 'scene-2',
      projectId: 'proj-1',
      number: '2',
      type: 'ЭКСТ',
      location: 'УЛИЦА',
      time: 'НОЧЬ',
      cast: [],
      pages: 0.5,
    }

    useNormalizedProjectStore.setState({ scenes: { 'scene-1': sceneA, 'scene-2': sceneB } })

    useNormalizedProjectStore.getState().updateScene('scene-1', { pages: 3 })

    const after = useNormalizedProjectStore.getState().scenes
    expect(after['scene-2'].location).toBe('УЛИЦА')
    expect(after['scene-2'].pages).toBe(0.5)
    expect(after['scene-2'].type).toBe('ЭКСТ')
  })
})

describe('useNormalizedProjectStore — setProjects', () => {
  it('должно нормализовать массив проектов в словарь по ID', () => {
    const mockProjects = [
      { id: 'p1', name: 'Проект 1' },
      { id: 'p2', name: 'Проект 2' },
    ]

    useNormalizedProjectStore.getState().setProjects(mockProjects as never)

    const { projects } = useNormalizedProjectStore.getState()
    expect(projects['p1']).toBeDefined()
    expect(projects['p2']).toBeDefined()
    expect(projects['p1'].name).toBe('Проект 1')
    expect(Array.isArray(projects)).toBe(false)
  })
})

describe('useNormalizedProjectStore — setError / setLoading', () => {
  it('должно устанавливать и сбрасывать ошибку', () => {
    const store = useNormalizedProjectStore.getState()
    store.setError('Тестовая ошибка')
    expect(useNormalizedProjectStore.getState().error).toBe('Тестовая ошибка')
    store.setError(null)
    expect(useNormalizedProjectStore.getState().error).toBeNull()
  })

  it('должно устанавливать isLoading', () => {
    const store = useNormalizedProjectStore.getState()
    store.setLoading(true)
    expect(useNormalizedProjectStore.getState().isLoading).toBe(true)
    store.setLoading(false)
    expect(useNormalizedProjectStore.getState().isLoading).toBe(false)
  })
})
