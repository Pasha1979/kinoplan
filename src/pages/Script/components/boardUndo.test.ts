// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { restoreMove, renumberScenesArr } from './boardUndo'
import type { Scene } from '../../../types/scene'

const mkScene = (id: string, number: string): Scene => ({
  id, number, type: 'ИНТ', location: 'ДОМ', time: 'ДЕНЬ', pages: 1, cast: [],
})

const frag = (id: string, num: string, label: string) =>
  `<div data-type="scene-header" data-scene-id="${id}">${num}. ИНТ. ${label} — ДЕНЬ.</div>` +
  `<div data-type="scene-action">Действие ${id}.</div>`

const mkScript = (id: string, scenes: Scene[], ep?: number) => ({
  id,
  episodeNumber: ep,
  scenes,
  content: scenes.map((s) => frag(s.id, s.number, `ЛОК-${s.id}`)).join(''),
})

// Порядок сцен в результирующем контенте — по data-scene-id в шапках
const orderIn = (content: string) =>
  [...content.matchAll(/data-scene-id="([^"]+)"/g)].map((m) => m[1])

describe('restoreMove (T-107)', () => {
  it('внутри скрипта: сцены возвращаются на исходные позиции', () => {
    // было [a,b,c,d], перенесли a,b в конец → стало [c,d,a,b]
    const cur = mkScript('s', [mkScene('c', '1'), mkScene('d', '2'), mkScene('a', '3'), mkScene('b', '4')])
    const r = restoreMove(cur, cur, [
      { sceneId: 'a', index: 0 },
      { sceneId: 'b', index: 1 },
    ], false)
    expect(orderIn(r.homeContent)).toEqual(['a', 'b', 'c', 'd'])
    expect(r.homeScenes.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(r.homeScenes.map((s) => s.number)).toEqual(['1', '2', '3', '4'])
    expect(r.destContent).toBeNull()
  })

  it('разрозненная выборка: b@1 и d@3 возвращаются на свои места', () => {
    // было [a,b,c,d,e] → перенесли b,d в конец → [a,c,e,b,d]
    const cur = mkScript('s', [mkScene('a', '1'), mkScene('c', '2'), mkScene('e', '3'), mkScene('b', '4'), mkScene('d', '5')])
    const r = restoreMove(cur, cur, [
      { sceneId: 'b', index: 1 },
      { sceneId: 'd', index: 3 },
    ], false)
    expect(orderIn(r.homeContent)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(r.homeScenes.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('кросс-серия: сцена возвращается в исходную серию с перенумерацией', () => {
    // s1 был [a(1-1), b(1-2)]; b перенесли в s2 на 0-ю позицию → s2 [b(2-1), c(2-2)]
    const s1 = mkScript('s1', [mkScene('a', '1-1')], 1)
    const s2 = mkScript('s2', [mkScene('b', '2-1'), mkScene('c', '2-2')], 2)
    const r = restoreMove(s2, s1, [{ sceneId: 'b', index: 1 }], true)
    // источник: b вернулась на исходную позицию 1
    expect(r.destScenes!.map((s) => s.id)).toEqual(['a', 'b'])
    expect(r.destScenes!.map((s) => s.number)).toEqual(['1-1', '1-2'])
    expect(orderIn(r.destContent!)).toEqual(['a', 'b'])
    // дом: остался c, перенумерован
    expect(r.homeScenes.map((s) => s.id)).toEqual(['c'])
    expect(r.homeScenes.map((s) => s.number)).toEqual(['2-1'])
    expect(orderIn(r.homeContent)).toEqual(['c'])
    // текст шапок перенумерован под серии
    expect(r.destContent!).toContain('1-2. ИНТ.')
    expect(r.homeContent).toContain('2-1. ИНТ.')
  })

  it('сцена уже отсутствует в доме → пропускается без падения', () => {
    const cur = mkScript('s', [mkScene('a', '1')])
    const r = restoreMove(cur, cur, [{ sceneId: 'ghost', index: 0 }], false)
    expect(orderIn(r.homeContent)).toEqual(['a'])
    expect(r.homeScenes).toHaveLength(1)
  })
})

describe('renumberScenesArr', () => {
  it('литерные суффиксы сохраняются при перенумерации', () => {
    // варианты берут базу от предыдущей основной сцены и уплотняются А,Б,В…
    const arr = [mkScene('p', '5'), mkScene('x', '9-В'), mkScene('y', '9-Г')]
    const nums = renumberScenesArr(arr, 1, true)
    expect(nums.map((s) => s.number)).toEqual(['1-1', '1-1-А', '1-1-Б'])
    expect(nums.map((s) => s.order)).toEqual([0, 1, 2])
  })
})
