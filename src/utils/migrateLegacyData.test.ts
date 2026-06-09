import { describe, it, expect, beforeEach } from 'vitest'
import { migrateLegacyData } from './migrateLegacyData'
import { useNormalizedProjectStore } from '../store/useProjectStore'

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {} as unknown as Window & typeof globalThis
}

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => {
      for (const key in store) {
        delete store[key]
      }
    },
    length: 0,
    key: (index: number) => Object.keys(store)[index] || null,
  } as unknown as Storage
}

describe('migrateLegacyData', () => {
  beforeEach(() => {
    localStorage.clear()
    useNormalizedProjectStore.setState({
      projects: {},
      scenes: {},
      currentProjectId: null,
    })
  })

  it('should not migrate if already migrated flag is true', () => {
    localStorage.setItem('kinoplan-legacy-migrated', 'true')
    localStorage.setItem('kinoplan-projects', JSON.stringify({
      state: {
        projects: [{ id: 'proj-1', title: 'Legacy Project' }]
      }
    }))

    migrateLegacyData()

    const projects = useNormalizedProjectStore.getState().projects
    expect(Object.keys(projects).length).toBe(0)
  })

  it('should migrate projects successfully if legacy projects exist', () => {
    const legacyData = {
      state: {
        projects: [
          { id: 'proj-1', name: 'Legacy Film', type: 'film', updatedAt: '2026-06-10T00:00:00.000Z' }
        ]
      }
    }
    localStorage.setItem('kinoplan-projects', JSON.stringify(legacyData))

    migrateLegacyData()

    const storeState = useNormalizedProjectStore.getState()
    expect(storeState.projects['proj-1']).toBeDefined()
    expect(storeState.projects['proj-1'].name).toBe('Legacy Film')
    expect(localStorage.getItem('kinoplan-legacy-migrated')).toBe('true')
    expect(localStorage.getItem('kinoplan-projects')).toBeNull() // should be removed
  })
})
