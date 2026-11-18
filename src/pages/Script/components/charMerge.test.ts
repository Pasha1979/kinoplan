import { describe, it, expect } from 'vitest'
import { findCharDuplicates, mergeCharacters, nameBoundaryRegex, levenshtein } from './charMerge'
import type { DevCharacter } from '../../../types/development'
import type { Scene } from '../../../types/scene'

const ch = (id: string, name: string, extra: Partial<DevCharacter> = {}): DevCharacter => ({
  id, name, type: 'secondary', ...extra,
})

describe('findCharDuplicates', () => {
  it('находит пару «имя» / «имя + фамилия» (prefix)', () => {
    const d = findCharDuplicates([ch('1', 'ИВАН'), ch('2', 'ИВАН ПЕТРОВ'), ch('3', 'МАША')])
    expect(d).toHaveLength(1)
    expect(d[0].a.name).toBe('ИВАН')
    expect(d[0].b.name).toBe('ИВАН ПЕТРОВ')
    expect(d[0].reason).toBe('prefix')
  })

  it('находит опечатку (ИВАН / ИАВН — перестановка)', () => {
    const d = findCharDuplicates([ch('1', 'ИВАН'), ch('2', 'ИАВН')])
    expect(d).toHaveLength(1)
    expect(d[0].reason).toBe('typo')
  })

  it('не связывает разных людей с общим словом (ДОКТОР СМИРНОВ / ДОКТОР ПЛОХ)', () => {
    const d = findCharDuplicates([ch('1', 'ДОКТОР СМИРНОВ'), ch('2', 'ДОКТОР ПЛОХ')])
    expect(d).toHaveLength(0)
  })

  it('Ё/Е считаются одинаковыми (ПЁТР/ПЕТР)', () => {
    const d = findCharDuplicates([ch('1', 'ПЁТР'), ch('2', 'ПЕТР')])
    expect(d).toHaveLength(1)
  })
})

describe('levenshtein', () => {
  it('базовые случаи', () => {
    expect(levenshtein('ИВАН', 'ИВАН')).toBe(0)
    expect(levenshtein('ИВАН', 'ИВА')).toBe(1)
    expect(levenshtein('ИАВН', 'ИВАН')).toBe(2)
  })
})

describe('nameBoundaryRegex', () => {
  it('не заменяет имя внутри другого слова', () => {
    const re = nameBoundaryRegex('ИВАН')
    expect('ИВАНОВ вошёл. ИВАН стоял.'.replace(re, 'X')).toBe('ИВАНОВ вошёл. X стоял.')
  })
  it('заменяет двойное имя', () => {
    const re = nameBoundaryRegex('ИВАН ПЕТРОВ')
    expect('ИВАН ПЕТРОВ молчит.'.replace(re, 'ИВАН')).toBe('ИВАН молчит.')
  })
})

describe('mergeCharacters', () => {
  const scenes: Scene[] = [
    { id: 's1', projectId: 'p', number: '1', type: 'ИНТ', location: 'ДОМ', time: 'ДЕНЬ', cast: ['ИВАН ПЕТРОВ', 'МАША'], dialogCharacters: ['ИВАН ПЕТРОВ'], pages: 1 },
    { id: 's2', projectId: 'p', number: '2', type: 'ИНТ', location: 'ДОМ', time: 'ДЕНЬ', cast: ['ИВАН'], pages: 1 },
  ]

  it('объединяет метаданные: заполненные keep не затираются, пустые берутся из drop', () => {
    const r = mergeCharacters({
      characters: [
        ch('keep', 'ИВАН', { description: 'главный' }),
        ch('drop', 'ИВАН ПЕТРОВ', { description: 'лишний', age: '35', fear: 'высоты' }),
      ],
      keepId: 'keep', dropId: 'drop', scenes, contents: [],
    })
    const m = r.characters.find((c) => c.id === 'keep')!
    expect(m.description).toBe('главный')
    expect(m.age).toBe('35')
    expect(m.fear).toBe('высоты')
    expect(r.characters.some((c) => c.id === 'drop')).toBe(false)
  })

  it('заменяет имя в контенте и cast-списках', () => {
    const r = mergeCharacters({
      characters: [ch('keep', 'ИВАН'), ch('drop', 'ИВАН ПЕТРОВ')],
      keepId: 'keep', dropId: 'drop',
      scenes,
      contents: ['<div>ИВАН ПЕТРОВ вошёл</div>', '<div>МАША ждёт</div>'],
    })
    expect(r.replacedInText).toBe(1)
    expect(r.contentsPatched[0]).toContain('ИВАН вошёл')
    expect(r.sceneCastPatches.get('s1')).toEqual({ cast: ['ИВАН', 'МАША'], dialogCharacters: ['ИВАН'] })
    expect(r.sceneCastPatches.has('s2')).toBe(false)
  })

  it('объединяет sceneIds и перенацеливает связи', () => {
    const r = mergeCharacters({
      characters: [
        ch('keep', 'ИВАН', { sceneIds: ['s2'], relationships: [{ id: 'r1', type: 'friend', targetId: 'c3' }] }),
        ch('drop', 'ИВАН ПЕТРОВ', { sceneIds: ['s1'], relationships: [{ id: 'r2', type: 'ally', targetId: 'c3' }] }),
        ch('c3', 'МАША', { relationships: [{ id: 'r3', type: 'family', targetId: 'drop' }] }),
      ],
      keepId: 'keep', dropId: 'drop', scenes, contents: [],
    })
    const m = r.characters.find((c) => c.id === 'keep')!
    expect(m.sceneIds?.sort()).toEqual(['s1', 's2'])
    expect(m.relationships).toHaveLength(2)
    const masha = r.characters.find((c) => c.id === 'c3')!
    expect(masha.relationships![0].targetId).toBe('keep')
  })

  it('папки: drop вычитается, keep остаётся', () => {
    const r = mergeCharacters({
      characters: [ch('keep', 'ИВАН'), ch('drop', 'ИВАН ПЕТРОВ')],
      folders: [{ id: 'f1', name: 'Герои', color: '#fff', kind: 'chars', itemIds: ['drop'] }],
      keepId: 'keep', dropId: 'drop', scenes, contents: [],
    })
    expect(r.folders![0].itemIds).toEqual(['keep'])
  })
})
