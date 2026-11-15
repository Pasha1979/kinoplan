import { describe, it, expect } from 'vitest'
import { allDraftStatuses, draftStatusById, scriptReadiness, DEFAULT_DRAFT_STATUSES, isBuiltinStatus, countScenesWithStatus, reassignSceneStatus } from './draftStatus'

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

describe('draftStatus (T-122): правка/удаление своих статусов', () => {
  it('isBuiltinStatus: встроенный — канон, свой — правится', () => {
    expect(isBuiltinStatus('draft')).toBe(true)
    expect(isBuiltinStatus('final')).toBe(true)
    expect(isBuiltinStatus('custom-abc')).toBe(false)
  })

  it('countScenesWithStatus: считает ссылки по всем переданным сценам (все серии)', () => {
    const scenes = [
      { draftStatus: 'polish' }, { draftStatus: 'done' },
      { draftStatus: 'polish' }, {}, { draftStatus: 'wip' },
    ]
    expect(countScenesWithStatus('polish', scenes)).toBe(2)
    expect(countScenesWithStatus('none', scenes)).toBe(0)
  })

  it('reassignSceneStatus → без статуса: осиротевших ссылок нет', () => {
    const scenes = [
      { id: 'a', draftStatus: 'polish' }, { id: 'b', draftStatus: 'done' },
      { id: 'c', draftStatus: 'polish' }, { id: 'd' },
    ]
    const out = reassignSceneStatus(scenes, 'polish')
    expect(out.find((s) => s.id === 'a')?.draftStatus).toBeUndefined()
    expect(out.find((s) => s.id === 'c')?.draftStatus).toBeUndefined()
    expect(out.find((s) => s.id === 'b')?.draftStatus).toBe('done')
    expect(countScenesWithStatus('polish', out)).toBe(0)
  })

  it('reassignSceneStatus → перевод в другой статус', () => {
    const scenes = [{ id: 'a', draftStatus: 'polish' }, { id: 'b', draftStatus: 'wip' }]
    const out = reassignSceneStatus(scenes, 'polish', 'rework')
    expect(out.find((s) => s.id === 'a')?.draftStatus).toBe('rework')
    expect(out.find((s) => s.id === 'b')?.draftStatus).toBe('wip')
  })

  it('удаление по всем сериям: сцены каждого скрипта чистятся независимо', () => {
    // Имитация episodeScripts: серия 1 и серия 2 — у обеих сцены со статусом
    const ep1 = [{ id: 's1', draftStatus: 'polish' }, { id: 's2', draftStatus: 'done' }]
    const ep2 = [{ id: 's3', draftStatus: 'polish' }]
    const r1 = reassignSceneStatus(ep1, 'polish')
    const r2 = reassignSceneStatus(ep2, 'polish')
    expect(countScenesWithStatus('polish', r1)).toBe(0)
    expect(countScenesWithStatus('polish', r2)).toBe(0)
    expect(r1.find((s) => s.id === 's2')?.draftStatus).toBe('done')
  })
})
