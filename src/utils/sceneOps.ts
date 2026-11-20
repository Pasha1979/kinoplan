// Блок B: хирургия сцен в живом PM-документе — дублирование, разрез, склейка,
// удаление, перемещение. Все операции — одна транзакция (undo атомарно).
// Нумерация новых сцен — литерная по существующей конвенции «база-буква».
import type { Editor } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import { DOMParser as PMDOMParser, DOMSerializer, type Node as PMNode } from '@tiptap/pm/model'
import { TextSelection, type Transaction } from '@tiptap/pm/state'
import { SCENE_NUMBER } from './sceneNumber'
import { renumberSceneNumbers } from './sceneNumbering'

const CYR = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ'

export interface SceneRange {
  /** позиция перед узлом шапки */
  start: number
  /** позиция перед следующей шапкой или конец контента */
  end: number
  /** номер сцены из текста шапки («5», «1-9-А») */
  number: string
  /** UUID сцены (может отсутствовать у старых документов) */
  sceneId: string | null
}

const numRe = new RegExp(`^(${SCENE_NUMBER})\\.`)
const isHeader = (n: PMNode) => n.type.name === 'sceneHeader'

function numberOf(header: PMNode): string {
  return header.textContent.trim().match(numRe)?.[1]?.trim() ?? ''
}

/** Список всех сцен документа в порядке следования. */
export function allSceneRanges(doc: PMNode): SceneRange[] {
  const ranges: SceneRange[] = []
  let p = 0
  doc.forEach((node) => {
    if (isHeader(node)) {
      const last = ranges[ranges.length - 1]
      if (last) last.end = p
      ranges.push({ start: p, end: -1, number: numberOf(node), sceneId: (node.attrs.sceneId as string | null) ?? null })
    }
    p += node.nodeSize
  })
  const last = ranges[ranges.length - 1]
  if (last && last.end < 0) last.end = p
  return ranges
}

/** Позиция начала сцены по UUID шапки (для вызовов из навигатора). */
export function posOfSceneId(doc: PMNode, sceneId: string): number | null {
  let p = 0
  let found: number | null = null
  doc.forEach((node) => {
    if (found === null && isHeader(node) && node.attrs.sceneId === sceneId) found = p
    p += node.nodeSize
  })
  return found
}

/** Сцена по позиции курсора. */
export function sceneAtPos(doc: PMNode, pos: number): { range: SceneRange; index: number } | null {
  const ranges = allSceneRanges(doc)
  for (let i = 0; i < ranges.length; i++) {
    if (pos >= ranges[i].start && pos < ranges[i].end) return { range: ranges[i], index: i }
  }
  // курсор в хвосте после последней сцены или до первой — ближайшая по позиции
  return null
}

const stripNote = (n: string) => n.replace(/\s*\([^)]*\)$/, '')

/**
 * Литерный номер для новой сцены рядом с number:
 * «5» → «5-А», «1-5-А» → «1-5-Б» (по правилу пользователя, совпадает с renumberSceneNumbers).
 */
export function nextLetteredNumber(number: string): string {
  const core = stripNote(number.trim())
  const m = core.match(/-([А-ЯЁA-Z]+)$/)
  if (!m) return `${core}-А`
  const letters = m[1]
  const last = letters[letters.length - 1]
  const idx = CYR.indexOf(last)
  const next = idx >= 0 && idx < CYR.length - 1 ? CYR[idx + 1] : `${last}2`
  return core.slice(0, -1) + next
}

/** Возвращает номер с заменой в тексте шапки. */
function withNumber(headerText: string, newNumber: string): string {
  const t = headerText.trim()
  return `${newNumber}. ${t.replace(numRe, '').trim()}`
}

type Ed = Editor | EditorView
const viewOf = (e: Ed): EditorView => ('view' in e ? e.view : e)
const stateOf = (e: Ed) => viewOf(e).state

/** Дублировать сцену под курсором: копия ниже, литерный номер, новый UUID. */
export function duplicateScene(editor: Ed, pos: number): boolean {
  const hit = sceneAtPos(stateOf(editor).doc, pos)
  if (!hit) return false
  const { state } = editor
  const { doc, schema, tr } = { doc: state.doc, schema: state.schema, tr: state.tr }
  const slice = doc.slice(hit.range.start, hit.range.end)
  // Копия узлов с новым sceneId и литерным номером в шапке
  const nodes: PMNode[] = []
  let first = true
  slice.content.forEach((node) => {
    if (first && isHeader(node)) {
      nodes.push(node.type.create(
        { ...node.attrs, sceneId: crypto.randomUUID() },
        schema.text(withNumber(node.textContent, nextLetteredNumber(hit.range.number))),
        node.marks,
      ))
      first = false
    } else {
      nodes.push(node.copy(node.content))
    }
  })
  if (!nodes.length) return false
  tr.insert(hit.range.end, nodes)
  renumberStructural(tr)
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(hit.range.end + 2, tr.doc.content.size))))
  viewOf(editor).dispatch(tr.scrollIntoView())
  return true
}

/**
 * Разделить сцену в позиции курсора: с того блока, где курсор, начинается новая
 * сцена с литерным номером и шапкой-копией текущей (та же локация/время).
 * Если курсор в самой шапке — не разделяем.
 */
export function splitScene(editor: Ed, pos: number): boolean {
  const hit = sceneAtPos(stateOf(editor).doc, pos)
  if (!hit) return false
  const { state } = editor
  const { doc } = state
  const $pos = doc.resolve(pos)
  if ($pos.depth < 1) return false
  // позиция перед блоком, в котором стоит курсор — с него начнётся новая сцена
  const blockPos = $pos.before(1)
  if (blockPos <= hit.range.start) return false // курсор в шапке — нечего отделять
  const header = doc.nodeAt(hit.range.start)
  if (!header) return false
  const newHeader = header.type.create(
    { ...header.attrs, sceneId: crypto.randomUUID() },
    state.schema.text(withNumber(header.textContent, nextLetteredNumber(hit.range.number))),
  )
  const tr = state.tr.insert(blockPos, newHeader)
  renumberStructural(tr)
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(blockPos + newHeader.nodeSize + 1, tr.doc.content.size))))
  viewOf(editor).dispatch(tr.scrollIntoView())
  return true
}

/** Слить сцену под курсором с соседней: чужая шапка+состав удаляются, контент склеивается. */
export function mergeScenes(editor: Ed, pos: number, dir: 'prev' | 'next'): boolean {
  const hit = sceneAtPos(stateOf(editor).doc, pos)
  if (!hit) return false
  const { state } = editor
  const { doc } = state
  const ranges = allSceneRanges(doc)
  const other = dir === 'next' ? ranges[hit.index + 1] : ranges[hit.index - 1]
  if (!other) return false

  // Удаляем шапку соседней сцены + её блок состава (если сразу за шапкой)
  const tr = state.tr
  const headerEnd = other.start + (doc.nodeAt(other.start)?.nodeSize ?? 0)
  let delTo = headerEnd
  const afterHeader = doc.nodeAt(headerEnd)
  if (afterHeader && afterHeader.type.name === 'sceneCast') delTo += afterHeader.nodeSize
  tr.delete(other.start, delTo)
  renumberStructural(tr)
  viewOf(editor).dispatch(tr.scrollIntoView())
  return true
}

/** Удалить сцену под курсором целиком (от шапки до следующей). */
export function deleteScene(editor: Ed, pos: number): boolean {
  const hit = sceneAtPos(stateOf(editor).doc, pos)
  if (!hit) return false
  const tr = stateOf(editor).tr.delete(hit.range.start, hit.range.end)
  renumberStructural(tr)
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(hit.range.start, tr.doc.content.size))))
  viewOf(editor).dispatch(tr.scrollIntoView())
  return true
}

/** Текущая сцена как HTML-фрагмент (для сохранения в шаблоны). */
export function sceneHtmlAt(e: Ed, pos: number): string | null {
  const hit = sceneAtPos(stateOf(e).doc, pos)
  if (!hit) return null
  const state = stateOf(e)
  const slice = state.doc.slice(hit.range.start, hit.range.end)
  const wrap = document.createElement('div')
  wrap.appendChild(DOMSerializer.fromSchema(state.schema).serializeFragment(slice.content))
  return wrap.innerHTML
}

/**
 * Вставить сцену из HTML-шаблона сразу после сцены под курсором.
 * Номер в шапке шаблона подменяется литерным относительно текущей сцены.
 */
export function insertSceneFromHtml(e: Ed, pos: number, sceneHtml: string): boolean {
  const hit = sceneAtPos(stateOf(e).doc, pos)
  if (!hit) return false
  const state = stateOf(e)
  const numbered = sceneHtml.replace(
    new RegExp(`(<div[^>]*data-type="scene-header"[^>]*>)\\s*${SCENE_NUMBER}\\.`),
    `$1${nextLetteredNumber(hit.range.number)}.`,
  )
  const dom = new window.DOMParser().parseFromString(numbered, 'text/html')
  const slice = PMDOMParser.fromSchema(state.schema).parseSlice(dom.body)
  const tr = state.tr.insert(hit.range.end, slice.content)
  renumberStructural(tr)
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(hit.range.end + 2, tr.doc.content.size))))
  viewOf(e).dispatch(tr.scrollIntoView())
  return true
}

/** Перенумеровать все шапки в транзакции (литеры сохраняются, основные идут подряд).
 *  Правки применяются с конца документа к началу: insertText в позиции поздних
 *  шапок не сдвигает собранные ранее позиции ранних — переход «9.»→«10.»
 *  (смена длины номера) не ломает остальные шапки. */
function renumberHeadersInTr(tr: Transaction, isSerial: boolean, episode: number) {
  const headers: { pos: number; num: string }[] = []
  let p = 0
  tr.doc.forEach((node) => {
    if (isHeader(node)) headers.push({ pos: p, num: numberOf(node) })
    p += node.nodeSize
  })
  const next = renumberSceneNumbers(headers.map((h) => h.num), isSerial, episode)
  const prefixRe = new RegExp(`^(${SCENE_NUMBER})\\.\\s*`)
  for (let i = headers.length - 1; i >= 0; i--) {
    const h = headers[i]
    if (h.num === next[i]) continue
    const node = tr.doc.nodeAt(h.pos)
    if (!node) continue
    const m = node.textContent.match(prefixRe)
    const cut = m ? m[0].length : 0
    // pos+1 — начало текста внутри узла шапки
    tr.insertText(`${next[i]}. `, h.pos + 1, h.pos + 1 + cut)
  }
}

/** Серийность и серия выводятся из номеров документа: «1-5» → сериал, серия 1. */
function serialInfoOf(nums: string[]): { isSerial: boolean; episode: number } {
  for (const n of nums) {
    const m = stripNote(n).trim().match(/^(\d+)-(\d+)/)
    if (m) return { isSerial: true, episode: parseInt(m[1], 10) }
  }
  return { isSerial: false, episode: 0 }
}

/**
 * Перенумерация после структурной операции (merge/delete/duplicate/split/insert) —
 * в той же транзакции, undo атомарен. Убирает дырки и гарантирует уникальность:
 * литеры уплотняются по порядку документа, второй «5-А» не образуется.
 */
function renumberStructural(tr: Transaction) {
  const nums: string[] = []
  tr.doc.forEach((node) => { if (isHeader(node)) nums.push(numberOf(node)) })
  const { isSerial, episode } = serialInfoOf(nums)
  renumberHeadersInTr(tr, isSerial, episode)
}

/** Переместить сцену под курсором на шаг вверх/вниз по списку сцен (с перенумерацией). */
export function moveScene(
  editor: Ed, pos: number, dir: 'up' | 'down',
  opts?: { isSerial?: boolean; episode?: number },
): boolean {
  const hit = sceneAtPos(stateOf(editor).doc, pos)
  if (!hit) return false
  const state = stateOf(editor)
  const { doc } = state
  const ranges = allSceneRanges(doc)
  const other = dir === 'down' ? ranges[hit.index + 1] : ranges[hit.index - 1]
  if (!other) return false

  const slice = doc.slice(hit.range.start, hit.range.end)
  const tr = state.tr
  if (dir === 'down') {
    tr.delete(hit.range.start, hit.range.end)
    tr.insert(tr.mapping.map(other.end), slice.content)
  } else {
    tr.insert(other.start, slice.content)
    tr.delete(tr.mapping.map(hit.range.start), tr.mapping.map(hit.range.end))
  }
  if (opts) renumberHeadersInTr(tr, !!opts.isSerial, opts.episode ?? 0)
  viewOf(editor).dispatch(tr.scrollIntoView())
  return true
}
