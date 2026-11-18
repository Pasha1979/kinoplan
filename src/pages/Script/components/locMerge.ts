import type { DevFolder, DevLocation } from '../../../types/development'
import type { Scene } from '../../../types/scene'
import { levenshtein, nameBoundaryRegex, norm } from './charMerge'

/** Детект дублей и слияние локаций справочника — тот же паттерн, что у персонажей (charMerge).
 *  Чистые функции — легко тестировать; UI и запись в сторы снаружи. */

export interface LocDupPair {
  a: DevLocation
  b: DevLocation
  /** почему похожи — показывается в UI */
  reason: 'prefix' | 'firstword' | 'typo'
}

/** Пары возможных дублей: «ДОМ»/«ДОМ ИВАНА», опечатки в 1–2 буквы */
export function findLocDuplicates(locs: DevLocation[]): LocDupPair[] {
  const out: LocDupPair[] = []
  for (let i = 0; i < locs.length; i++) {
    for (let j = i + 1; j < locs.length; j++) {
      const na = norm(locs[i].name), nb = norm(locs[j].name)
      if (na === nb) { out.push({ a: locs[i], b: locs[j], reason: 'typo' }); continue }
      if (nb.startsWith(na + ' ')) { out.push({ a: locs[i], b: locs[j], reason: 'prefix' }); continue }
      if (na.startsWith(nb + ' ')) { out.push({ a: locs[j], b: locs[i], reason: 'prefix' }); continue }
      const wa = na.split(' '), wb = nb.split(' ')
      if (wa[0] === wb[0] && wa.length !== wb.length) {
        out.push({ a: locs[i], b: locs[j], reason: 'firstword' }); continue
      }
      if (Math.min(na.length, nb.length) >= 4 && levenshtein(na, nb) <= 2) {
        out.push({ a: locs[i], b: locs[j], reason: 'typo' })
      }
    }
  }
  return out
}

export interface LocMergeResult {
  locations: DevLocation[]
  folders?: DevFolder[]
  /** сколько названий заменено в контенте всех серий */
  replacedInText: number
  /** новые location/sublocation по сцене: sceneId → патч */
  sceneLocPatches: Map<string, { location: string; sublocation?: string }>
}

/** Слияние drop → keep: метаданные из более заполненного,
 *  sceneIds объединяются, папки перечисляются,
 *  название заменяется в шапках сцен и scene.location (вариант B). */
export function mergeLocations(params: {
  locations: DevLocation[]
  folders?: DevFolder[]
  keepId: string
  dropId: string
  scenes: Scene[]
  contents: string[] // HTML-контент всех серий
}): LocMergeResult & { contentsPatched: string[] } {
  const { locations, folders, keepId, dropId, scenes, contents } = params
  const keep = locations.find((l) => l.id === keepId)
  const drop = locations.find((l) => l.id === dropId)
  if (!keep || !drop) {
    return { locations, folders, replacedInText: 0, sceneLocPatches: new Map(), contentsPatched: contents }
  }

  const META_KEYS: Array<keyof DevLocation> = ['description', 'atmosphere', 'props']
  const merged: DevLocation = { ...keep }
  META_KEYS.forEach((k) => { if (!merged[k] && drop[k]) (merged as unknown as Record<string, unknown>)[k] = drop[k] })
  merged.sceneIds = [...new Set([...(keep.sceneIds ?? []), ...(drop.sceneIds ?? [])])]

  const nextLocations = locations.filter((l) => l.id !== dropId).map((l) => (l.id === keepId ? merged : l))

  const nextFolders = folders?.map((f) => ({
    ...f,
    itemIds: f.itemIds.filter((id) => id !== dropId || !f.itemIds.includes(keepId))
      .map((id) => (id === dropId ? keepId : id)),
  }))

  // Замена названия в контенте серий (шапки пишутся капсом — имя словаря тоже)
  const re = nameBoundaryRegex(drop.name)
  let replacedInText = 0
  const contentsPatched = contents.map((html) =>
    html.replace(re, () => { replacedInText++; return keep.name })
  )

  // scene.location / путь «location.sublocation»: нормализованное совпадение → имя keep.
  // keep.name с точкой разбиваем обратно на location.sublocation.
  const sceneLocPatches = new Map<string, { location: string; sublocation?: string }>()
  const dropNorm = norm(drop.name)
  const splitKeep = () => {
    const dot = keep.name.indexOf('.')
    return dot > 0
      ? { location: keep.name.slice(0, dot), sublocation: keep.name.slice(dot + 1) }
      : { location: keep.name, sublocation: undefined as string | undefined }
  }
  scenes.forEach((sc) => {
    if (sc.location && norm(sc.location) === dropNorm) {
      const k = splitKeep()
      sceneLocPatches.set(sc.id, { location: k.location, sublocation: k.sublocation ?? sc.sublocation })
    } else if (sc.location && sc.sublocation && norm(`${sc.location}.${sc.sublocation}`) === dropNorm) {
      sceneLocPatches.set(sc.id, splitKeep())
    }
  })

  return { locations: nextLocations, folders: nextFolders, replacedInText, sceneLocPatches, contentsPatched }
}
