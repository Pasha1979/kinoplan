// @vitest-environment jsdom
// Авто-синк библии: дедуп через norm() (Ё→Е, свёртка пробелов) — почти-дублей нет
import { describe, it, expect } from 'vitest'
import { syncBibleWithScenes } from './bibleSync'
import type { DevCharacter, DevLocation, ProjectDevelopment } from '../../../types/development'
import type { Scene } from '../../../types/scene'

const sc = (id: string, extra: Partial<Scene> = {}): Scene => ({
  id, number: '1', type: 'INT', location: '', time: 'ДЕНЬ',
  cast: [], dialogCharacters: [], synopsis: '', order: 0, ...extra,
} as Scene)
const ch = (name: string, extra: Partial<DevCharacter> = {}): DevCharacter => ({
  id: name, name, type: 'secondary', ...extra,
})
const loc = (name: string, extra: Partial<DevLocation> = {}): DevLocation => ({ id: name, name, ...extra })
const dev = (characters: DevCharacter[] = [], locations: DevLocation[] = []): ProjectDevelopment => ({
  characters, locations, synopsis: {},
} as ProjectDevelopment)

describe('syncBibleWithScenes — новые имена из текста', () => {
  it('новое имя из cast и диалогов → одна карточка со sceneIds', () => {
    const scenes = [
      sc('s1', { cast: ['ИВАН'], dialogCharacters: ['ИВАН'] }),
      sc('s2', { cast: ['ИВАН', 'МАРЬЯ'], dialogCharacters: ['МАРЬЯ'] }),
    ]
    const r = syncBibleWithScenes(dev(), scenes)
    expect(r.changed).toBe(true)
    expect(r.characters).toHaveLength(2)
    const ivan = r.characters.find((c) => c.name === 'ИВАН')!
    expect(ivan.sceneIds).toEqual(['s1', 's2'])
    const marya = r.characters.find((c) => c.name === 'МАРЬЯ')!
    expect(marya.sceneIds).toEqual(['s2'])
  })

  it('«ЁЛКИН» в тексте и «ЕЛКИН» в библии → одна карточка, дубля нет', () => {
    const scenes = [sc('s1', { cast: ['ЁЛКИН'], dialogCharacters: [] })]
    const r = syncBibleWithScenes(dev([ch('ЕЛКИН', { bio: 'описание' } as never)]), scenes)
    // карточка осталась одна — обновились только sceneIds
    expect(r.characters).toHaveLength(1)
    expect(r.characters[0].name).toBe('ЕЛКИН')
    expect(r.characters[0].sceneIds).toEqual(['s1'])
    expect((r.characters[0] as { bio?: string }).bio).toBe('описание')
  })

  it('двойные пробелы в тексте не плодят второе имя', () => {
    const scenes = [sc('s1', { cast: ['ИВАН   ПЕТРОВ'], dialogCharacters: [] })]
    const r = syncBibleWithScenes(dev([ch('ИВАН ПЕТРОВ')]), scenes)
    expect(r.characters).toHaveLength(1)
    expect(r.characters[0].sceneIds).toEqual(['s1'])
  })

  it('локации: родитель собирает сцены подлокаций, полный путь — свои', () => {
    const scenes = [
      sc('s1', { location: 'ДОМ', sublocation: 'ЗАЛ' }),
      sc('s2', { location: 'ДОМ', sublocation: 'КУХНЯ' }),
      sc('s3', { location: 'ЛЕС' }),
    ]
    const r = syncBibleWithScenes(dev(), scenes)
    const names = r.locations.map((l) => `${l.name}:${(l.sceneIds ?? []).join('+')}`)
    expect(names).toContain('ДОМ:s1+s2')
    expect(names).toContain('ДОМ.ЗАЛ:s1')
    expect(names).toContain('ДОМ.КУХНЯ:s2')
    expect(names).toContain('ЛЕС:s3')
  })

  it('«ЁЛКА»/«ЕЛКА» в локациях → одна запись', () => {
    const scenes = [sc('s1', { location: 'ЕЛКА' })]
    const r = syncBibleWithScenes(dev([], [loc('ЁЛКА')]), scenes)
    expect(r.locations).toHaveLength(1)
    expect(r.locations[0].name).toBe('ЁЛКА')
    expect(r.locations[0].sceneIds).toEqual(['s1'])
  })

  it('ничего не изменилось → changed=false (стор не трогаем)', () => {
    const scenes = [sc('s1', { cast: ['ИВАН'], location: 'ДОМ' })]
    const r = syncBibleWithScenes(
      dev([ch('ИВАН', { sceneIds: ['s1'] })], [loc('ДОМ', { sceneIds: ['s1'] })]),
      scenes,
    )
    expect(r.changed).toBe(false)
    expect(r.characters).toHaveLength(1)
  })

  it('переименованная автором карточка НЕ удаляется («не в сценах»)', () => {
    const scenes = [sc('s1', { cast: ['ИВАН'] })]
    const r = syncBibleWithScenes(dev([ch('СТАРОЕ_ИМЯ'), ch('ИВАН')]), scenes)
    expect(r.characters.map((c) => c.name)).toEqual(['СТАРОЕ_ИМЯ', 'ИВАН'])
  })
})
