// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScriptStats } from './useScriptStats'
import type { Scene } from '../types/scene'

function sc(partial: Partial<Scene> & { id: string; number: string }): Scene {
  return {
    type: 'ИНТ',
    location: 'ДОМ',
    time: 'ДЕНЬ',
    charCount: 100,
    cast: [],
    pages: 1,
    ...partial,
  } as Scene
}

const s1a = sc({ id: 'a', number: '1-1', duration: 60, cast: ['ИВАН'] })
const s1b = sc({ id: 'b', number: '1-2', type: 'ЭКСТ', duration: 30, cast: ['МАША'], pages: 2 })
const s2a = sc({ id: 'c', number: '2-1', duration: 90, cast: ['ИВАН'], pages: 3 })
const ALL = [s1a, s1b, s2a]

const BLOCKS = [
  { type: 'scene_header', content: 'ИНТ. ДОМ - ДЕНЬ' },
  { type: 'dialog', content: 'привет' },          // 6
  { type: 'action', content: 'входит в комнату' }, // 15
  { type: 'scene_header', content: 'ЭКСТ. УЛИЦА - НОЧЬ' },
  { type: 'dialog', content: 'ок' },             // 2
  { type: 'scene_header', content: 'ИНТ. ДОМ - УТРО' },
  { type: 'action', content: 'спит' },            // 4
]

describe('useScriptStats', () => {
  it('считает итоги по всем сценам без фильтра', () => {
    const { result } = renderHook(() => useScriptStats(ALL, BLOCKS, 6, false))
    expect(result.current.totalScenes).toBe(3)
    expect(result.current.totalDurationSec).toBe(180)
    expect(result.current.totalPages).toBe(6) // 1+2+3
    expect(result.current.intCount).toBe(2)
    expect(result.current.extCount).toBe(1)
    expect(result.current.characters.map(c => c.name)).toContain('ИВАН')
  })

  it('под фильтром серии считает только её сцены', () => {
    const s2 = [s2a]
    const { result } = renderHook(() => useScriptStats(s2, BLOCKS, 6, true, ALL))
    expect(result.current.totalScenes).toBe(1)
    expect(result.current.totalDurationSec).toBe(90)
    expect(result.current.totalPages).toBe(3) // только страница сцены 2-1
  })

  it('темп считается по всем сценам и маппится по id', () => {
    const { result } = renderHook(() => useScriptStats([s2a], BLOCKS, 6, true, ALL))
    const tempo = result.current.tempo
    expect(tempo).toHaveLength(3)
    const t2 = tempo.find(t => t.id === 'c')!
    expect(t2.dialogChars).toBe(0)
    expect(t2.actionChars).toBe(4)
    const t1 = tempo.find(t => t.id === 'a')!
    expect(t1.ratio).toBeCloseTo(6 / 22, 3) // 6 диалог / (6+16 действие)
  })

  it('диалог/действие под фильтром — только выбранная серия', () => {
    const { result } = renderHook(() => useScriptStats([s2a], BLOCKS, 6, true, ALL))
    // серия 2: 0 диалог / 4 действие → ratio = 0
    expect(result.current.dialogRatio).toBe(0)
  })

  it('диалог/действие без фильтра — весь документ', () => {
    const { result } = renderHook(() => useScriptStats(ALL, BLOCKS, 6, false, ALL))
    // диалог 8, действие 20 → 8/28
    expect(result.current.dialogRatio).toBeCloseTo(8 / 28, 3)
  })

  it('пустой набор — нулевые метрики без падений', () => {
    const { result } = renderHook(() => useScriptStats([], BLOCKS, 0, false, ALL))
    expect(result.current.totalScenes).toBe(0)
    expect(result.current.alerts).toEqual([])
  })

  it('алерт: длинная сцена >3 минут', () => {
    const long = sc({ id: 'x', number: '1-9', duration: 200 })
    const { result } = renderHook(() => useScriptStats([long], [], 1, false))
    expect(result.current.alerts.some(a => a.message.includes(long.number))).toBe(true)
  })

  it('алерт «только диалог» работает и под фильтром через темп', () => {
    // две сцены серии 2 только с диалогом
    const d1 = sc({ id: 'd1', number: '2-1' })
    const d2 = sc({ id: 'd2', number: '2-2' })
    const d3 = sc({ id: 'd3', number: '2-3' })
    const blocks = [
      { type: 'scene_header', content: 'h' }, { type: 'dialog', content: 'aa' },
      { type: 'scene_header', content: 'h' }, { type: 'dialog', content: 'aa' },
      { type: 'scene_header', content: 'h' }, { type: 'dialog', content: 'aa' },
    ]
    const { result } = renderHook(() => useScriptStats([d1, d2, d3], blocks, 3, true, [d1, d2, d3]))
    expect(result.current.alerts.some(a => a.id.startsWith('dialog-streak-f'))).toBe(true)
  })
})
