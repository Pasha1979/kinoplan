// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { extractSceneHtml, spliceSceneHtml } from './SceneEditModal'

const DOC = `
<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ.</div>
<div data-type="scene-action">Первая ремарка сцены 1.</div>
<div data-type="scene-header">2. ИНТ. САД — НОЧЬ.</div>
<div data-type="scene-action">Ремарка сцены 2.</div>
<div data-type="scene-character">ИВАН</div>
<div data-type="scene-dialog">Реплика.</div>
<div data-type="scene-header">3. ЭКСТ. ЛЕС — ДЕНЬ.</div>
<div data-type="scene-action">Ремарка сцены 3.</div>
`

describe('extractSceneHtml', () => {
  it('извлекает сцену целиком: шапка + все блоки до следующей шапки', () => {
    const html = extractSceneHtml(DOC, '2', 1)
    expect(html).toContain('2. ИНТ. САД — НОЧЬ.')
    expect(html).toContain('Ремарка сцены 2.')
    expect(html).toContain('ИВАН')
    expect(html).toContain('Реплика.')
    expect(html).not.toContain('сцены 1')
    expect(html).not.toContain('сцены 3')
  })

  it('находит сцену по номеру в тексте шапки, а не по индексу', () => {
    // fallbackIndex намеренно неверный — номер важнее
    const html = extractSceneHtml(DOC, '3', 0)
    expect(html).toContain('3. ЭКСТ. ЛЕС')
    expect(html).not.toContain('сцены 2')
  })

  it('последняя сцена — до конца документа', () => {
    const html = extractSceneHtml(DOC, '3', 2)
    expect(html).toContain('Ремарка сцены 3.')
  })

  it('включает блоки БЕЗ data-type (обычные <p>) — причина обрезки', () => {
    const doc = `
<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ.</div>
<p>Длинная ремарка без data-type.</p>
<p>Ещё одна.</p>
<div data-type="scene-action">действие</div>
<div data-type="scene-header">2. ИНТ. САД — НОЧЬ.</div>
<div data-type="scene-action">след</div>`
    const html = extractSceneHtml(doc, '1', 0)
    expect(html).toContain('Длинная ремарка без data-type')
    expect(html).toContain('Ещё одна')
    expect(html).toContain('действие')
  })

  it('нельзя перепутать «1-8» и «8» — номер сравнивается целиком', () => {
    const doc = `
<div data-type="scene-header">8. ИНТ. ДОМ — ДЕНЬ.</div>
<div data-type="scene-action">сцена 8</div>
<div data-type="scene-header">1-8. ИНТ. ДАЧА — ДЕНЬ.</div>
<div data-type="scene-action">сцена 1-8</div>`
    const html = extractSceneHtml(doc, '1-8', 0)
    expect(html).toContain('сцена 1-8')
    expect(html).not.toContain('сцена 8<')
  })

  it('сцена не найдена → пустая строка', () => {
    expect(extractSceneHtml(DOC, '99', 99)).toBe('')
  })
})

describe('spliceSceneHtml', () => {
  it('заменяет блоки сцены, не трогая соседние', () => {
    const newHtml = `<div data-type="scene-header">2. ИНТ. САД — НОЧЬ.</div><div data-type="scene-action">НОВОЕ ДЕЙСТВИЕ</div>`
    const out = spliceSceneHtml(DOC, '2', 1, newHtml)
    expect(out).toContain('НОВОЕ ДЕЙСТВИЕ')
    expect(out).toContain('сцены 1') // соседи на месте
    expect(out).toContain('сцены 3')
    expect(out).not.toContain('Реплика.') // старое содержимое заменено
  })

  it('замена сцены с блоками без data-type не теряет соседей', () => {
    const doc = `
<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ.</div>
<p>простой текст</p>
<div data-type="scene-header">2. ИНТ. САД — НОЧЬ.</div>
<div data-type="scene-action">след</div>`
    const out = spliceSceneHtml(doc, '1', 0, `<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ.</div><div data-type="scene-action">НОВОЕ</div>`)
    expect(out).toContain('НОВОЕ')
    expect(out).toContain('след')
    expect(out).not.toContain('простой текст') // старый <p> заменён
  })

  it('изменённая сцена снова извлекается полностью (round-trip)', () => {
    const newHtml = `<div data-type="scene-header">2. ИНТ. САД — НОЧЬ.</div><div data-type="scene-action">А</div><div data-type="scene-action">Б</div>`
    const out = spliceSceneHtml(DOC, '2', 1, newHtml)
    const back = extractSceneHtml(out, '2', 1)
    expect(back).toContain('А')
    expect(back).toContain('Б')
    expect(back).not.toContain('сцены 3')
  })
})
