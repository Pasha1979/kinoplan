import { useNormalizedProjectStore } from '../store/useProjectStore'

const LEGACY_KEY = 'kinoplan-projects'
const MIGRATED_FLAG = 'kinoplan-legacy-migrated'

interface LegacyStorage {
  state: {
    projects: Record<string, unknown>[]
    currentProjectId: string | null
  }
}

export function migrateLegacyData(): void {
  if (localStorage.getItem(MIGRATED_FLAG) === 'true') return

  const normalizedProjects = useNormalizedProjectStore.getState().projects
  if (Object.keys(normalizedProjects).length > 0) {
    localStorage.setItem(MIGRATED_FLAG, 'true')
    return
  }

  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) {
      localStorage.setItem(MIGRATED_FLAG, 'true')
      return
    }

    const parsed = JSON.parse(raw) as LegacyStorage
    const legacyProjects = parsed?.state?.projects

    if (!Array.isArray(legacyProjects) || legacyProjects.length === 0) {
      localStorage.setItem(MIGRATED_FLAG, 'true')
      return
    }

    useNormalizedProjectStore.getState().setProjects(legacyProjects as never)
    localStorage.setItem(MIGRATED_FLAG, 'true')
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Миграция не критична — если не удалась, пользователь просто начнёт с чистого листа
    localStorage.setItem(MIGRATED_FLAG, 'true')
  }
}
