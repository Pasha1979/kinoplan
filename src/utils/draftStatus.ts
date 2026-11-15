import type { DraftStatus, Scene } from '../types/scene'

/** Встроенные редакционные статусы (готовность текста сцены) */
export const DEFAULT_DRAFT_STATUSES: DraftStatus[] = [
  { id: 'draft', label: 'Набросок', color: '#94a3b8', weight: 10, builtin: true },
  { id: 'wip', label: 'В работе', color: '#f59e0b', weight: 50, builtin: true },
  { id: 'rework', label: 'На доработке', color: '#f97316', weight: 60, builtin: true },
  { id: 'review', label: 'На проверке', color: '#3b82f6', weight: 80, builtin: true },
  { id: 'done', label: 'Готова', color: '#22c55e', weight: 100, builtin: true },
  { id: 'final', label: 'Финал', color: '#a78bfa', weight: 100, builtin: true },
]

/** Встроенные + пользовательские; свои с тем же id перекрывают встроенные */
export function allDraftStatuses(custom?: DraftStatus[]): DraftStatus[] {
  const map = new Map(DEFAULT_DRAFT_STATUSES.map((s) => [s.id, s]))
  for (const s of custom ?? []) map.set(s.id, s)
  return [...map.values()]
}

/** Найти статус по id (встроенные + свои) */
export function draftStatusById(id: string | undefined, custom?: DraftStatus[]): DraftStatus | undefined {
  if (!id) return undefined
  return allDraftStatuses(custom).find((s) => s.id === id)
}

/** % готовности сценария: среднее по весам статусов; сцена без статуса = 0 */
export function scriptReadiness(scenes: Pick<Scene, 'draftStatus'>[], custom?: DraftStatus[]): number {
  if (!scenes.length) return 0
  const sum = scenes.reduce((acc, sc) => acc + (draftStatusById(sc.draftStatus, custom)?.weight ?? 0), 0)
  return Math.round(sum / scenes.length)
}

/** Встроенный статус — канон: нельзя править и удалять (даже если свой статус перекрыл id) */
export function isBuiltinStatus(id: string): boolean {
  return DEFAULT_DRAFT_STATUSES.some((s) => s.id === id)
}

/** Сколько сцен ссылаются на статус — передавать сцены ВСЕХ серий (статусы проект-широкие) */
export function countScenesWithStatus(statusId: string, scenes: Pick<Scene, 'draftStatus'>[]): number {
  return scenes.filter((s) => s.draftStatus === statusId).length
}

/**
 * Очистка ссылок перед удалением статуса: у сцен с fromId ставим toId
 * (undefined — «без статуса»). Остальные сцены не трогаем — ссылок-сирот не остаётся.
 */
export function reassignSceneStatus<T extends Pick<Scene, 'draftStatus'>>(
  scenes: T[],
  fromId: string,
  toId?: string,
): T[] {
  return scenes.map((s) => (s.draftStatus === fromId ? { ...s, draftStatus: toId } : s))
}
