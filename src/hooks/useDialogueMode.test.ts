// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDialogueMode } from './useDialogueMode'
import type { Scene } from '../store/scriptStore'

function makeScene(cast: string[] = []): Scene {
  return {
    id: `scene-${Math.random()}`,
    number: '1',
    type: 'ИНТ',
    location: 'КВАРТИРА',
    sublocation: '',
    time: 'ДЕНЬ',
    cast,
    pages: 1,
    charCount: 0,
  }
}

describe('useDialogueMode — characters extraction', () => {
  it('собирает уникальных персонажей из cast всех сцен', () => {
    const scenes = [
      makeScene(['ИВАН', 'МАША']),
      makeScene(['МАША', 'ПЁТР']),
      makeScene(['ИВАН']),
    ]
    const { result } = renderHook(() => useDialogueMode(scenes))
    expect(result.current.characters).toEqual(['ИВАН', 'МАША', 'ПЁТР'])
  })

  it('сортирует персонажей по алфавиту', () => {
    const scenes = [
      makeScene(['ЧАРЛИ']),
      makeScene(['АННА']),
      makeScene(['БОРИС']),
    ]
    const { result } = renderHook(() => useDialogueMode(scenes))
    expect(result.current.characters).toEqual(['АННА', 'БОРИС', 'ЧАРЛИ'])
  })

  it('приводит имена к верхнему регистру', () => {
    const scenes = [makeScene(['иван', 'Маша'])]
    const { result } = renderHook(() => useDialogueMode(scenes))
    expect(result.current.characters).toEqual(['ИВАН', 'МАША'])
  })

  it('игнорирует пустые имена в cast', () => {
    const scenes = [makeScene(['ИВАН', '  ', '', 'МАША'])]
    const { result } = renderHook(() => useDialogueMode(scenes))
    expect(result.current.characters).toEqual(['ИВАН', 'МАША'])
  })

  it('возвращает пустой массив если нет сцен', () => {
    const { result } = renderHook(() => useDialogueMode([]))
    expect(result.current.characters).toEqual([])
  })

  it('возвращает пустой массив если cast пуст у всех сцен', () => {
    const scenes = [makeScene([]), makeScene([])]
    const { result } = renderHook(() => useDialogueMode(scenes))
    expect(result.current.characters).toEqual([])
  })

  it('обрабатывает undefined cast', () => {
    const scenes = [makeScene(undefined as unknown as string[])]
    const { result } = renderHook(() => useDialogueMode(scenes))
    expect(result.current.characters).toEqual([])
  })
})

describe('useDialogueMode — selectCharacter', () => {
  it('выбирает персонажа', () => {
    const { result } = renderHook(() => useDialogueMode([makeScene(['ИВАН'])]))
    act(() => result.current.selectCharacter('ИВАН'))
    expect(result.current.activeCharacter).toBe('ИВАН')
    expect(result.current.isActive).toBe(true)
  })

  it('повторный клик по тому же персонажу — снимает выбор', () => {
    const { result } = renderHook(() => useDialogueMode([makeScene(['ИВАН'])]))
    act(() => result.current.selectCharacter('ИВАН'))
    expect(result.current.activeCharacter).toBe('ИВАН')
    act(() => result.current.selectCharacter('ИВАН'))
    expect(result.current.activeCharacter).toBeNull()
    expect(result.current.isActive).toBe(false)
  })

  it('закрывает пикер после выбора', () => {
    const { result } = renderHook(() => useDialogueMode([makeScene(['ИВАН'])]))
    act(() => result.current.setPickerOpen(true))
    expect(result.current.pickerOpen).toBe(true)
    act(() => result.current.selectCharacter('ИВАН'))
    expect(result.current.pickerOpen).toBe(false)
  })

  it('переключение на другого персонажа', () => {
    const { result } = renderHook(() => useDialogueMode([makeScene(['ИВАН', 'МАША'])]))
    act(() => result.current.selectCharacter('ИВАН'))
    expect(result.current.activeCharacter).toBe('ИВАН')
    act(() => result.current.selectCharacter('МАША'))
    expect(result.current.activeCharacter).toBe('МАША')
  })
})

describe('useDialogueMode — POV mode', () => {
  it('togglePovMode: переключает POV', () => {
    const { result } = renderHook(() => useDialogueMode([makeScene(['ИВАН'])]))
    expect(result.current.povMode).toBe(false)
    act(() => result.current.togglePovMode())
    expect(result.current.povMode).toBe(true)
    act(() => result.current.togglePovMode())
    expect(result.current.povMode).toBe(false)
  })

  it('выбор персонажа в POV режиме — выключает POV', () => {
    const { result } = renderHook(() => useDialogueMode([makeScene(['ИВАН', 'МАША'])]))
    act(() => result.current.togglePovMode())
    expect(result.current.povMode).toBe(true)
    act(() => result.current.selectCharacter('ИВАН'))
    expect(result.current.povMode).toBe(false)
    expect(result.current.activeCharacter).toBe('ИВАН')
  })
})

describe('useDialogueMode — togglePicker & exit', () => {
  it('togglePicker: открывает и закрывает пикер', () => {
    const { result } = renderHook(() => useDialogueMode([makeScene(['ИВАН'])]))
    expect(result.current.pickerOpen).toBe(false)
    act(() => result.current.togglePicker())
    expect(result.current.pickerOpen).toBe(true)
    act(() => result.current.togglePicker())
    expect(result.current.pickerOpen).toBe(false)
  })

  it('exit: сбрасывает всё состояние', () => {
    const { result } = renderHook(() => useDialogueMode([makeScene(['ИВАН'])]))
    act(() => result.current.selectCharacter('ИВАН'))
    act(() => result.current.togglePovMode())
    act(() => result.current.setPickerOpen(true))
    expect(result.current.activeCharacter).toBe('ИВАН')
    expect(result.current.povMode).toBe(true)
    expect(result.current.pickerOpen).toBe(true)

    act(() => result.current.exit())
    expect(result.current.activeCharacter).toBeNull()
    expect(result.current.povMode).toBe(false)
    expect(result.current.pickerOpen).toBe(false)
    expect(result.current.isActive).toBe(false)
  })
})
