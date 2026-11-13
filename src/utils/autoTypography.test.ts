import { describe, it, expect } from 'vitest'
import { typographyTransform } from './autoTypography'

describe('typographyTransform (T-72)', () => {
  it('двойной дефис → тире', () => {
    expect(typographyTransform('слово -', '-')).toEqual({ back: 1, insert: '—' })
    expect(typographyTransform('начало-', '-')).toEqual({ back: 1, insert: '—' })
  })

  it('одиночный дефис и тире не трогает', () => {
    expect(typographyTransform('кто', '-')).toBeNull()
    expect(typographyTransform('кто-то писал —', '-')).toBeNull()
    expect(typographyTransform('', '-')).toBeNull()
  })

  it('кавычки → ёлочки по контексту', () => {
    // открывающая: начало блока, после пробела, после скобки, после тире
    expect(typographyTransform('', '"')).toEqual({ back: 0, insert: '«' })
    expect(typographyTransform('сказал ', '"')).toEqual({ back: 0, insert: '«' })
    expect(typographyTransform('— ', '"')).toEqual({ back: 0, insert: '«' })
    expect(typographyTransform('(', '"')).toEqual({ back: 0, insert: '«' })
    // закрывающая: после буквы, цифры, знака препинания
    expect(typographyTransform('привет', '"')).toEqual({ back: 0, insert: '»' })
    expect(typographyTransform('слово,', '"')).toEqual({ back: 0, insert: '»' })
    expect(typographyTransform('«внутри', '"')).toEqual({ back: 0, insert: '»' })
  })

  it('(з/к) → (З/К) регистронезависимо', () => {
    expect(typographyTransform('текст (з/к', ')')).toEqual({ back: 4, insert: '(З/К)' })
    expect(typographyTransform('(З/к', ')')).toEqual({ back: 4, insert: '(З/К)' })
    expect(typographyTransform('(з / к', ')')).toEqual({ back: 6, insert: '(З/К)' })
  })

  it('прочие скобки не трогает', () => {
    expect(typographyTransform('(в кадре', ')')).toBeNull()
    expect(typographyTransform('(зк', ')')).toBeNull()
  })

  it('мультисимвольная вставка не трогается', () => {
    expect(typographyTransform('x', '--')).toBeNull()
    expect(typographyTransform('x', 'abc')).toBeNull()
  })
})
