// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSplitScreen } from './useSplitScreen'

describe('useSplitScreen — initial state', () => {
  it('по умолчанию split не активен', () => {
    const { result } = renderHook(() => useSplitScreen())
    expect(result.current.isActive).toBe(false)
  })

  it('активная панель — left по умолчанию', () => {
    const { result } = renderHook(() => useSplitScreen())
    expect(result.current.activePanel).toBe('left')
  })

  it('ширина левой панели — 50% по умолчанию', () => {
    const { result } = renderHook(() => useSplitScreen())
    expect(result.current.leftWidthPct).toBe(50)
  })

  it('rightSeries — defaultSeries по умолчанию', () => {
    const { result } = renderHook(() => useSplitScreen(3))
    expect(result.current.rightSeries).toBe(3)
  })
})

describe('useSplitScreen — enable / disable / toggle', () => {
  it('enable: активирует split', () => {
    const { result } = renderHook(() => useSplitScreen())
    act(() => result.current.enable())
    expect(result.current.isActive).toBe(true)
    expect(result.current.activePanel).toBe('left')
  })

  it('disable: деактивирует split и сбрасывает состояние', () => {
    const { result } = renderHook(() => useSplitScreen(2))
    act(() => {
      result.current.enable()
      result.current.setRightSeries(5)
    })
    expect(result.current.isActive).toBe(true)
    expect(result.current.rightSeries).toBe(5)

    act(() => result.current.disable())
    expect(result.current.isActive).toBe(false)
    expect(result.current.activePanel).toBe('left')
    expect(result.current.rightSeries).toBe(2)
    expect(result.current.leftFocusSceneId).toBeUndefined()
    expect(result.current.rightFocusSceneId).toBeUndefined()
    expect(result.current.leftWidthPct).toBe(50)
  })

  it('toggle: включает и выключает split', () => {
    const { result } = renderHook(() => useSplitScreen())
    act(() => result.current.toggle())
    expect(result.current.isActive).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isActive).toBe(false)
  })

  it('toggle: сбрасывает состояние при выключении', () => {
    const { result } = renderHook(() => useSplitScreen(3))
    act(() => {
      result.current.enable()
      result.current.setRightSeries(7)
    })
    act(() => result.current.toggle())
    expect(result.current.isActive).toBe(false)
    expect(result.current.rightSeries).toBe(3)
    expect(result.current.leftWidthPct).toBe(50)
  })
})

describe('useSplitScreen — navigateToScene', () => {
  it('навигация идёт в левую панель когда activePanel = left', () => {
    const { result } = renderHook(() => useSplitScreen())
    act(() => result.current.enable())
    act(() => result.current.navigateToScene('scene-42'))
    expect(result.current.leftFocusSceneId).toBe('scene-42')
    expect(result.current.rightFocusSceneId).toBeUndefined()
  })

  it('навигация идёт в правую панель когда activePanel = right', () => {
    const { result } = renderHook(() => useSplitScreen())
    act(() => result.current.enable())
    act(() => result.current.setActivePanel('right'))
    act(() => result.current.navigateToScene('scene-99'))
    expect(result.current.rightFocusSceneId).toBe('scene-99')
    expect(result.current.leftFocusSceneId).toBeUndefined()
  })
})

describe('useSplitScreen — clearFocus', () => {
  it('clearLeftFocus: сбрасывает leftFocusSceneId', () => {
    const { result } = renderHook(() => useSplitScreen())
    act(() => {
      result.current.enable()
      result.current.navigateToScene('sc-1')
    })
    expect(result.current.leftFocusSceneId).toBe('sc-1')
    act(() => result.current.clearLeftFocus())
    expect(result.current.leftFocusSceneId).toBeUndefined()
  })

  it('clearRightFocus: сбрасывает rightFocusSceneId', () => {
    const { result } = renderHook(() => useSplitScreen())
    act(() => result.current.enable())
    act(() => result.current.setActivePanel('right'))
    act(() => result.current.navigateToScene('sc-2'))
    expect(result.current.rightFocusSceneId).toBe('sc-2')
    act(() => result.current.clearRightFocus())
    expect(result.current.rightFocusSceneId).toBeUndefined()
  })
})
