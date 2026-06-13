import { describe, it, expect } from 'vitest'
import { extractBlocksFromHtml } from './formatBlockExtractor'

describe('extractBlocksFromHtml', () => {
  it('returns empty array for empty content', () => {
    expect(extractBlocksFromHtml('')).toEqual([])
    expect(extractBlocksFromHtml('<p></p>')).toEqual([])
  })

  it('extracts scene header block', () => {
    const html = '<div data-type="scene-header">1. ИНТ. КВАРТИРА — ДЕНЬ</div>'
    const result = extractBlocksFromHtml(html)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'scene_header',
      content: '1. ИНТ. КВАРТИРА — ДЕНЬ',
    })
  })

  it('extracts character block', () => {
    const html = '<div data-type="scene-character">МАША</div>'
    const result = extractBlocksFromHtml(html)
    expect(result[0]).toMatchObject({
      type: 'character',
      content: 'МАША',
    })
  })

  it('extracts parenthetical block', () => {
    const html = '<div data-type="scene-parenthetical">(шепотом)</div>'
    const result = extractBlocksFromHtml(html)
    expect(result[0]).toMatchObject({
      type: 'parenthetical',
      content: '(шепотом)',
    })
  })

  it('extracts transition block', () => {
    const html = '<div data-type="scene-transition">РАССВЕТ</div>'
    const result = extractBlocksFromHtml(html)
    expect(result[0]).toMatchObject({
      type: 'transition',
      content: 'РАССВЕТ',
    })
  })

  it('maps unknown data-type as-is', () => {
    const html = '<div data-type="custom-block">text</div>'
    const result = extractBlocksFromHtml(html)
    expect(result[0]).toMatchObject({
      type: 'custom-block',
      content: 'text',
    })
  })

  it('extracts multiple blocks in order', () => {
    const html = `
      <div data-type="scene-header">1. ИНТ. КВАРТИРА — ДЕНЬ</div>
      <div data-type="scene-action">Описание сцены.</div>
      <div data-type="scene-character">ИВАН</div>
      <div data-type="scene-dialog">Привет!</div>
    `
    const result = extractBlocksFromHtml(html)
    expect(result).toHaveLength(4)
    expect(result.map((b) => b.type)).toEqual([
      'scene_header',
      'action',
      'character',
      'dialog',
    ])
  })
})
