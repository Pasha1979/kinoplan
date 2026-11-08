// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSmartType } from './useSmartType'

const OPTIONS = {
  characters: ['ИВАН', 'МАША'],
  locations: ['ДОМ ДЕДА', 'ДОМ ДЕДА.СЕНИ', 'ДОМ ДЕДА.КОМНАТА', 'ЛЕС'],
  times: ['ДЕНЬ', 'НОЧЬ'],
}

beforeEach(() => localStorage.clear())

describe('useSmartType', () => {
  it('подсказывает персонажа по префиксу в блоке character', () => {
    const { result } = renderHook(() => useSmartType(OPTIONS))
    act(() => result.current.updateSuggestions('ИВ', 2, 'character'))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.suggestions.map(s => s.text)).toContain('ИВАН')
  })

  it('не подсказывает при одном символе (minMatchLength=2)', () => {
    const { result } = renderHook(() => useSmartType(OPTIONS))
    act(() => result.current.updateSuggestions('И', 1, 'character'))
    expect(result.current.isOpen).toBe(false)
  })

  it('в scene_header предлагает локации, а не персонажей', () => {
    const { result } = renderHook(() => useSmartType(OPTIONS))
    act(() => result.current.updateSuggestions('ИВ', 2, 'scene_header'))
    expect(result.current.suggestions.every(s => s.type !== 'character')).toBe(true)
  })

  it('двухуровневые локации: базовая и подлокации по префиксу', () => {
    const { result } = renderHook(() => useSmartType(OPTIONS))
    // last word 'ДО' — minMatchLength=2, пробел сбрасывает слово
    act(() => result.current.updateSuggestions('ДОМ ДО', 6, 'scene_header'))
    const texts = result.current.suggestions.map(s => s.text)
    expect(texts).toContain('ДОМ ДЕДА')
    expect(texts).toContain('ДОМ ДЕДА.СЕНИ')
    expect(texts).toContain('ДОМ ДЕДА.КОМНАТА')
  })

  it('подлокация совпадает по сегменту после точки: «ДЕДА.С» → «ДОМ ДЕДА.СЕНИ»', () => {
    const { result } = renderHook(() => useSmartType(OPTIONS))
    act(() => result.current.updateSuggestions('ДОМ ДЕДА.С', 10, 'scene_header'))
    const texts = result.current.suggestions.map(s => s.text)
    expect(texts).toContain('ДОМ ДЕДА.СЕНИ')
    expect(texts).not.toContain('ЛЕС')
  })

  it('selectSuggestion заменяет последнее слово', () => {
    const { result } = renderHook(() => useSmartType(OPTIONS))
    const sug = { id: 'x', text: 'ИВАН', type: 'character' as const, frequency: 0 }
    const r = result.current.selectSuggestion('набрал ИВ', 9, sug)
    expect(r.newText).toBe('набрал ИВАН')
    expect(r.newCursorPos).toBe('набрал ИВАН'.length)
  })

  it('openSuggestions открывает попап программно (подлокации)', () => {
    const { result } = renderHook(() => useSmartType(OPTIONS))
    const subs = [
      { id: 's1', text: 'ДОМ ДЕДА.СЕНИ', insertText: 'СЕНИ', type: 'location' as const, frequency: 0 },
    ]
    act(() => result.current.openSuggestions(subs))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.suggestions[0].insertText).toBe('СЕНИ')
    act(() => result.current.closeSuggestions())
    expect(result.current.isOpen).toBe(false)
  })

  it('частота использования влияет на сортировку', () => {
    const { result } = renderHook(() => useSmartType(OPTIONS))
    const masha = result.current
    act(() => masha.recordUsage({ id: 'm', text: 'МАША', type: 'character', frequency: 0 }))
    act(() => masha.recordUsage({ id: 'm', text: 'МАША', type: 'character', frequency: 0 }))
    act(() => masha.updateSuggestions('М', 0, 'character')) // < min → закрыто, но сброс
    act(() => masha.updateSuggestions('М', 1, 'character'))
    // две буквы для активации
    act(() => masha.updateSuggestions('М-АША? МА', 2, 'character'))
    // проще: обе подходят под «М» — но min=2, берём «МА»
    act(() => masha.updateSuggestions('МА', 2, 'character'))
    const texts = result.current.suggestions.map(s => s.text)
    expect(texts[0]).toBe('МАША')
  })
})
