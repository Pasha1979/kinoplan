// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizePlainText, isScreenplayContent } from './pasteSanitizer'

describe('sanitizeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('removes script tags entirely', () => {
    const result = sanitizeHtml('<script>alert("xss")</script><p>safe</p>')
    expect(result).toBe('<p>safe</p>')
  })

  it('removes style tags entirely', () => {
    const result = sanitizeHtml('<style>.x{color:red}</style><p>text</p>')
    expect(result).toBe('<p>text</p>')
  })

  it('removes all attributes from elements', () => {
    const result = sanitizeHtml('<p class="foo" id="bar" style="color:red">text</p>')
    expect(result).toBe('<p>text</p>')
  })

  it('converts strong to b', () => {
    const result = sanitizeHtml('<strong>bold</strong>')
    expect(result).toBe('<b>bold</b>')
  })

  it('converts em to i', () => {
    const result = sanitizeHtml('<em>italic</em>')
    expect(result).toBe('<i>italic</i>')
  })

  it('converts div to p', () => {
    const result = sanitizeHtml('<div>text</div>')
    expect(result).toBe('<p>text</p>')
  })

  it('unwraps span — keeps children', () => {
    const result = sanitizeHtml('<p>before<span style="color:red">inner</span>after</p>')
    expect(result).toBe('<p>beforeinnerafter</p>')
  })

  it('unwraps font tag — keeps children', () => {
    const result = sanitizeHtml('<p>before<font face="Arial">inner</font>after</p>')
    expect(result).toBe('<p>beforeinnerafter</p>')
  })

  it('converts table to plain text', () => {
    const result = sanitizeHtml('<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>')
    expect(result).toBe('A B\nC D')
  })

  it('converts ul to plain text with line breaks', () => {
    const result = sanitizeHtml('<ul><li>one</li><li>two</li><li>three</li></ul>')
    expect(result).toBe('one\ntwo\nthree')
  })

  it('preserves nested formatting', () => {
    const result = sanitizeHtml('<p>Hello <b>bold <i>both</i></b></p>')
    expect(result).toBe('<p>Hello <b>bold <i>both</i></b></p>')
  })
})

describe('sanitizePlainText', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizePlainText('')).toBe('')
  })

  it('removes BOM character', () => {
    expect(sanitizePlainText('\uFEFFhello')).toBe('hello')
  })

  it('removes zero-width spaces', () => {
    expect(sanitizePlainText('hello\u200Bworld')).toBe('helloworld')
    expect(sanitizePlainText('hello\u200Cworld')).toBe('helloworld')
    expect(sanitizePlainText('hello\u200Dworld')).toBe('helloworld')
  })

  it('removes soft hyphen', () => {
    expect(sanitizePlainText('hello\u00ADworld')).toBe('helloworld')
  })

  it('converts tabs to single space', () => {
    expect(sanitizePlainText('hello\t\tworld')).toBe('hello world')
  })

  it('collapses multiple spaces to single', () => {
    expect(sanitizePlainText('hello     world')).toBe('hello world')
  })

  it('collapses excessive newlines to max two', () => {
    expect(sanitizePlainText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizePlainText('  hello  ')).toBe('hello')
  })

  it('handles combined special characters', () => {
    const input = '\uFEFF\u200Bhello\u00AD\t\u200C  world\u200D\n\n\n\n'
    expect(sanitizePlainText(input)).toBe('hello world')
  })
})

describe('isScreenplayContent', () => {
  it('returns false for empty string', () => {
    expect(isScreenplayContent('')).toBe(false)
  })

  it('returns false for plain text without scene headers', () => {
    expect(isScreenplayContent('Hello world\nThis is just text')).toBe(false)
  })

  it('detects INT scene header', () => {
    expect(isScreenplayContent('ИНТ. КВАРТИРА — ДЕНЬ')).toBe(true)
  })

  it('detects EXT scene header', () => {
    expect(isScreenplayContent('ЭКСТ. УЛИЦА — НОЧЬ')).toBe(true)
  })

  it('detects INT-EXT scene header', () => {
    expect(isScreenplayContent('ИНТ-ЭКСТ. МАШИНА — ДЕНЬ')).toBe(true)
  })

  it('detects scene header with number prefix', () => {
    expect(isScreenplayContent('1. ИНТ. КВАРТИРА — ДЕНЬ')).toBe(true)
  })

  it('detects scene header with series prefix (e.g. 1-1)', () => {
    expect(isScreenplayContent('1-1. ИНТ. КВАРТИРА — ДЕНЬ')).toBe(true)
  })

  it('detects scene header among other text', () => {
    const text = 'Some intro text\nИНТ. ОФИС — ДЕНЬ\nMore text here'
    expect(isScreenplayContent(text)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isScreenplayContent('инт. квартира — день')).toBe(true)
    expect(isScreenplayContent('экст. улица — ночь')).toBe(true)
  })
})
