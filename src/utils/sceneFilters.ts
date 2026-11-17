import type { Scene } from '../types/scene'

/**
 * Чистая логика фильтрации навигатора и карточек — вынесена из
 * SceneNavigator/CardsView для покрытия тестами. Поведение 1:1.
 */

export type SceneTypeFilter = 'all' | 'ИНТ' | 'ЭКСТ' | 'ПАВ'

/** Навигатор: ИНТ включает ИНТ-ЭКСТ; ЭКСТ — строго ЭКСТ; ПАВ — строго ПАВ */
export function filterByNavigatorType(scenes: Scene[], filter: SceneTypeFilter): Scene[] {
  if (filter === 'ИНТ') return scenes.filter((s) => s.type === 'ИНТ' || s.type === 'ИНТ-ЭКСТ')
  if (filter === 'ЭКСТ') return scenes.filter((s) => s.type === 'ЭКСТ')
  if (filter === 'ПАВ') return scenes.filter((s) => s.type === 'ПАВ')
  return scenes
}

/** Карточки: ИНТ и ЭКСТ оба включают смешанные ИНТ-ЭКСТ/ИНТ/ЭКСТ */
export function filterByCardType(scenes: Scene[], filter: SceneTypeFilter): Scene[] {
  if (filter === 'all') return scenes
  if (filter === 'ПАВ') return scenes.filter((s) => s.type === 'ПАВ')
  if (filter === 'ИНТ') {
    return scenes.filter((s) => s.type === 'ИНТ' || s.type === 'ИНТ-ЭКСТ' || s.type === 'ИНТ/ЭКСТ')
  }
  return scenes.filter((s) => s.type === 'ЭКСТ' || s.type === 'ИНТ-ЭКСТ' || s.type === 'ИНТ/ЭКСТ')
}

export interface NavigatorFilters {
  type: SceneTypeFilter
  locations: string[]
  characters: string[]
  colors: string[]
  query: string
}

/** Полный конвейер фильтров навигатора: тип → локация → персонаж → цвет → поиск */
export function applyNavigatorFilters(scenes: Scene[], f: NavigatorFilters): Scene[] {
  let list = filterByNavigatorType(scenes, f.type)
  if (f.locations.length) list = list.filter((s) => f.locations.includes(s.location))
  if (f.characters.length) list = list.filter((s) => (s.cast || []).some((c) => f.characters.includes(c)))
  if (f.colors.length) list = list.filter((s) => !!s.colorTag && f.colors.includes(s.colorTag))
  const q = f.query.trim().toLowerCase()
  if (q) {
    list = list.filter((s) =>
      [s.number, s.location, s.sublocation, s.synopsis, ...(s.cast || [])]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }
  return list
}

/** Поиск карточек: номер/локация/подлокация/cast/синопсис (резолвится снаружи) */
export function matchesCardQuery(sc: Scene, syn: string, q: string): boolean {
  const query = q.trim().toLowerCase()
  if (!query) return true
  return (
    sc.number.toLowerCase().includes(query) ||
    (sc.location || '').toLowerCase().includes(query) ||
    (sc.sublocation || '').toLowerCase().includes(query) ||
    (sc.cast || []).some((c) => c.toLowerCase().includes(query)) ||
    syn.toLowerCase().includes(query)
  )
}

/** Опции фильтров: имя → кол-во сцен, отсортированы по убыванию кол-ва */
export function countByField(scenes: Scene[], field: 'location' | 'character'): Array<[string, number]> {
  const m = new Map<string, number>()
  if (field === 'location') {
    scenes.forEach((s) => { if (s.location) m.set(s.location, (m.get(s.location) || 0) + 1) })
  } else {
    scenes.forEach((s) => (s.cast || []).forEach((c) => m.set(c, (m.get(c) || 0) + 1)))
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export const COLOR_TAG_ORDER = ['blue', 'pink', 'yellow', 'green', 'orange'] as const

/** Цветовые фильтры: только цвета, реально присутствующие на сценах, в каноническом порядке */
export function presentColorTags(scenes: Scene[]): string[] {
  const present = new Set(scenes.map((s) => s.colorTag).filter(Boolean))
  return COLOR_TAG_ORDER.filter((c) => present.has(c))
}

/** Мультивыбор внутри фильтра работает как «ИЛИ» — toggle одного значения */
export function toggleInList<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

/**
 * Стрелки ↑↓ навигатора: без активной сцены — край в направлении dir,
 * с активной — соседний индекс, зажатый границами. Возвращает null,
 * если листать некуда (пустой список или тот же индекс).
 */
export function nextSceneIndex(scenes: ReadonlyArray<Pick<Scene, 'id'>>, activeId: string | undefined, dir: 1 | -1): number | null {
  if (!scenes.length) return null
  const idx = activeId ? scenes.findIndex((s) => s.id === activeId) : -1
  const next = idx === -1
    ? (dir === 1 ? 0 : scenes.length - 1)
    : Math.min(scenes.length - 1, Math.max(0, idx + dir))
  return next !== idx ? next : null
}

/**
 * Авто-синопсис карточки: первая ремарка (action) после шапки;
 * сцены без action — первый текстовый блок любого типа (диалог/параграф).
 */
export function buildAutoSynopsis(
  blocks: ReadonlyArray<{ type: string; content: string }>,
  scenes: ReadonlyArray<Pick<Scene, 'id'>>,
): Map<string, string> {
  const map = new Map<string, string>()
  const fallback = new Map<string, string>()
  let idx = -1
  for (const b of blocks) {
    if (b.type === 'scene_header') { idx++; continue }
    const scene = scenes[idx]
    if (!scene || !b.content.trim()) continue
    if (b.type === 'action' && !map.has(scene.id)) {
      map.set(scene.id, b.content.trim())
    } else if (!fallback.has(scene.id)) {
      fallback.set(scene.id, b.content.trim())
    }
  }
  fallback.forEach((v, k) => { if (!map.has(k)) map.set(k, v) })
  return map
}

/** Группировка сцен по сериям: episode → сцены, серии по возрастанию */
export function groupByEpisode<T extends { _episode?: number }>(scenes: T[]): Array<[number, T[]]> {
  const g = new Map<number, T[]>()
  scenes.forEach((sc) => {
    const ep = sc._episode ?? 1
    if (!g.has(ep)) g.set(ep, [])
    g.get(ep)!.push(sc)
  })
  return [...g.entries()].sort((a, b) => a[0] - b[0])
}

/** Сцены конкретной серии по префиксу номера («N-…») — из навигатора */
export function scenesOfSeries<T extends Pick<Scene, 'number'>>(scenes: T[], series: number): T[] {
  return scenes.filter((scene) => {
    const match = scene.number.match(/^(\d+)-/)
    return match && parseInt(match[1], 10) === series
  })
}

/** Цвета типов сцен для карточек */
export const SCENE_TYPE_COLORS: Record<string, string> = {
  'ИНТ': '#8b5cf6',
  'ЭКСТ': '#22c55e',
  'ИНТ-ЭКСТ': '#fb923c',
  'ПАВ': '#0ea5e9',
}

export function sceneTypeColor(type: string | undefined): string {
  return (type && SCENE_TYPE_COLORS[type]) || '#94a3b8'
}

/** Палитра авто-цвета новых групп — циклически по кол-ву существующих */
export const GROUP_COLORS = ['#fb923c', '#3b82f6', '#22c55e', '#a78bfa', '#ef4444'] as const

export function nextGroupColor(existingCount: number): string {
  return GROUP_COLORS[existingCount % GROUP_COLORS.length]
}
