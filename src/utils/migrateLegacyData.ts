import { useNormalizedProjectStore } from '../store/useProjectStore'
import { safeGetLocalStorage, safeSetLocalStorage, safeRemoveLocalStorage } from './env'

const LEGACY_KEY = 'kinoplan-projects'
const MIGRATED_FLAG = 'kinoplan-legacy-migrated'

interface LegacyStorage {
  state: {
    projects: Record<string, unknown>[]
    currentProjectId: string | null
  }
}

export function migrateLegacyData(): void {
  if (safeGetLocalStorage(MIGRATED_FLAG) === 'true') return

  const normalizedProjects = useNormalizedProjectStore.getState().projects
  if (Object.keys(normalizedProjects).length > 0) {
    safeSetLocalStorage(MIGRATED_FLAG, 'true')
    return
  }

  try {
    const raw = safeGetLocalStorage(LEGACY_KEY)
    if (!raw) {
      safeSetLocalStorage(MIGRATED_FLAG, 'true')
      return
    }

    const parsed = JSON.parse(raw) as LegacyStorage
    const legacyProjects = parsed?.state?.projects

    if (!Array.isArray(legacyProjects) || legacyProjects.length === 0) {
      safeSetLocalStorage(MIGRATED_FLAG, 'true')
      return
    }

    useNormalizedProjectStore.getState().setProjects(legacyProjects as never)
    safeSetLocalStorage(MIGRATED_FLAG, 'true')
    safeRemoveLocalStorage(LEGACY_KEY)
  } catch {
    // Миграция не критична — если не удалась, пользователь просто начнёт с чистого листа
    safeSetLocalStorage(MIGRATED_FLAG, 'true')
  }
}
