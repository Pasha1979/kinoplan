// @vitest-environment jsdom
// T-171: автозакрытие скобок/кавычек + умный Backspace
import { describe, it, expect } from 'vitest'
import { createTestEditor } from '../test-utils/createTestEditor'
import { handleBracketInput, handleBracketBackspace } from './autoBrackets'

const OPTS = { autoTypography: true }

function ed(html = '<div data-type="scene-action">текст</div>') {
  const e = createTestEditor()
  e.commands.setContent(html)
  return e
}

// позиция внутри первого текстового блока (после N символов)
function pos(e: ReturnType<typeof createTestEditor>, textOffset = 0) {
  let found = 0
  e.state.doc.forEach((n, p) => {
    if (!found && n.isTextblock && n.textContent) found = p + 1 + textOffset
  })
  return found
}

function input(e: ReturnType<typeof createTestEditor>, ch: string, at: number) {
  return handleBracketInput(e.view, at, at, ch, OPTS)
}

describe('autoBrackets — открывающие пары', () => {
  it('( → () с курсором внутри', () => {
    const e = ed('<div data-type="scene-action"></div>')
    const p = pos(e) || 1
    expect(input(e, '(', p)).toBe(true)
    expect(e.state.doc.textContent).toBe('()')
    expect(e.state.selection.from).toBe(p + 1)
    e.destroy()
  })

  it('[ → [], { → {}, « → «»', () => {
    for (const [open, pair] of [['[', '[]'], ['{', '{}'], ['«', '«»']] as const) {
      const e = ed('<div data-type="scene-action"></div>')
      const p = pos(e) || 1
      input(e, open, p)
      expect(e.state.doc.textContent).toBe(pair)
      e.destroy()
    }
  })

  it('" при autoTypography → «» в открывающем контексте, » — в закрывающем', () => {
    const e = ed('<div data-type="scene-action"></div>')
    const p = pos(e) || 1
    input(e, '"', p)
    expect(e.state.doc.textContent).toBe('«»')
    e.destroy()

    const e2 = ed('<div data-type="scene-action">слово</div>')
    const p2 = pos(e2, 5)!
    e2.commands.setTextSelection(p2)
    input(e2, '"', p2)
    expect(e2.state.doc.textContent).toBe('слово»')
    e2.destroy()
  })

  it('" при выключенной типографике → ""', () => {
    const e = ed('<div data-type="scene-action"></div>')
    const p = pos(e) || 1
    handleBracketInput(e.view, p, p, '"', { autoTypography: false })
    expect(e.state.doc.textContent).toBe('""')
    e.destroy()
  })
})

describe('autoBrackets — typeover и границы', () => {
  it('печать ) перед ) → шаг вперёд, без дубля', () => {
    const e = ed('<div data-type="scene-action">()</div>')
    const p = pos(e, 1)!
    e.commands.setTextSelection(p)
    expect(input(e, ')', p)).toBe(true)
    expect(e.state.doc.textContent).toBe('()')
    expect(e.state.selection.from).toBe(p + 1)
    e.destroy()
  })

  it('" перед » → typeover', () => {
    const e = ed('<div data-type="scene-action">«»</div>')
    const p = pos(e, 1)!
    expect(input(e, '"', p)).toBe(true)
    expect(e.state.doc.textContent).toBe('«»')
    e.destroy()
  })

  it('(з/к + ) при автозакрытой паре → (З/К) без хвоста', () => {
    const e = ed('<div data-type="scene-action">(з/к)</div>')
    const p = pos(e, 4)! // курсор после «к», перед «)»
    expect(input(e, ')', p)).toBe(true)
    expect(e.state.doc.textContent).toBe('(З/К)')
    e.destroy()
  })

  it('в шапке сцены автозакрытие не работает', () => {
    const e = ed('<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ</div>')
    const p = pos(e, 3)!
    expect(input(e, '(', p)).toBe(false)
    e.destroy()
  })
})

describe('autoBrackets — умный Backspace', () => {
  it('Backspace на (|) удаляет обе скобки', () => {
    const e = ed('<div data-type="scene-action">a()b</div>')
    const p = pos(e, 2)!
    e.commands.setTextSelection(p)
    expect(handleBracketBackspace(e.view)).toBe(true)
    expect(e.state.doc.textContent).toBe('ab')
    e.destroy()
  })

  it('Backspace на непустом содержимом не срабатывает', () => {
    const e = ed('<div data-type="scene-action">(текст)</div>')
    const p = pos(e, 2)!
    e.commands.setTextSelection(p)
    expect(handleBracketBackspace(e.view)).toBe(false)
    e.destroy()
  })
})
