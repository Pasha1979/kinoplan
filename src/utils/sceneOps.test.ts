// @vitest-environment jsdom
// Блок B: хирургия сцен — duplicate / split / merge / delete / move
import { describe, it, expect } from 'vitest'
import { createTestEditor } from '../test-utils/createTestEditor'
import {
  allSceneRanges, sceneAtPos, nextLetteredNumber,
  duplicateScene, splitScene, mergeScenes, deleteScene, moveScene,
} from './sceneOps'

const DOC = [
  '<div data-type="scene-header">5. ИНТ. ДОМ — ДЕНЬ</div>',
  '<div data-type="scene-cast">ИВАН</div>',
  '<div data-type="scene-action">Вошёл.</div>',
  '<div data-type="scene-header">6. ЭКСТ. УЛИЦА — НОЧЬ</div>',
  '<div data-type="scene-action">Дождь.</div>',
  '<div data-type="scene-header">7. ИНТ. ОФИС — УТРО</div>',
  '<div data-type="scene-action">Тишина.</div>',
].join('')

function ed(html = DOC) {
  const e = createTestEditor()
  e.commands.setContent(html)
  return e
}

const headers = (e: ReturnType<typeof ed>) => {
  const out: string[] = []
  e.state.doc.forEach((n) => { if (n.type.name === 'sceneHeader') out.push(n.textContent) })
  return out
}

/** позиция внутри сцены i (в первом не-шапочном блоке) */
function posInScene(e: ReturnType<typeof ed>, i: number) {
  const r = allSceneRanges(e.state.doc)[i]
  return r.start + 1 + (e.state.doc.nodeAt(r.start)?.nodeSize ?? 0) + 1
}

describe('sceneOps — диапазоны и номера', () => {
  it('allSceneRanges: три сцены с номерами', () => {
    const e = ed()
    const r = allSceneRanges(e.state.doc)
    expect(r.map((s) => s.number)).toEqual(['5', '6', '7'])
    expect(r[0].end).toBe(r[1].start)
    e.destroy()
  })

  it('sceneAtPos находит сцену по курсору в любой точке', () => {
    const e = ed()
    expect(sceneAtPos(e.state.doc, posInScene(e, 1))!.range.number).toBe('6')
    expect(sceneAtPos(e.state.doc, 0)!.range.number).toBe('5') // позиция 0 — начало шапки первой сцены
    e.destroy()
  })

  it('nextLetteredNumber: «5»→«5-А», «5-А»→«5-Б», «1-9-В»→«1-9-Г»', () => {
    expect(nextLetteredNumber('5')).toBe('5-А')
    expect(nextLetteredNumber('5-А')).toBe('5-Б')
    expect(nextLetteredNumber('1-9-В')).toBe('1-9-Г')
    expect(nextLetteredNumber('1-9')).toBe('1-9-А')
  })
})

describe('sceneOps — дублирование', () => {
  it('копия сцены встаёт ниже с литерным номером и новым sceneId', () => {
    const e = ed()
    const srcId = e.state.doc.nodeAt(0)!.attrs.sceneId
    expect(duplicateScene(e, posInScene(e, 0))).toBe(true)
    const h = headers(e)
    expect(h[0]).toMatch(/^5\./)
    expect(h[1]).toMatch(/^5-А\. ИНТ\. ДОМ/)
    const dupId = allSceneRanges(e.state.doc)[1].sceneId
    expect(dupId).toBeTruthy()
    expect(dupId).not.toBe(srcId)
    e.destroy()
  })
})

describe('sceneOps — разделение', () => {
  it('разрез перед блоком: хвост становится новой сценой с литерой и копией шапки', () => {
    const e = ed()
    const r = allSceneRanges(e.state.doc)
    // позиция в action-блоке первой сцены (после шапки+cast)
    const hit = sceneAtPos(e.state.doc, r[0].end - 2)!
    expect(splitScene(e, hit.range.end - 2)).toBe(true)
    const h = headers(e)
    expect(h).toHaveLength(4)
    expect(h[1]).toMatch(/^5-А\. ИНТ\. ДОМ/) // копия шапки с литерой
    e.destroy()
  })

  it('курсор в шапке → разделение не срабатывает', () => {
    const e = ed()
    const r = allSceneRanges(e.state.doc)
    expect(splitScene(e, r[0].start + 2)).toBe(false)
    e.destroy()
  })
})

describe('sceneOps — склейка', () => {
  it('merge next: шапка+cast следующей сцены уходят, контент склеивается', () => {
    const e = ed()
    expect(mergeScenes(e, posInScene(e, 0), 'next')).toBe(true)
    const h = headers(e)
    expect(h).toEqual(['5. ИНТ. ДОМ — ДЕНЬ', '7. ИНТ. ОФИС — УТРО'])
    expect(e.state.doc.textContent).toContain('Дождь.')
    e.destroy()
  })

  it('merge prev у первой сцены → false', () => {
    const e = ed()
    expect(mergeScenes(e, posInScene(e, 0), 'prev')).toBe(false)
    e.destroy()
  })
})

describe('sceneOps — удаление и перемещение', () => {
  it('deleteScene удаляет сцену целиком', () => {
    const e = ed()
    expect(deleteScene(e, posInScene(e, 1))).toBe(true)
    expect(headers(e)).toEqual(['5. ИНТ. ДОМ — ДЕНЬ', '7. ИНТ. ОФИС — УТРО'])
    expect(e.state.doc.textContent).not.toContain('Дождь.')
    e.destroy()
  })

  it('moveScene с opts перенумеровывает сцены подряд', () => {
    const e = ed()
    expect(moveScene(e, posInScene(e, 0), 'down', { isSerial: false })).toBe(true)
    const h = headers(e)
    // перенумерация подряд: бывшая 6 → 1, бывшая 5 → 2, 7 → 3
    expect(h[0]).toMatch(/^1\. ЭКСТ\. УЛИЦА/)
    expect(h[1]).toMatch(/^2\. ИНТ\. ДОМ/)
    expect(h[2]).toMatch(/^3\. ИНТ\. ОФИС/)
    e.destroy()
  })

  it('moveScene с opts в сериале нумерует «серия-сцена»', () => {
    const e = ed([
      '<div data-type="scene-header">1-1. ИНТ. ДОМ — ДЕНЬ</div>',
      '<div data-type="scene-action">a</div>',
      '<div data-type="scene-header">1-2. ЭКСТ. УЛИЦА — НОЧЬ</div>',
      '<div data-type="scene-action">b</div>',
    ].join(''))
    const hit = sceneAtPos(e.state.doc, allSceneRanges(e.state.doc)[0].start + 1)!
    void hit
    expect(moveScene(e, allSceneRanges(e.state.doc)[0].start + 1, 'down', { isSerial: true, episode: 1 })).toBe(true)
    expect(headers(e)).toEqual(['1-1. ЭКСТ. УЛИЦА — НОЧЬ', '1-2. ИНТ. ДОМ — ДЕНЬ'])
    e.destroy()
  })

  it('moveScene down/up меняет порядок сцен', () => {
    const e = ed()
    expect(moveScene(e, posInScene(e, 0), 'down')).toBe(true)
    expect(headers(e)).toEqual([
      '6. ЭКСТ. УЛИЦА — НОЧЬ', '5. ИНТ. ДОМ — ДЕНЬ', '7. ИНТ. ОФИС — УТРО',
    ])
    expect(moveScene(e, posInScene(e, 1), 'up')).toBe(true)
    expect(headers(e)).toEqual([
      '5. ИНТ. ДОМ — ДЕНЬ', '6. ЭКСТ. УЛИЦА — НОЧЬ', '7. ИНТ. ОФИС — УТРО',
    ])
    e.destroy()
  })
})
