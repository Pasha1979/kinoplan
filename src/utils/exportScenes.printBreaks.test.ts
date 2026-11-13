// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// jsdom не меряет layout — подменяем PageCounter эталонными разрывами.
// Результат настраивается per-test через globalThis.__pcResult.
vi.mock('../services/pageCounter', () => ({
  PageCounter: class {
    calculatePagesWithBreaks() {
      return (globalThis as Record<string, unknown>).__pcResult
    }
  },
}))

import { injectPrintPageBreaks } from './exportScenes'

const blk = (heightPx: number, dataType: string) => ({
  heightPx, marginTopPx: 0, marginBottomPx: 0, dataType,
})

const HTML = (inner: string) => `<div style="font-size:12pt">${inner}</div>`

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).__pcResult = { totalPages: 1, breaks: [{ page: 1, startIndex: 0 }], blocks: [] }
})

describe('injectPrintPageBreaks (T-16)', () => {
  it('одна страница — html без изменений', () => {
    const html = HTML('<div data-type="scene-action">Текст</div>')
    expect(injectPrintPageBreaks(html, 'russian')).toBe(html)
  })

  it('разрыв между блоками → page-break-before на блоке', () => {
    ;(globalThis as Record<string, unknown>).__pcResult = {
      totalPages: 2,
      breaks: [{ page: 1, startIndex: 0 }, { page: 2, startIndex: 1 }],
      blocks: [blk(500, 'scene-action'), blk(300, 'scene-action')],
    }
    const out = injectPrintPageBreaks(
      HTML('<div data-type="scene-action">А</div><div data-type="scene-action">Б</div>'),
      'russian'
    )
    expect(out).toMatch(/page-break-before:\s*always/)
    expect(out).not.toContain('ПРОДОЛЖЕНИЕ')
  })

  it('разрыв внутри реплики → маркер (ПРОДОЛЖЕНИЕ) с принудительным разрывом', () => {
    ;(globalThis as Record<string, unknown>).__pcResult = {
      totalPages: 2,
      breaks: [{ page: 1, startIndex: 0 }, { page: 2, startIndex: 1, splitOffsetPx: 120 }],
      blocks: [blk(24, 'scene-character'), blk(240, 'scene-dialog')],
    }
    const out = injectPrintPageBreaks(
      HTML('<div data-type="scene-character">ИВАН</div><div data-type="scene-dialog">Раз два три четыре пять шесть семь восемь</div>'),
      'russian'
    )
    expect(out).toContain('data-print-contd')
    expect(out).toContain('(ПРОДОЛЖЕНИЕ)')
    // маркер идёт с page-break-before — он на вершине новой страницы
    expect(out).toMatch(/data-print-contd[^>]*page-break-before:\s*always|page-break-before:\s*always[^>]*data-print-contd/)
  })

  it('hollywood-формат → маркер CONT\'D', () => {
    ;(globalThis as Record<string, unknown>).__pcResult = {
      totalPages: 2,
      breaks: [{ page: 1, startIndex: 0 }, { page: 2, startIndex: 0, splitOffsetPx: 100 }],
      blocks: [blk(240, 'scene-dialog')],
    }
    const out = injectPrintPageBreaks(
      HTML('<div data-type="scene-dialog">one two three four five six</div>'),
      'hollywood'
    )
    expect(out).toContain("(CONT'D)")
  })

  it('разрыв внутри ремарки — без маркера, блок делится с принудительным разрывом', () => {
    ;(globalThis as Record<string, unknown>).__pcResult = {
      totalPages: 2,
      breaks: [{ page: 1, startIndex: 0 }, { page: 2, startIndex: 0, splitOffsetPx: 200 }],
      blocks: [blk(500, 'scene-action')],
    }
    const out = injectPrintPageBreaks(
      HTML('<div data-type="scene-action">раз два три четыре пять шесть семь восемь девять десять</div>'),
      'russian'
    )
    expect(out).not.toContain('ПРОДОЛЖЕНИЕ')
    expect(out).toMatch(/page-break-before:\s*always/)
  })
})
