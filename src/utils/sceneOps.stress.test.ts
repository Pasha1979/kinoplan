// @vitest-environment jsdom
// ЧАСТЬ 5 — стресс «любое количество сцен/серий»: move/split/merge/duplicate/delete
// подряд → шапки целые, номера уникальны и подряд, sceneId уникальны,
// текст action не портится, пагинация не падает.
import { describe, it, expect } from 'vitest'
import { createTestEditor } from '../test-utils/createTestEditor'
import {
  allSceneRanges, posOfSceneId,
  duplicateScene, splitScene, mergeScenes, deleteScene, moveScene,
} from './sceneOps'
import { paginateBlocks, type MeasuredBlock } from '../services/pagination'

/** документ из n сцен: шапка + cast + action с уникальными маркерами */
const docN = (n: number, ep?: number) =>
  Array.from({ length: n }, (_, i) => {
    const num = ep != null ? `${ep}-${i + 1}` : `${i + 1}`
    return `<div data-type="scene-header">${num}. ИНТ. ЛОК${i + 1} — ДЕНЬ</div>` +
      `<div data-type="scene-cast">ПЕРС${i + 1}</div>` +
      `<div data-type="scene-action">маркер-${i + 1}</div>`
  }).join('')

type Ed = ReturnType<typeof createTestEditor>
const headers = (e: Ed) => {
  const out: string[] = []
  e.state.doc.forEach((n) => { if (n.type.name === 'sceneHeader') out.push(n.textContent.trim()) })
  return out
}
const nums = (e: Ed) => headers(e).map((h) => h.split('.')[0].trim())
const posInScene = (e: Ed, i: number) => allSceneRanges(e.state.doc)[i].start + 1

/** Инвариант «согласованный документ»: шапки целые, номера уникальны,
 *  основные номера — строго подряд, все sceneId уникальны */
function assertConsistent(e: Ed, ep?: number) {
  const ranges = allSceneRanges(e.state.doc)
  const hs = headers(e)
  expect(hs).toHaveLength(ranges.length)
  const numRe = ep != null ? new RegExp(`^${ep}-(\\d+)(-[А-ЯЁ]+)?\\. `) : /^(\d+)(-[А-ЯЁ]+)?\. /
  hs.forEach((h) => expect(h).toMatch(numRe))
  const ns = nums(e)
  expect(new Set(ns).size).toBe(ns.length)
  // основные номера (без литеры) — подряд 1..P
  const prim = ep != null
    ? ns.filter((n) => /^\d+-\d+$/.test(n)).map((n) => parseInt(n.split('-')[1], 10))
    : ns.filter((n) => /^\d+$/.test(n)).map((n) => parseInt(n, 10))
  expect(prim).toEqual(prim.map((_, i) => i + 1))
  // sceneId уникальны → навигатор/патчи по UUID не путаются
  const ids = ranges.map((r) => r.sceneId)
  expect(new Set(ids).size).toBe(ids.length)
  ranges.forEach((r) => {
    expect(posOfSceneId(e.state.doc, r.sceneId!)).toBe(r.start)
  })
}

describe('стресс: 35 сцен, серия операций подряд', () => {
  it('классика: move+dup+split+merge+delete — документ остаётся согласованным', () => {
    const e = createTestEditor({ content: docN(35) })
    // перемещения с перенумерацией (как Alt+↑/↓ в проде)
    expect(moveScene(e, posInScene(e, 0), 'down', { isSerial: false })).toBe(true)
    expect(moveScene(e, posInScene(e, 20), 'up', { isSerial: false })).toBe(true)
    expect(moveScene(e, posInScene(e, 33), 'up', { isSerial: false })).toBe(true)
    // дубли двух сцен (одна — только что перенесённая)
    expect(duplicateScene(e, posInScene(e, 5))).toBe(true)
    expect(duplicateScene(e, posInScene(e, 30))).toBe(true)
    // разрез сцены пополам
    const mid = allSceneRanges(e.state.doc)
    expect(splitScene(e, mid[10].end - 2)).toBe(true)
    // склейка и удаление
    expect(mergeScenes(e, posInScene(e, 15), 'next')).toBe(true)
    expect(deleteScene(e, posInScene(e, 25))).toBe(true)

    assertConsistent(e)
    // итого: 35 −1 merge −1 delete +2 dup +1 split = 36 сцен
    expect(headers(e)).toHaveLength(36)
    // удалённая сцена потеряла свой маркер, остальные на месте
    const text = e.state.doc.textContent
    const markers = (text.match(/маркер-\d+/g) ?? []).length
    expect(markers).toBeGreaterThanOrEqual(33)
    e.destroy()
  })

  it('классика: серия дублей одной сцены — литеры уплотняются, дублей нет', () => {
    const e = createTestEditor({ content: docN(12) })
    for (let k = 0; k < 4; k++) expect(duplicateScene(e, posInScene(e, 0))).toBe(true)
    assertConsistent(e)
    const ns = nums(e)
    // после «1» четыре литерных варианта: 1-А, 1-Б, 1-В, 1-Г
    expect(ns.slice(0, 5)).toEqual(['1', '1-А', '1-Б', '1-В', '1-Г'])
    e.destroy()
  })

  it.each([1, 2, 3])('серия %i: «E-N» префикс сохраняется, номера подряд', (ep) => {
    const e = createTestEditor({ content: docN(15, ep) })
    // серия операций внутри серии — префикс «E-» не должен слетать
    expect(moveScene(e, posInScene(e, 0), 'down', { isSerial: true, episode: ep })).toBe(true)
    expect(duplicateScene(e, posInScene(e, 7))).toBe(true)
    expect(mergeScenes(e, posInScene(e, 10), 'prev')).toBe(true)
    expect(deleteScene(e, posInScene(e, 13))).toBe(true)
    assertConsistent(e, ep)
    e.destroy()
  })

  it('undo после серии операций: каждое состояние согласовано', () => {
    const e = createTestEditor({ content: docN(12) })
    expect(deleteScene(e, posInScene(e, 8))).toBe(true)
    expect(mergeScenes(e, posInScene(e, 3), 'next')).toBe(true)
    assertConsistent(e)
    e.commands.undo() // откат merge
    assertConsistent(e)
    e.commands.undo() // откат delete
    assertConsistent(e)
    expect(headers(e)).toHaveLength(12)
    e.destroy()
  })

  it('навигатор по UUID после операций: каждая сцена находится по sceneId', () => {
    const e = createTestEditor({ content: docN(20) })
    // sceneIdAssign назначает UUID на первой doc-транзакции (как setContent в проде):
    // первая операция триггерит назначение — фиксируем UUID после неё
    expect(duplicateScene(e, posInScene(e, 2))).toBe(true)
    const before = allSceneRanges(e.state.doc).map((r) => r.sceneId)
    expect(before.every(Boolean)).toBe(true)
    expect(splitScene(e, allSceneRanges(e.state.doc)[10].end - 2)).toBe(true)
    expect(moveScene(e, posInScene(e, 15), 'up', { isSerial: false })).toBe(true)
    // старые UUID на месте (split/dup добавляют новые, существующие не трогают)
    const after = allSceneRanges(e.state.doc)
    const afterIds = new Set(after.map((r) => r.sceneId))
    before.forEach((id) => expect(afterIds.has(id)).toBe(true))
    assertConsistent(e)
    e.destroy()
  })
})

describe('стресс: пагинация 35 сцен не падает', () => {
  it('paginateBlocks на большом документе — разрывы валидны, блоки не теряются', () => {
    // модель блоков как у pageCounter: шапка (h18, mt36), cast (h18, mt0), action (h36, mt18)
    const blocks: MeasuredBlock[] = []
    for (let i = 0; i < 35; i++) {
      blocks.push(
        { heightPx: 18, marginTopPx: 36, marginBottomPx: 0, dataType: 'scene-header' },
        { heightPx: 18, marginTopPx: 0, marginBottomPx: 0, dataType: 'scene-cast' },
        { heightPx: 36, marginTopPx: 18, marginBottomPx: 0, dataType: 'scene-action' },
      )
    }
    const A4_USABLE = Math.round((297 - 25 - 12.5) * (96 / 25.4)) // ~980px
    const r = paginateBlocks(blocks, A4_USABLE, 18)
    expect(r.breaks.length).toBeGreaterThanOrEqual(2) // много страниц
    // разрывы строго возрастают и в пределах массива
    r.breaks.forEach((b, i) => {
      expect(b.page).toBe(i + 1)
      expect(b.startIndex).toBeLessThan(blocks.length)
      if (i > 0) expect(b.startIndex).toBeGreaterThanOrEqual(r.breaks[i - 1].startIndex)
    })
    // шапка не висит внизу страницы без содержимого (keep-with-next):
    // страница не начинается с блока после шапки «одинокой» — startIndex
    // не должен указывать на cast/action сразу после scene-header,
    // если только это не split внутри блока
    r.breaks.slice(1).forEach((b) => {
      if (b.splitOffsetPx == null) {
        const prev = blocks[b.startIndex - 1]
        expect(prev?.dataType).not.toBe('scene-header')
      }
    })
  })
})
