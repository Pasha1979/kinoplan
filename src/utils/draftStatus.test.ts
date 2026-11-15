import { describe, it, expect } from 'vitest'
import { allDraftStatuses, draftStatusById, scriptReadiness, DEFAULT_DRAFT_STATUSES } from './draftStatus'

describe('draftStatus (T-121): редакционный статус сцены', () => {
  it('встроенный набор: 6 статусов с весами 10..100', () => {
    expect(DEFAULT_DRAFT_STATUSES).toHaveLength(6)
    expect(DEFAULT_DRAFT_STATUSES.map((s) => s.id)).toEqual(['draft', 'wip', 'rework', 'review', 'done', 'final'])
  })

  it('draftStatusById: находит встроенный, неизвестный → undefined', () => {
    expect(draftStatusById('final')?.label).toBe('Финал')
    expect(draftStatusById('final')?.weight).toBe(100)
    expect(draftStatusById('nope')).toBeUndefined()
    expect(draftStatusById(undefined)).toBeUndefined()
  })

  it('allDraftStatuses: свои статусы добавляются, по id перекрывают встроенные', () => {
    const custom = [
      { id: 'polish', label: 'Полировка', color: '#0ea5e9', weight: 90 },
      { id: 'done', label: 'ГОТОВО!', color: '#000000', weight: 100 },
    ]
    const all = allDraftStatuses(custom)
    expect(all).toHaveLength(7)
    expect(all.find((s) => s.id === 'polish')?.label).toBe('Полировка')
    expect(all.find((s) => s.id === 'done')?.label).toBe('ГОТОВО!')
  })

  it('scriptReadiness: средневзвешенный %, без статуса = 0', () => {
    const scenes = [
      { draftStatus: 'final' },   // 100
      { draftStatus: 'wip' },     // 50
      { draftStatus: 'draft' },   // 10
      {},                          // 0
      { draftStatus: 'unknown' }, // 0
    ]
    expect(scriptReadiness(scenes)).toBe(32) // (100+50+10+0+0)/5
    expect(scriptReadiness([{ draftStatus: 'final' }, { draftStatus: 'done' }])).toBe(100)
    expect(scriptReadiness([])).toBe(0)
  })

  it('scriptReadiness учитывает свои статусы', () => {
    const custom = [{ id: 'polish', label: 'Полировка', color: '#0ea5e9', weight: 90 }]
    expect(scriptReadiness([{ draftStatus: 'polish' }], custom)).toBe(90)
  })
})
