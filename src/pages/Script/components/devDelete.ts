/**
 * Удаление объектов библии с пропихом в сцены и текст (T-…).
 * Зеркало charMerge/locMerge: чистые функции над HTML контента всех серий —
 * тот же результат, что ручная правка текста; авто-синк библии не «воскресит»
 * удалённое имя, потому что оно исчезает из источников (cast-строки,
 * character-строки, шапки сцен).
 */

import { norm } from './charMerge'
import { SCENE_NUMBER } from '../../../utils/sceneNumber'
import type { DevCharacter, DevFolder, DevLocation } from '../../../types/development'
import type { Scene } from '../../../types/scene'

const parse = (html: string) => new DOMParser().parseFromString(html || '', 'text/html')
const dt = (el: Element) => el.getAttribute('data-type') || ''
const isType = (el: Element, ...types: string[]) => types.includes(dt(el))

// Имя говорящего без сценарных уточнений: «ИВАН (З/К)» → «ИВАН»
const speakerKey = (s: string) =>
  norm(s.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim())

const HEADER_RE = new RegExp(
  `^(${SCENE_NUMBER}\\.\\s*(?:ИНТ-ЭКСТ\\.?|ИНТ-НАТ\\.?|ИНТ\\.?|ЭКСТ\\.?|ПАВ\\.?|НАТ\\/ИНТ\\.?|ИНТ\\/НАТ\\.?|НАТ\\.?)\\s*)(.*?)(\\s*[—–-].*)?$`,
  'i',
)

/** Сколько раз персонаж говорит в тексте (строки scene-character по всем сериям) */
export function countDialogues(contents: string[], name: string): number {
  const k = norm(name)
  let n = 0
  for (const html of contents) {
    const doc = parse(html)
    doc.querySelectorAll('[data-type="scene-character"], [data-type="sceneCharacter"]').forEach((el) => {
      if (speakerKey(el.textContent || '') === k) n++
    })
  }
  return n
}

export interface CharDeleteResult {
  characters: DevCharacter[]
  folders?: DevFolder[]
  contentsPatched: string[]
  sceneCastPatches: Map<string, { cast: string[]; dialogCharacters: string[] }>
  removedReplicas: number
  touchedScenes: number
}

/** Удаление персонажа: из библии, cast-строк текста и метаданных сцен.
 *  removeDialogues=true — также стираются его реплики (character + remark/dialog). */
export function deleteCharacterEverywhere(params: {
  characters: DevCharacter[]
  folders?: DevFolder[]
  id: string
  scenes: Scene[]
  contents: string[]
  removeDialogues: boolean
}): CharDeleteResult {
  const { characters, folders, id, scenes, contents, removeDialogues } = params
  const char = characters.find((c) => c.id === id)
  if (!char) {
    return { characters, folders, contentsPatched: contents, sceneCastPatches: new Map(), removedReplicas: 0, touchedScenes: 0 }
  }
  const k = norm(char.name)

  const nextCharacters = characters
    .filter((c) => c.id !== id)
    .map((c) =>
      c.relationships?.some((r) => r.targetId === id)
        ? { ...c, relationships: c.relationships.filter((r) => r.targetId !== id) }
        : c,
    )

  const nextFolders = folders?.map((f) => ({ ...f, itemIds: f.itemIds.filter((x) => x !== id) }))

  let removedReplicas = 0
  const contentsPatched = contents.map((html) => {
    const doc = parse(html)
    // 1. cast-строки «действующие лица»: убираем имя из списка через запятую
    doc.querySelectorAll('[data-type="scene-cast"], [data-type="sceneCast"]').forEach((el) => {
      const names = (el.textContent || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
      const kept = names.filter((n) => speakerKey(n) !== k)
      if (kept.length !== names.length) el.textContent = kept.join(', ')
    })
    // 2. реплики: character-строка + прилегающие remark/dialog (если выбрано)
    if (removeDialogues) {
      const blocks = [...doc.body.querySelectorAll('[data-type]')]
      for (let i = 0; i < blocks.length; i++) {
        const el = blocks[i]
        if (!isType(el, 'scene-character', 'sceneCharacter')) continue
        if (speakerKey(el.textContent || '') !== k) continue
        removedReplicas++
        el.remove()
        for (let j = i + 1; j < blocks.length; j++) {
          const nx = blocks[j]
          if (isType(nx, 'scene-parenthetical', 'sceneParenthetical', 'scene-dialog', 'sceneDialog')) {
            nx.remove()
            continue
          }
          break
        }
      }
    }
    return doc.body.innerHTML
  })

  const sceneCastPatches = new Map<string, { cast: string[]; dialogCharacters: string[] }>()
  let touchedScenes = 0
  scenes.forEach((sc) => {
    const inCast = (sc.cast ?? []).some((n) => speakerKey(n) === k)
    const inDlg = (sc.dialogCharacters ?? []).some((n) => speakerKey(n) === k)
    if (inCast || inDlg) {
      touchedScenes++
      sceneCastPatches.set(sc.id, {
        cast: (sc.cast ?? []).filter((n) => speakerKey(n) !== k),
        dialogCharacters: (sc.dialogCharacters ?? []).filter((n) => speakerKey(n) !== k),
      })
    }
  })

  return {
    characters: nextCharacters, folders: nextFolders,
    contentsPatched, sceneCastPatches, removedReplicas, touchedScenes,
  }
}

export interface LocDeleteResult {
  locations: DevLocation[]
  folders?: DevFolder[]
  contentsPatched: string[]
  sceneLocPatches: Map<string, { location: string; sublocation?: string }>
  headersPatched: number
}

/** Удаление локации: из библии, шапок сцен в тексте и метаданных сцен.
 *  Родитель «ДОМ» → шапка «ИНТ. — ДЕНЬ»; подлокация «ДОМ.ЗАЛ» → «ИНТ. ДОМ — ДЕНЬ». */
export function deleteLocationEverywhere(params: {
  locations: DevLocation[]
  folders?: DevFolder[]
  id: string
  scenes: Scene[]
  contents: string[]
}): LocDeleteResult {
  const { locations, folders, id, scenes, contents } = params
  const loc = locations.find((l) => l.id === id)
  if (!loc) {
    return { locations, folders, contentsPatched: contents, sceneLocPatches: new Map(), headersPatched: 0 }
  }
  const dot = loc.name.indexOf('.')
  const isSub = dot > 0
  const locPart = isSub ? loc.name.slice(0, dot) : loc.name
  const subPart = isSub ? loc.name.slice(dot + 1) : undefined

  const nextFolders = folders?.map((f) => ({ ...f, itemIds: f.itemIds.filter((x) => x !== id) }))

  // Какие сцены затрагиваем и какими станут их location/sublocation
  const sceneLocPatches = new Map<string, { location: string; sublocation?: string }>()
  const newLocById = new Map<string, string>()
  scenes.forEach((sc) => {
    const scLoc = norm(sc.location || '')
    const scSub = norm(sc.sublocation || '')
    if (isSub) {
      if (scLoc === norm(locPart) && scSub === norm(subPart || '')) {
        sceneLocPatches.set(sc.id, { location: sc.location ?? '', sublocation: undefined })
        newLocById.set(sc.id, sc.location || '')
      }
    } else if (scLoc === norm(loc.name)) {
      sceneLocPatches.set(sc.id, { location: '', sublocation: undefined })
      newLocById.set(sc.id, '')
    }
  })

  let headersPatched = 0
  const contentsPatched = contents.map((html) => {
    if (sceneLocPatches.size === 0) return html
    const doc = parse(html)
    doc.querySelectorAll('[data-scene-id]').forEach((el) => {
      const sid = el.getAttribute('data-scene-id') || ''
      if (!sceneLocPatches.has(sid) || !isType(el, 'scene-header', 'sceneHeader')) return
      const m = (el.textContent || '').trim().match(HEADER_RE)
      // группы: 1 — «N. ИНТ. », 2 — локация, 3 — «— ВРЕМЯ» (может отсутствовать)
      if (!m) return
      const locText = newLocById.get(sid) || ''
      const next = `${m[1]}${locText ? `${locText} ` : ''}${(m[3] || '').trim()}`.replace(/\s+/g, ' ').trim()
      if (next !== (el.textContent || '').trim()) { el.textContent = next; headersPatched++ }
    })
    return doc.body.innerHTML
  })

  const nextLocations = locations.filter((l) => l.id !== id)
  return { locations: nextLocations, folders: nextFolders, contentsPatched, sceneLocPatches, headersPatched }
}
