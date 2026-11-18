import type { DevCharacter, DevFolder } from '../../../types/development'
import type { Scene } from '../../../types/scene'

/** T-133: поиск дублей и слияние персонажей справочника.
 *  Чистые функции — легко тестировать; UI и запись в сторы снаружи. */

export const norm = (s: string) => s.toUpperCase().replace(/Ё/g, 'Е').replace(/\s+/g, ' ').trim()

/** Расстояние Левенштейна (короткие имена — полный расчёт дёшев) */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

export interface DupPair {
  a: DevCharacter
  b: DevCharacter
  /** почему похожи — показывается в UI */
  reason: 'prefix' | 'firstword' | 'typo'
}

/** Пары возможных дублей: «ИВАН»/«ИВАН ПЕТРОВ», опечатки в 1–2 буквы */
export function findCharDuplicates(chars: DevCharacter[]): DupPair[] {
  const out: DupPair[] = []
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      const na = norm(chars[i].name), nb = norm(chars[j].name)
      if (na === nb) { out.push({ a: chars[i], b: chars[j], reason: 'typo' }); continue }
      // один — строгий префикс другого по границе слова
      if (nb.startsWith(na + ' ')) { out.push({ a: chars[i], b: chars[j], reason: 'prefix' }); continue }
      if (na.startsWith(nb + ' ')) { out.push({ a: chars[j], b: chars[i], reason: 'prefix' }); continue }
      // общее первое слово при разной длине
      const wa = na.split(' '), wb = nb.split(' ')
      if (wa[0] === wb[0] && wa.length !== wb.length) {
        out.push({ a: chars[i], b: chars[j], reason: 'firstword' }); continue
      }
      // опечатка: разница 1–2 символа при длине ≥4
      if (Math.min(na.length, nb.length) >= 4 && levenshtein(na, nb) <= 2) {
        out.push({ a: chars[i], b: chars[j], reason: 'typo' })
      }
    }
  }
  return out
}

/** Регекс для замены имени в тексте: граница — не буква и не цифра (кириллица+латиница) */
export const nameBoundaryRegex = (name: string): RegExp => {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![А-ЯЁA-Z0-9])${esc}(?![А-ЯЁA-Z0-9])`, 'g')
}

export interface MergeResult {
  characters: DevCharacter[]
  folders?: DevFolder[]
  /** сколько имён заменено в контенте всех серий */
  replacedInText: number
  /** новые cast/dialogCharacters по сцене: sceneId → оба списка */
  sceneCastPatches: Map<string, { cast: string[]; dialogCharacters: string[] }>
}

/** Слияние drop → keep: метаданные берутся из более заполненного,
 *  sceneIds объединяются, связи перенацеливаются, папки перечисляются. */
export function mergeCharacters(params: {
  characters: DevCharacter[]
  folders?: DevFolder[]
  keepId: string
  dropId: string
  scenes: Scene[]
  contents: string[] // HTML-контент всех серий
}): MergeResult & { contentsPatched: string[] } {
  const { characters, folders, keepId, dropId, scenes, contents } = params
  const keep = characters.find((c) => c.id === keepId)
  const drop = characters.find((c) => c.id === dropId)
  if (!keep || !drop) {
    return { characters, folders, replacedInText: 0, sceneCastPatches: new Map(), contentsPatched: contents }
  }

  const META_KEYS: Array<keyof DevCharacter> = [
    'description', 'arc', 'age', 'profession', 'appearance', 'temperament',
    'prototype', 'desire', 'fear', 'secret', 'conflict', 'episodeTag',
  ]
  const merged: DevCharacter = { ...keep }
  META_KEYS.forEach((k) => { if (!merged[k] && drop[k]) (merged as unknown as Record<string, unknown>)[k] = drop[k] })
  merged.sceneIds = [...new Set([...(keep.sceneIds ?? []), ...(drop.sceneIds ?? [])])]
  // связи keep: перенацелить ссылки на drop → keep
  merged.relationships = (keep.relationships ?? []).map((r) =>
    r.targetId === dropId ? { ...r, targetId: keepId } : r
  )
  // связи drop → добавить к keep (с перенацеливанием на keep)
  ;(drop.relationships ?? []).forEach((r) => {
    if (r.targetId !== keepId && !merged.relationships!.some((x) => x.targetId === r.targetId && x.type === r.type)) {
      merged.relationships!.push({ ...r, targetId: r.targetId === dropId ? keepId : r.targetId })
    }
  })

  const nextCharacters = characters
    .filter((c) => c.id !== dropId)
    .map((c) => {
      if (c.id === keepId) return merged
      // чужие связи на drop → keep
      if (c.relationships?.some((r) => r.targetId === dropId)) {
        return { ...c, relationships: c.relationships.map((r) => r.targetId === dropId ? { ...r, targetId: keepId } : r) }
      }
      return c
    })

  const nextFolders = folders?.map((f) => ({
    ...f,
    itemIds: f.itemIds.filter((id) => id !== dropId || !f.itemIds.includes(keepId))
      .map((id) => (id === dropId ? keepId : id)),
  }))

  // Замена имени в контенте серий
  const re = nameBoundaryRegex(drop.name)
  let replacedInText = 0
  const contentsPatched = contents.map((html) =>
    html.replace(re, () => { replacedInText++; return keep.name })
  )

  // cast-списки и говорящие сцен: имя drop → имя keep.
  // dialogCharacters патчим обязательно — иначе авто-синк библии
  // тут же «воскресит» удалённого персонажа из устаревшего поля
  const sceneCastPatches = new Map<string, { cast: string[]; dialogCharacters: string[] }>()
  scenes.forEach((sc) => {
    if (sc.cast?.includes(drop.name) || sc.dialogCharacters?.includes(drop.name)) {
      sceneCastPatches.set(sc.id, {
        cast: (sc.cast ?? []).map((n) => (n === drop.name ? keep.name : n)),
        dialogCharacters: (sc.dialogCharacters ?? []).map((n) => (n === drop.name ? keep.name : n)),
      })
    }
  })

  return { characters: nextCharacters, folders: nextFolders, replacedInText, sceneCastPatches, contentsPatched }
}
