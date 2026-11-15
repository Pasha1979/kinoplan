import { extractSceneHtml, spliceSceneHtml } from './SceneEditModal'
import { insertSceneHtml, renumberHeaders } from './sceneHtmlOps'
import { renumberSceneNumbers } from '../../../utils/sceneNumbering'
import type { Scene } from '../../../types/scene'

/**
 * T-107: undo доски карточек — фрагментные записи вместо копий полного content.
 * - meta: патч полей скрипта (группы/маркеры/связи) — контент не хранится
 * - reorder: обратная перестановка по индексам
 * - move: исходные позиции перенесённых сцен; HTML-фрагменты не хранятся —
 *   при отмене извлекаются из живого контента по стабильным UUID сцен.
 */

export interface BoardUndoMeta {
  sceneGroups?: import('../../../types/scene').SceneGroup[]
  actMarkers?: Record<string, string>
  sceneLinks?: import('../../../types/scene').SceneLink[]
}

export type BoardUndoEntry =
  | { kind: 'meta'; scriptId: string; patch: BoardUndoMeta }
  | { kind: 'reorder'; scriptId: string; fromIndex: number; toIndex: number }
  | { kind: 'move'; fromScriptId: string; toScriptId: string; items: Array<{ sceneId: string; index: number }> }
  /** T-133: слияние персонажей — снапшот development + затронутых скриптов */
  | { kind: 'merge'; development: unknown; scripts: Array<{ id: string; content?: string; scenes?: Scene[] }> }

interface ScriptLike {
  id: string
  content?: string
  scenes?: Scene[]
  episodeNumber?: number
}

/** Перенумерация массива сцен с сохранением литерных суффиксов (1-9-А → 1-6-А) */
export function renumberScenesArr(arr: Scene[], ep: number, isSerial: boolean): Scene[] {
  const nums = renumberSceneNumbers(arr.map((s) => s.number), isSerial, ep)
  return arr.map((s, i) => ({ ...s, number: nums[i], order: i }))
}

export interface RestoreMoveResult {
  homeContent: string
  homeScenes: Scene[]
  /** Пусто, если перенос был внутри одного скрипта */
  destContent: string | null
  destScenes: Scene[] | null
}

/**
 * Отмена переноса: вырезает сцены по UUID из скрипта, куда их перенесли,
 * и вставляет на исходные позиции в скрипт-источник. Вставка по индексам
 * в порядке возрастания корректно восстанавливает и разрозненную выборку.
 */
export function restoreMove(
  home: ScriptLike,
  dest: ScriptLike,
  items: Array<{ sceneId: string; index: number }>,
  isSerial: boolean,
): RestoreMoveResult {
  const pairs = items
    .map((it) => ({ ...it, scene: (home.scenes || []).find((s) => s.id === it.sceneId) }))
    .filter((p): p is typeof p & { scene: Scene } => Boolean(p.scene))
    .sort((a, b) => a.index - b.index)
  let homeContent = home.content || ''
  const frags = pairs.map((p) => extractSceneHtml(homeContent, p.scene.number, 0, p.scene.id))
  pairs.forEach((p) => { homeContent = spliceSceneHtml(homeContent, p.scene.number, 0, '', p.scene.id) })
  const homeScenes = (home.scenes || []).filter((s) => !items.some((i) => i.sceneId === s.id))
  const homeEp = home.episodeNumber ?? 1

  if (home.id === dest.id) {
    pairs.forEach((p, i) => {
      homeContent = insertSceneHtml(homeContent, frags[i], p.index)
      homeScenes.splice(Math.min(p.index, homeScenes.length), 0, p.scene)
    })
    return {
      homeContent: renumberHeaders(homeContent, homeEp, isSerial),
      homeScenes: renumberScenesArr(homeScenes, homeEp, isSerial),
      destContent: null,
      destScenes: null,
    }
  }

  const destEp = dest.episodeNumber ?? 1
  let destContent = dest.content || ''
  const destScenes = [...(dest.scenes || [])]
  pairs.forEach((p, i) => {
    destContent = insertSceneHtml(destContent, frags[i], p.index)
    destScenes.splice(Math.min(p.index, destScenes.length), 0, p.scene)
  })
  return {
    homeContent: renumberHeaders(homeContent, homeEp, isSerial),
    homeScenes: renumberScenesArr(homeScenes, homeEp, isSerial),
    destContent: renumberHeaders(destContent, destEp, isSerial),
    destScenes: renumberScenesArr(destScenes, destEp, isSerial),
  }
}
