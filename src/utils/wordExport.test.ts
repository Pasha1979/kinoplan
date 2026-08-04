// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { convertToWordCompatibleHtml } from './wordExport'
import { SCRIPT_STYLES } from '../constants/scriptStyles'

describe('convertToWordCompatibleHtml', () => {
  it('wraps content in a div with Courier New font', () => {
    const result = convertToWordCompatibleHtml('<p>text</p>')
    expect(result).toContain('Courier New')
    expect(result).toContain('font-size: 12pt')
  })

  it('applies russian styles to scene-header block', () => {
    const html = '<div data-type="scene-header">1. ИНТ. КВАРТИРА — ДЕНЬ</div>'
    const result = convertToWordCompatibleHtml(html, 'russian')
    expect(result).toContain(SCRIPT_STYLES['scene-header'].russian)
  })

  it('applies hollywood styles to scene-character block', () => {
    const html = '<div data-type="scene-character">МАША</div>'
    const result = convertToWordCompatibleHtml(html, 'hollywood')
    expect(result).toContain(SCRIPT_STYLES['scene-character'].hollywood)
  })

  it('defaults to russian format', () => {
    const html = '<div data-type="scene-dialog">Привет!</div>'
    const result = convertToWordCompatibleHtml(html)
    expect(result).toContain(SCRIPT_STYLES['scene-dialog'].russian)
  })

  it('preserves existing inline styles and appends new ones', () => {
    const html = '<div data-type="scene-action" style="color: blue">text</div>'
    const result = convertToWordCompatibleHtml(html, 'russian')
    expect(result).toContain('color: blue')
    expect(result).toContain(SCRIPT_STYLES['scene-action'].russian)
  })

  it('handles multiple blocks', () => {
    const html = `
      <div data-type="scene-header">1. ИНТ. КВАРТИРА — ДЕНЬ</div>
      <div data-type="scene-character">МАША</div>
      <div data-type="scene-dialog">Привет!</div>
    `
    const result = convertToWordCompatibleHtml(html, 'russian')
    expect(result).toContain(SCRIPT_STYLES['scene-header'].russian)
    expect(result).toContain(SCRIPT_STYLES['scene-character'].russian)
    expect(result).toContain(SCRIPT_STYLES['scene-dialog'].russian)
  })

  it('does not modify elements without data-type', () => {
    const html = '<p>plain text</p>'
    const result = convertToWordCompatibleHtml(html, 'russian')
    expect(result).toContain('<p>plain text</p>')
  })

  it('handles empty input', () => {
    const result = convertToWordCompatibleHtml('')
    expect(result).toContain('Courier New')
  })
})
