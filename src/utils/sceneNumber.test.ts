import { describe, it, expect } from 'vitest'
import { SCENE_NUMBER } from './sceneNumber'

const HEADER_RE = new RegExp(`^(${SCENE_NUMBER})\\.\\s*(ИНТ-ЭКСТ\\.?|ИНТ\\.?|ЭКСТ\\.?|ПАВ\\.?|НАТ\\/ИНТ\\.?|НАТ\\.?)\\s+(.+)$`, 'i')

describe('SCENE_NUMBER', () => {
  it.each([
    ['1. ИНТ. ДОМ — ДЕНЬ', '1'],
    ['12. ЭКСТ. УЛИЦА — НОЧЬ', '12'],
    ['1-1. ИНТ. КВАРТИРА — ДЕНЬ', '1-1'],
    ['1-9-А. ИНТ. ДОМ — ДЕНЬ', '1-9-А'],
    ['1-9-G. ЭКСТ. УЛИЦА — НОЧЬ', '1-9-G'],
    ['1-9 (бывш). ИНТ. ОФИС — УТРО', '1-9 (бывш)'],
    ['15-2-Б. ПАВ. Студия — ВЕЧЕР', '15-2-Б'],
  ])('распознаёт шапку %s', (input, num) => {
    const m = input.match(HEADER_RE)
    expect(m).not.toBeNull()
    expect(m![1]).toBe(num)
  })

  it('не принимает строку без типа сцены', () => {
    expect('Просто текст. ДОМ — ДЕНЬ'.match(HEADER_RE)).toBeNull()
  })
})
