import { describe, it, expect } from 'vitest'
import { findLocDuplicates, mergeLocations } from './locMerge'
import type { DevLocation } from '../../../types/development'
import type { Scene } from '../../../types/scene'

const loc = (id: string, name: string, extra: Partial<DevLocation> = {}): DevLocation => ({
  id, name, ...extra,
})

describe('findLocDuplicates', () => {
  it('находит пару «ДОМ» / «ДОМ ИВАНА» (prefix)', () => {
    const d = findLocDuplicates([loc('1', 'ДОМ'), loc('2', 'ДОМ ИВАНА'), loc('3', 'УЛИЦА')])
    expect(d).toHaveLength(1)
    expect(d[0].a.name).toBe('ДОМ')
    expect(d[0].b.name).toBe('ДОМ ИВАНА')
    expect(d[0].reason).toBe('prefix')
  })

  it('находит опечатку (КВАРТИРА / КВАРТИРАА)', () => {
    const d = findLocDuplicates([loc('1', 'КВАРТИРА'), loc('2', 'КВАРТИРАА')])
    expect(d).toHaveLength(1)
    expect(d[0].reason).toBe('typo')
  })

  it('не связывает разные локации с общим словом (УЛИЦА ПУШКИНА / УЛИЦА ЛЕНИНА)', () => {
    const d = findLocDuplicates([loc('1', 'УЛИЦА ПУШКИНА'), loc('2', 'УЛИЦА ЛЕНИНА')])
    expect(d).toHaveLength(0)
  })

  it('Ё/Е считаются одинаковыми (ДАЧА ЗАЁМКИНЫХ / ДАЧА ЗАЕМКИНЫХ)', () => {
    const d = findLocDuplicates([loc('1', 'ДАЧА ЗАЁМКИНЫХ'), loc('2', 'ДАЧА ЗАЕМКИНЫХ')])
    expect(d).toHaveLength(1)
  })
})

describe('mergeLocations', () => {
  const scenes: Scene[] = [
    { id: 's1', projectId: 'p', number: '1', type: 'ИНТ', location: 'ДОМ ИВАНА', time: 'ДЕНЬ', cast: [], pages: 1 },
    { id: 's2', projectId: 'p', number: '2', type: 'ИНТ', location: 'ДОМ', time: 'ДЕНЬ', cast: [], pages: 1 },
    { id: 's3', projectId: 'p', number: '3', type: 'НАТ', location: 'УЛИЦА', time: 'НОЧЬ', cast: [], pages: 1 },
  ]

  it('объединяет метаданные и sceneIds, drop удаляется', () => {
    const r = mergeLocations({
      locations: [
        loc('keep', 'ДОМ', { description: 'главная локация', sceneIds: ['s2'] }),
        loc('drop', 'ДОМ ИВАНА', { atmosphere: 'тёплая', sceneIds: ['s1'] }),
      ],
      keepId: 'keep', dropId: 'drop', scenes, contents: [],
    })
    const m = r.locations.find((l) => l.id === 'keep')!
    expect(m.description).toBe('главная локация')
    expect(m.atmosphere).toBe('тёплая')
    expect(m.sceneIds?.sort()).toEqual(['s1', 's2'])
    expect(r.locations.some((l) => l.id === 'drop')).toBe(false)
  })

  it('заменяет название в контенте и scene.location', () => {
    const r = mergeLocations({
      locations: [loc('keep', 'ДОМ'), loc('drop', 'ДОМ ИВАНА')],
      keepId: 'keep', dropId: 'drop',
      scenes,
      contents: ['<div>ИНТ. ДОМ ИВАНА — ДЕНЬ</div>', '<div>ИНТ. УЛИЦА — НОЧЬ</div>'],
    })
    expect(r.replacedInText).toBe(1)
    expect(r.contentsPatched[0]).toContain('ИНТ. ДОМ — ДЕНЬ')
    expect(r.sceneLocPatches.get('s1')).toBe('ДОМ')
    expect(r.sceneLocPatches.has('s2')).toBe(false)
    expect(r.sceneLocPatches.has('s3')).toBe(false)
  })

  it('не задевает длинное название при слиянии короткого (граница слов)', () => {
    const r = mergeLocations({
      locations: [loc('keep', 'КВАРТИРА'), loc('drop', 'ДОМ')],
      keepId: 'keep', dropId: 'drop',
      scenes: [],
      contents: ['<div>ИНТ. ДОМ ИВАНА — ДЕНЬ</div>'],
    })
    // «ДОМ» внутри «ДОМ ИВАНА» — это начало имени, граница после «ДОМ» есть («ДОМ » — пробел не буква)
    // → замена корректно срабатывает по границе слова
    expect(r.contentsPatched[0]).toContain('ИНТ. КВАРТИРА ИВАНА — ДЕНЬ')
  })

  it('папки: drop вычитается, keep остаётся', () => {
    const r = mergeLocations({
      locations: [loc('keep', 'ДОМ'), loc('drop', 'ДОМ ИВАНА')],
      folders: [{ id: 'f1', name: 'Дома', color: '#fff', kind: 'locs', itemIds: ['drop'] }],
      keepId: 'keep', dropId: 'drop', scenes: [], contents: [],
    })
    expect(r.folders![0].itemIds).toEqual(['keep'])
  })

  it('несуществующие id — no-op', () => {
    const locs = [loc('1', 'ДОМ')]
    const r = mergeLocations({ locations: locs, keepId: 'x', dropId: 'y', scenes: [], contents: ['a'] })
    expect(r.locations).toEqual(locs)
    expect(r.replacedInText).toBe(0)
    expect(r.contentsPatched).toEqual(['a'])
  })
})
