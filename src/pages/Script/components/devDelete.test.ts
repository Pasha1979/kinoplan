// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { countDialogues, deleteCharacterEverywhere, deleteLocationEverywhere } from './devDelete'
import type { DevCharacter, DevLocation } from '../../../types/development'
import type { Scene } from '../../../types/scene'

const ch = (id: string, name: string, extra: Partial<DevCharacter> = {}): DevCharacter => ({
  id, name, type: 'secondary', ...extra,
})
const loc = (id: string, name: string, extra: Partial<DevLocation> = {}): DevLocation => ({
  id, name, ...extra,
})
const sc = (id: string, extra: Partial<Scene> = {}): Scene => ({
  id, number: '1', type: 'INT', location: 'ДОМ', time: 'ДЕНЬ',
  cast: [], dialogCharacters: [], synopsis: '', order: 0, ...extra,
} as Scene)

const HTML = [
  '<div data-type="scene-header" data-scene-id="s1">1. ИНТ. ДОМ ВЕДОВ — ДЕНЬ</div>',
  '<div data-type="scene-cast">ИВАН, МАРЬЯ, ПЁТР</div>',
  '<div data-type="scene-action">В комнате тихо.</div>',
  '<div data-type="scene-character">ИВАН (З/К)</div>',
  '<div data-type="scene-dialog">Привет.</div>',
  '<div data-type="scene-character">МАРЬЯ</div>',
  '<div data-type="scene-parenthetical">(тихо)</div>',
  '<div data-type="scene-dialog">Здравствуй.</div>',
  '<div data-type="scene-header" data-scene-id="s2">2. ЭКСТ. ДОМ ВЕДОВ.ЗАЛ — НОЧЬ</div>',
].join('')

describe('countDialogues', () => {
  it('считает реплики по всем сериям, учитывая (З/К)', () => {
    expect(countDialogues([HTML, HTML], 'ИВАН')).toBe(2)
    expect(countDialogues([HTML], 'МАРЬЯ')).toBe(1)
    expect(countDialogues([HTML], 'ПЁТР')).toBe(0)
  })
})

describe('deleteCharacterEverywhere', () => {
  const characters = [
    ch('1', 'ИВАН'), ch('2', 'МАРЬЯ', { relationships: [{ id: 'r1', targetId: '1', type: 'ally' }] }),
  ]
  const folders = [{ id: 'f1', name: 'Герои', color: '#888', kind: 'chars' as const, itemIds: ['1', '2'] }]
  const scenes = [sc('s1', { cast: ['ИВАН', 'МАРЬЯ'], dialogCharacters: ['ИВАН', 'МАРЬЯ'] })]

  it('убирает имя из библии, папок, связей, cast-строк и метаданных сцен', () => {
    const r = deleteCharacterEverywhere({
      characters, folders, id: '1', scenes, contents: [HTML], removeDialogues: false,
    })
    expect(r.characters.map((c) => c.name)).toEqual(['МАРЬЯ'])
    expect(r.characters[0].relationships).toHaveLength(0)
    expect(r.folders![0].itemIds).toEqual(['2'])
    // cast-строка в тексте
    expect(r.contentsPatched[0]).toContain('МАРЬЯ, ПЁТР')
    expect(r.contentsPatched[0]).not.toContain('ИВАН,')
    // метаданные сцены
    const p = r.sceneCastPatches.get('s1')!
    expect(p.cast).toEqual(['МАРЬЯ'])
    expect(p.dialogCharacters).toEqual(['МАРЬЯ'])
    // реплика без removeDialogues остаётся
    expect(r.contentsPatched[0]).toContain('scene-character')
    expect(r.removedReplicas).toBe(0)
  })

  it('removeDialogues стирает character-строку + remark/dialog хвост', () => {
    const r = deleteCharacterEverywhere({
      characters: [ch('1', 'МАРЬЯ')], folders: [], id: '1',
      scenes, contents: [HTML], removeDialogues: true,
    })
    expect(r.removedReplicas).toBe(1)
    expect(r.contentsPatched[0]).not.toContain('МАРЬЯ')
    expect(r.contentsPatched[0]).not.toContain('(тихо)')
    expect(r.contentsPatched[0]).not.toContain('Здравствуй')
    // соседние блоки других персонажей не тронуты
    expect(r.contentsPatched[0]).toContain('ИВАН (З/К)')
    expect(r.contentsPatched[0]).toContain('Привет.')
  })
})

describe('deleteLocationEverywhere', () => {
  const scenes = [
    sc('s1', { location: 'ДОМ ВЕДОВ' }),
    sc('s2', { location: 'ДОМ ВЕДОВ', sublocation: 'ЗАЛ' }),
    sc('s3', { location: 'УЛИЦА' }),
  ]

  it('родительская локация: шапка → «ИНТ. — ДЕНЬ», сцены теряют loc+sub', () => {
    const r = deleteLocationEverywhere({
      locations: [loc('1', 'ДОМ ВЕДОВ')], folders: [], id: '1', scenes, contents: [HTML],
    })
    expect(r.locations).toHaveLength(0)
    expect(r.headersPatched).toBe(2)
    expect(r.contentsPatched[0]).toContain('1. ИНТ. — ДЕНЬ')
    expect(r.contentsPatched[0]).toContain('2. ЭКСТ. — НОЧЬ')
    const p1 = r.sceneLocPatches.get('s1')!
    expect(p1.location).toBe('')
    const p2 = r.sceneLocPatches.get('s2')!
    expect(p2.location).toBe('')
    expect(p2.sublocation).toBeUndefined()
    expect(r.sceneLocPatches.has('s3')).toBe(false)
  })

  it('подлокация «ДОМ.ЗАЛ»: шапка → «ЭКСТ. ДОМ ВЕДОВ — НОЧЬ», sub слетает', () => {
    const r = deleteLocationEverywhere({
      locations: [loc('1', 'ДОМ ВЕДОВ.ЗАЛ')], folders: [], id: '1', scenes, contents: [HTML],
    })
    expect(r.contentsPatched[0]).toContain('2. ЭКСТ. ДОМ ВЕДОВ — НОЧЬ')
    expect(r.contentsPatched[0]).toContain('1. ИНТ. ДОМ ВЕДОВ — ДЕНЬ') // s1 не тронута
    const p2 = r.sceneLocPatches.get('s2')!
    expect(p2.location).toBe('ДОМ ВЕДОВ')
    expect(p2.sublocation).toBeUndefined()
    expect(r.sceneLocPatches.size).toBe(1)
  })

  it('локация без сцен: только справочник', () => {
    const r = deleteLocationEverywhere({
      locations: [loc('1', 'ЛЕС')], folders: [], id: '1', scenes, contents: [HTML],
    })
    expect(r.locations).toHaveLength(0)
    expect(r.headersPatched).toBe(0)
    expect(r.contentsPatched[0]).toBe(HTML)
  })
})
