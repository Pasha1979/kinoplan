/**
 * Авто-синк библии Разработки с текстом сценария (чистая функция — тестируема).
 * Ключи дедупликации — norm(): «Ё»→«Е», свёртка пробелов — иначе «ЁЛКИН»/«ЕЛКИН»
 * и «ИВАН»/«ИВАН  » плодили бы почти-дубли карточек.
 * Удалять нечего не удаляет: переименованное автором имя остаётся «не в сценах»
 * и сливается вручную через «Объединить с…».
 */
import { norm } from './charMerge'
import type { DevCharacter, DevLocation, ProjectDevelopment } from '../../../types/development'
import type { Scene } from '../../../types/scene'

export interface BibleSyncResult {
  characters: DevCharacter[]
  locations: DevLocation[]
  /** true — списки изменились и стоит писать в стор */
  changed: boolean
}

const sameIds = (a?: string[], b?: string[]) =>
  a?.length === b?.length && (a ?? []).every((x) => (b ?? []).includes(x))

export function syncBibleWithScenes(
  dev: ProjectDevelopment | undefined,
  scenes: Pick<Scene, 'id' | 'location' | 'sublocation' | 'cast' | 'dialogCharacters'>[],
): BibleSyncResult {
  const locNames = new Map<string, string[]>()
  const charNames = new Map<string, string[]>()
  const push = (map: Map<string, string[]>, key: string, id: string) => {
    const a = map.get(key) ?? []
    if (!a.includes(id)) a.push(id)
    map.set(key, a)
  }

  scenes.forEach((sc) => {
    const loc = norm(sc.location || '')
    const sub = norm(sc.sublocation || '')
    if (loc) {
      push(locNames, loc, sc.id) // родитель — все сцены включая подлокации
      if (sub) push(locNames, `${loc}.${sub}`, sc.id) // полный путь — только свои
    }
    ;[...(sc.cast || []), ...(sc.dialogCharacters || [])].forEach((n) => {
      const k = norm(n)
      if (k) push(charNames, k, sc.id)
    })
  })

  let locsChanged = false
  const locations = (dev?.locations ?? []).map((l) => {
    const ids = locNames.get(norm(l.name))
    if (!ids) return l
    locNames.delete(norm(l.name))
    return sameIds(l.sceneIds, ids) ? l : (locsChanged = true, { ...l, sceneIds: ids })
  })
  locNames.forEach((ids, name) => {
    locations.push({ id: crypto.randomUUID(), name, sceneIds: ids })
    locsChanged = true
  })

  let charsChanged = false
  const characters = (dev?.characters ?? []).map((c) => {
    const ids = charNames.get(norm(c.name))
    if (!ids) return c
    charNames.delete(norm(c.name))
    return sameIds(c.sceneIds, ids) ? c : (charsChanged = true, { ...c, sceneIds: ids })
  })
  charNames.forEach((ids, name) => {
    characters.push({ id: crypto.randomUUID(), name, type: 'secondary', sceneIds: ids })
    charsChanged = true
  })

  return { characters, locations, changed: locsChanged || charsChanged }
}
