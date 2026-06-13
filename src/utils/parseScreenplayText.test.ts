import { describe, it, expect } from 'vitest'
import { parseScreenplayText, blocksToHtml } from './parseScreenplayText'

describe('parseScreenplayText', () => {
  it('returns empty array for empty string', () => {
    expect(parseScreenplayText('')).toEqual([])
    expect(parseScreenplayText('   ')).toEqual([])
  })

  it('recognizes scene headers', () => {
    const text = '15-1. ИНТ. КВАРТИРА. ДЕНЬ.'
    const blocks = parseScreenplayText(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'sceneHeader', content: '15-1. ИНТ. КВАРТИРА. ДЕНЬ.' })
  })

  it('recognizes character names', () => {
    const text = 'ОСИНА'
    const blocks = parseScreenplayText(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'sceneCharacter', content: 'ОСИНА' })
  })

  it('recognizes parentheticals after character', () => {
    const text = 'ОСИНА\n(не отвлекаясь от смартфона)'
    const blocks = parseScreenplayText(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'sceneCharacter', content: 'ОСИНА' })
    expect(blocks[1]).toEqual({ type: 'sceneParenthetical', content: '(не отвлекаясь от смартфона)' })
  })

  it('recognizes dialog after character', () => {
    const text = 'ОСИНА\nДоброе утро!'
    const blocks = parseScreenplayText(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'sceneCharacter', content: 'ОСИНА' })
    expect(blocks[1]).toEqual({ type: 'sceneDialog', content: 'Доброе утро!' })
  })

  it('recognizes full scene flow', () => {
    // После шапки: участники → действие → потом отдельно персонаж → ремарка → диалог
    const text = `15-1. ИНТ. МОНТАЖКА «ТВЕРЬ-ТВ».КПП. НОЧЬ.
ОСИНА, МАКАР КИРЕЕВ

[бодрая музыка]
КПП. На часах 6:30.

ОСИНА
(не отвлекаясь)
Доброе утро!`

    const blocks = parseScreenplayText(text)
    expect(blocks).toEqual([
      { type: 'sceneHeader', content: '15-1. ИНТ. МОНТАЖКА «ТВЕРЬ-ТВ».КПП. НОЧЬ.' },
      { type: 'sceneCast', content: 'ОСИНА, МАКАР КИРЕЕВ' },
      { type: 'sceneAction', content: '[бодрая музыка]\nКПП. На часах 6:30.' },
      { type: 'sceneCharacter', content: 'ОСИНА' },
      { type: 'sceneParenthetical', content: '(не отвлекаясь)' },
      { type: 'sceneDialog', content: 'Доброе утро!' },
    ])
  })

  it('recognizes character with extension (З.К.)', () => {
    const text = 'РОМА (З.К.)\nАлло?'
    const blocks = parseScreenplayText(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'sceneCharacter', content: 'РОМА (З.К.)' })
    expect(blocks[1]).toEqual({ type: 'sceneDialog', content: 'Алло?' })
  })

  it('recognizes single cast after header', () => {
    const text = '1-1. ИНТ. КВАРТИРА. ДЕНЬ.\nОСИНА'
    const blocks = parseScreenplayText(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'sceneHeader', content: '1-1. ИНТ. КВАРТИРА. ДЕНЬ.' })
    expect(blocks[1]).toEqual({ type: 'sceneCast', content: 'ОСИНА' })
  })

  it('recognizes multiple cast after header', () => {
    const text = '1-1. ИНТ. КВАРТИРА. ДЕНЬ.\nОСИНА, МАКАР КИРЕЕВ'
    const blocks = parseScreenplayText(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'sceneHeader', content: '1-1. ИНТ. КВАРТИРА. ДЕНЬ.' })
    expect(blocks[1]).toEqual({ type: 'sceneCast', content: 'ОСИНА, МАКАР КИРЕЕВ' })
  })

  it('recognizes transitions', () => {
    const text = 'РАССВЕТ'
    const blocks = parseScreenplayText(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'sceneTransition', content: 'РАССВЕТ' })
  })

  it('treats orphan parenthetical as action', () => {
    const text = '(шепчет)\nБоже...'
    const blocks = parseScreenplayText(text)
    // Без предшествующего персонажа ремарка считается действием
    expect(blocks[0].type).toBe('sceneAction')
  })
})

describe('blocksToHtml', () => {
  it('converts blocks to Tiptap-compatible HTML', () => {
    const blocks = [
      { type: 'sceneHeader' as const, content: 'ИНТ. КВАРТИРА. ДЕНЬ.' },
      { type: 'sceneCharacter' as const, content: 'ОСИНА' },
    ]
    const html = blocksToHtml(blocks)
    expect(html).toContain('<div data-type="scene-header">ИНТ. КВАРТИРА. ДЕНЬ.</div>')
    expect(html).toContain('<div data-type="scene-character">ОСИНА</div>')
  })

  it('escapes HTML in content', () => {
    const blocks = [{ type: 'sceneDialog' as const, content: '<b>Hello</b>' }]
    const html = blocksToHtml(blocks)
    expect(html).toContain('&lt;b&gt;Hello&lt;/b&gt;')
  })
})
