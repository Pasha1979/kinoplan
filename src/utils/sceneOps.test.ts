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
    // renumber после операции: основные подряд, копия — литера от первой
    expect(h[0]).toMatch(/^1\. ИНТ\. ДОМ/)
    expect(h[1]).toMatch(/^1-А\. ИНТ\. ДОМ/)
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
    expect(h[1]).toMatch(/^1-А\. ИНТ\. ДОМ/) // копия шапки с литерой (после renumber)
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
    // renumber в той же транзакции: дырок нет, номера подряд
    expect(h).toEqual(['1. ИНТ. ДОМ — ДЕНЬ', '2. ИНТ. ОФИС — УТРО'])
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
    expect(headers(e)).toEqual(['1. ИНТ. ДОМ — ДЕНЬ', '2. ИНТ. ОФИС — УТРО'])
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

// P0: renumberHeadersInTr — правки шапок применяются с конца документа,
// иначе смена длины номера («9.»→«10.») сдвигает позиции следующих шапок
describe('renumberHeadersInTr — длина номера не ломает шапки', () => {
  /** документ из N сцен: шапка + action с уникальным текстом */
  const docN = (n: number, serial = false) =>
    Array.from({ length: n }, (_, i) => {
      const num = serial ? `1-${i + 1}` : `${i + 1}`
      return `<div data-type="scene-header">${num}. ИНТ. ЛОК${i + 1} — ДЕНЬ</div>` +
        `<div data-type="scene-action">действие${i + 1}</div>`
    }).join('')

  const headerNums = (e: ReturnType<typeof ed>) =>
    headers(e).map((h) => h.split('.')[0].trim())

  it('12+ сцен: переход 9→10 не портит шапки и action', () => {
    const e = ed(docN(14))
    // хвост 10..14 → вверх документа: полная перенумерация всех шапок
    const last = allSceneRanges(e.state.doc).length - 1
    for (let i = 0; i < 4; i++) {
      moveScene(e, allSceneRanges(e.state.doc)[last - i].start + 1, 'up', { isSerial: false })
    }
    // теперь двигаем первую сцену в конец — все номера сдвигаются, 9→10 обязателен
    moveScene(e, allSceneRanges(e.state.doc)[0].start + 1, 'down', { isSerial: false })
    // после серии ходов проверяем целостность: сцен столько же, все шапки целые
    const hs = headers(e)
    expect(hs).toHaveLength(14)
    hs.forEach((h) => expect(h).toMatch(/^\d+\. ИНТ\. ЛОК\d+ — ДЕНЬ$/))
    // номера — строго подряд 1..14 без дырок и дублей
    expect(headerNums(e)).toEqual(Array.from({ length: 14 }, (_, i) => `${i + 1}`))
    // action-блоки не повреждены
    for (let i = 1; i <= 14; i++) expect(e.state.doc.textContent).toContain(`действие${i}`)
    e.destroy()
  })

  it('9→10 напрямую: перемещение сцены через границу двухзначных', () => {
    const e = ed(docN(12))
    // сцену 9 в самый низ: ей достаётся 12, а 10..12 подтягиваются вверх
    for (let i = 0; i < 3; i++) {
      const idx = allSceneRanges(e.state.doc).findIndex((r) => r.number === '9')
      moveScene(e, allSceneRanges(e.state.doc)[idx].start + 1, 'down', { isSerial: false })
    }
    const hs = headers(e)
    expect(hs).toHaveLength(12)
    hs.forEach((h) => expect(h).toMatch(/^\d+\. ИНТ\. ЛОК\d+ — ДЕНЬ$/))
    expect(headerNums(e)).toEqual(Array.from({ length: 12 }, (_, i) => `${i + 1}`))
    for (let i = 1; i <= 12; i++) expect(e.state.doc.textContent).toContain(`действие${i}`)
    e.destroy()
  })

  it('литерные 5-А/5-Б: литеры уплотняются, шапки целые', () => {
    const e = ed([
      '<div data-type="scene-header">5. ИНТ. А — ДЕНЬ</div>',
      '<div data-type="scene-action">a</div>',
      '<div data-type="scene-header">5-А. ИНТ. Б — ДЕНЬ</div>',
      '<div data-type="scene-action">b</div>',
      '<div data-type="scene-header">5-Б. ИНТ. В — НОЧЬ</div>',
      '<div data-type="scene-action">c</div>',
      '<div data-type="scene-header">6. ЭКСТ. Г — УТРО</div>',
      '<div data-type="scene-action">d</div>',
    ].join(''))
    // «5-А» в конец документа → должна стать «4-А» (литера от последней основной)
    for (let i = 0; i < 3; i++) {
      const idx = allSceneRanges(e.state.doc).findIndex((r) => r.number === '5-А')
      if (idx < 0 || idx >= allSceneRanges(e.state.doc).length - 1) break
      moveScene(e, allSceneRanges(e.state.doc)[idx].start + 1, 'down', { isSerial: false })
    }
    const hs = headers(e)
    expect(hs).toHaveLength(4)
    hs.forEach((h) => expect(h).toMatch(/^\d+(?:-[А-ЯЁ]+)?\. /))
    // все номера уникальны
    const nums = headerNums(e)
    expect(new Set(nums).size).toBe(nums.length)
    e.destroy()
  })

  it('сериал 10+ сцен: «серия-сцена» подряд, переход 1-9→1-10 целый', () => {
    const e = ed(docN(12, true))
    // сцену 1-2 в конец — полная перенумерация через границу 1-9→1-10
    for (let i = 0; i < 10; i++) {
      const idx = allSceneRanges(e.state.doc).findIndex((r) => r.number === '1-2')
      if (idx < 0 || idx >= allSceneRanges(e.state.doc).length - 1) break
      moveScene(e, allSceneRanges(e.state.doc)[idx].start + 1, 'down', { isSerial: true, episode: 1 })
    }
    const hs = headers(e)
    expect(hs).toHaveLength(12)
    hs.forEach((h) => expect(h).toMatch(/^1-\d+\. ИНТ\. ЛОК\d+ — ДЕНЬ$/))
    expect(headerNums(e)).toEqual(Array.from({ length: 12 }, (_, i) => `1-${i + 1}`))
    for (let i = 1; i <= 12; i++) expect(e.state.doc.textContent).toContain(`действие${i}`)
    e.destroy()
  })

// P1: после merge/delete/duplicate/split — renumber в той же транзакции:
// дырок нет, номера уникальны и подряд, литеры уплотнены, undo атомарен
describe('sceneOps — согласованная нумерация после операций', () => {
  const docN = (n: number, serial = false) =>
    Array.from({ length: n }, (_, i) => {
      const num = serial ? `1-${i + 1}` : `${i + 1}`
      return `<div data-type="scene-header">${num}. ИНТ. ЛОК${i + 1} — ДЕНЬ</div>` +
        `<div data-type="scene-action">действие${i + 1}</div>`
    }).join('')
  const nums = (e: ReturnType<typeof ed>) => headers(e).map((h) => h.split('.')[0].trim())
  const seqNums = (n: number, serial = false) =>
    Array.from({ length: n }, (_, i) => serial ? `1-${i + 1}` : `${i + 1}`)

  it('merge при 12 сценах: дырок нет, номера подряд', () => {
    const e = ed(docN(12))
    expect(mergeScenes(e, posInScene(e, 5), 'next')).toBe(true)
    const hs = headers(e)
    expect(hs).toHaveLength(11)
    hs.forEach((h) => expect(h).toMatch(/^\d+\. ИНТ\. ЛОК\d+ — ДЕНЬ$/))
    expect(nums(e)).toEqual(seqNums(11))
    e.destroy()
  })

  it('delete при 12 сценах: дырок нет, undo возвращает всё разом', () => {
    const e = createTestEditor({ content: docN(12) })
    const before = headers(e)
    expect(deleteScene(e, posInScene(e, 8))).toBe(true)
    expect(nums(e)).toEqual(seqNums(11))
    e.commands.undo()
    expect(headers(e)).toEqual(before)
    e.destroy()
  })

  it('merge/delete в сериале 10+ сцен: «серия-сцена» подряд без дырок', () => {
    const e = createTestEditor({ content: docN(11, true) })
    expect(deleteScene(e, posInScene(e, 4))).toBe(true)
    expect(nums(e)).toEqual(seqNums(10, true))
    expect(mergeScenes(e, posInScene(e, 6), 'next')).toBe(true)
    expect(nums(e)).toEqual(seqNums(9, true))
    e.destroy()
  })

  it('duplicate при занятой «5-А» → уникальная литера, дублей нет', () => {
    const e = ed([
      '<div data-type="scene-header">5. ИНТ. ДОМ — ДЕНЬ</div>',
      '<div data-type="scene-action">a</div>',
      '<div data-type="scene-header">5-А. ИНТ. ДОМ — ДЕНЬ</div>',
      '<div data-type="scene-action">b</div>',
      '<div data-type="scene-header">6. ЭКСТ. УЛИЦА — НОЧЬ</div>',
      '<div data-type="scene-action">c</div>',
    ].join(''))
    // дублируем «5» — копия встаёт после неё; renumber уплотняет литеры → А,Б
    expect(duplicateScene(e, posInScene(e, 0))).toBe(true)
    const ns = nums(e)
    expect(ns).toEqual(['1', '1-А', '1-Б', '2'])
    expect(new Set(ns).size).toBe(ns.length)
    e.destroy()
  })

  it('split при занятой литере → уникальная литера, undo возвращает одну сцену', () => {
    const e = createTestEditor({ content: [
      '<div data-type="scene-header">5. ИНТ. ДОМ — ДЕНЬ</div>',
      '<div data-type="scene-action">a</div>',
      '<div data-type="scene-action">хвост сцены</div>',
      '<div data-type="scene-header">5-А. ИНТ. ДОМ — НОЧЬ</div>',
      '<div data-type="scene-action">b</div>',
    ].join('') })
    const before = headers(e)
    // разрез по второму action первой сцены
    const r = allSceneRanges(e.state.doc)
    expect(splitScene(e, r[0].end - 2)).toBe(true)
    const ns = nums(e)
    expect(ns).toEqual(['1', '1-А', '1-Б'])
    expect(new Set(ns).size).toBe(3)
    e.commands.undo()
    expect(headers(e)).toEqual(before)
    e.destroy()
  })

  it('undo атомарен: merge возвращается одним Ctrl+Z', () => {
    const e = createTestEditor({ content: docN(12) })
    const before = headers(e)
    expect(mergeScenes(e, posInScene(e, 5), 'next')).toBe(true)
    e.commands.undo()
    expect(headers(e)).toEqual(before)
    e.destroy()
  })
})

  it('undo атомарен: один Ctrl+Z возвращает и порядок, и номера', () => {
    // контент через конструктор: иначе setContent+move группируются историей PM
    // (newGroupDelay 500мс) и undo откатил бы обе транзакции разом
    const e = createTestEditor({ content: docN(12) })
    const before = headers(e)
    moveScene(e, allSceneRanges(e.state.doc)[0].start + 1, 'down', { isSerial: false })
    expect(headers(e)).not.toEqual(before)
    e.commands.undo()
    expect(headers(e)).toEqual(before)
    e.destroy()
  })
})
