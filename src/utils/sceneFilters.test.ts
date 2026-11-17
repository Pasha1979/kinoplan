import { describe, it, expect } from 'vitest'
import {
  filterByNavigatorType, filterByCardType, applyNavigatorFilters,
  matchesCardQuery, countByField, presentColorTags, toggleInList,
  nextSceneIndex, buildAutoSynopsis, groupByEpisode, scenesOfSeries,
  sceneTypeColor, nextGroupColor, GROUP_COLORS,
} from './sceneFilters'
import type { Scene } from '../types/scene'

const sc = (patch: Partial<Scene>): Scene => ({
  id: crypto.randomUUID(), number: '1', type: 'ИНТ', location: 'ДОМ',
  time: 'ДЕНЬ', cast: [], pages: 1, duration: 0, charCount: 100,
  ...patch,
} as Scene)

describe('filterByNavigatorType', () => {
  const scenes = [
    sc({ type: 'ИНТ' }), sc({ type: 'ЭКСТ' }), sc({ type: 'ИНТ-ЭКСТ' }), sc({ type: 'ПАВ' }),
  ]
  it('all → все сцены', () => {
    expect(filterByNavigatorType(scenes, 'all')).toHaveLength(4)
  })
  it('ИНТ включает ИНТ-ЭКСТ, но не ЭКСТ', () => {
    expect(filterByNavigatorType(scenes, 'ИНТ').map((s) => s.type)).toEqual(['ИНТ', 'ИНТ-ЭКСТ'])
  })
  it('ЭКСТ — строго ЭКСТ (ИНТ-ЭКСТ не входит)', () => {
    expect(filterByNavigatorType(scenes, 'ЭКСТ').map((s) => s.type)).toEqual(['ЭКСТ'])
  })
  it('ПАВ — строго ПАВ', () => {
    expect(filterByNavigatorType(scenes, 'ПАВ').map((s) => s.type)).toEqual(['ПАВ'])
  })
})

describe('filterByCardType', () => {
  const scenes = [
    sc({ type: 'ИНТ' }), sc({ type: 'ЭКСТ' }), sc({ type: 'ИНТ-ЭКСТ' }), sc({ type: 'ИНТ/ЭКСТ' }), sc({ type: 'ПАВ' }),
  ]
  it('карточки: ИНТ и ЭКСТ оба включают смешанные типы', () => {
    expect(filterByCardType(scenes, 'ИНТ').map((s) => s.type)).toEqual(['ИНТ', 'ИНТ-ЭКСТ', 'ИНТ/ЭКСТ'])
    expect(filterByCardType(scenes, 'ЭКСТ').map((s) => s.type)).toEqual(['ЭКСТ', 'ИНТ-ЭКСТ', 'ИНТ/ЭКСТ'])
  })
})

describe('applyNavigatorFilters', () => {
  const a = sc({ type: 'ИНТ', location: 'ДОМ', cast: ['ИВАН'], colorTag: 'blue', synopsis: 'Утро в доме' })
  const b = sc({ type: 'ЭКСТ', location: 'УЛИЦА', cast: ['МАША'], colorTag: 'green' })
  const c = sc({ type: 'ИНТ', location: 'ОФИС', cast: ['ИВАН', 'ПЕТЯ'] })
  const all = [a, b, c]
  const base = { type: 'all' as const, locations: [], characters: [], colors: [], query: '' }

  it('без фильтров → все сцены', () => {
    expect(applyNavigatorFilters(all, base)).toHaveLength(3)
  })
  it('по локации', () => {
    expect(applyNavigatorFilters(all, { ...base, locations: ['ДОМ', 'ОФИС'] })).toEqual([a, c])
  })
  it('по персонажу — ИЛИ внутри массива', () => {
    expect(applyNavigatorFilters(all, { ...base, characters: ['МАША'] })).toEqual([b])
    expect(applyNavigatorFilters(all, { ...base, characters: ['ИВАН', 'МАША'] })).toEqual([a, b, c])
  })
  it('по цвету — сцены без colorTag отсекаются', () => {
    expect(applyNavigatorFilters(all, { ...base, colors: ['blue'] })).toEqual([a])
  })
  it('комбинация: тип ИНТ + локация ОФИС + персонаж ПЕТЯ', () => {
    expect(applyNavigatorFilters(all, { ...base, type: 'ИНТ', locations: ['ОФИС'], characters: ['ПЕТЯ'] })).toEqual([c])
  })
  it('поиск по синопсису и cast, регистронезависимо', () => {
    expect(applyNavigatorFilters(all, { ...base, query: 'утро' })).toEqual([a])
    expect(applyNavigatorFilters(all, { ...base, query: 'маша' })).toEqual([b])
  })
})

describe('matchesCardQuery', () => {
  const s = sc({ number: '1-8-А', location: 'ДОМ ДЕДА', sublocation: 'СЕНИ', cast: ['ИВАН'] })
  it('пустой запрос → true', () => expect(matchesCardQuery(s, '', '')).toBe(true))
  it('номер, локация, подлокация, cast, синопсис', () => {
    expect(matchesCardQuery(s, '', '1-8-а')).toBe(true)
    expect(matchesCardQuery(s, '', 'дом деда')).toBe(true)
    expect(matchesCardQuery(s, '', 'сени')).toBe(true)
    expect(matchesCardQuery(s, '', 'иван')).toBe(true)
    expect(matchesCardQuery(s, 'утренний туман', 'туман')).toBe(true)
    expect(matchesCardQuery(s, '', 'парк')).toBe(false)
  })
})

describe('countByField', () => {
  const scenes = [
    sc({ location: 'ДОМ', cast: ['ИВАН', 'МАША'] }),
    sc({ location: 'ДОМ', cast: ['ИВАН'] }),
    sc({ location: 'УЛИЦА', cast: [] }),
  ]
  it('локации по убыванию кол-ва', () => {
    expect(countByField(scenes, 'location')).toEqual([['ДОМ', 2], ['УЛИЦА', 1]])
  })
  it('персонажи по убыванию кол-ва', () => {
    expect(countByField(scenes, 'character')).toEqual([['ИВАН', 2], ['МАША', 1]])
  })
})

describe('presentColorTags', () => {
  it('только присутствующие цвета в каноническом порядке', () => {
    const scenes = [sc({ colorTag: 'orange' }), sc({ colorTag: 'blue' }), sc({})]
    expect(presentColorTags(scenes)).toEqual(['blue', 'orange'])
  })
})

describe('toggleInList', () => {
  it('добавляет отсутствующее и убирает присутствующее', () => {
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('nextSceneIndex', () => {
  const list = [{ id: 's1' }, { id: 's2' }, { id: 's3' }]
  it('пустой список → null', () => expect(nextSceneIndex([], 's1', 1)).toBeNull())
  it('без активной: вниз → первая, вверх → последняя', () => {
    expect(nextSceneIndex(list, undefined, 1)).toBe(0)
    expect(nextSceneIndex(list, undefined, -1)).toBe(2)
  })
  it('от активной — соседний индекс, зажатый границами', () => {
    expect(nextSceneIndex(list, 's2', 1)).toBe(2)
    expect(nextSceneIndex(list, 's2', -1)).toBe(0)
    expect(nextSceneIndex(list, 's3', 1)).toBeNull() // уже в конце
    expect(nextSceneIndex(list, 's1', -1)).toBeNull() // уже в начале
  })
})

describe('buildAutoSynopsis', () => {
  it('первая ремарка после шапки; без action — первый текстовый блок', () => {
    const blocks = [
      { type: 'scene_header', content: '1. ИНТ. ДОМ - ДЕНЬ' },
      { type: 'scene_dialog', content: 'Привет!' },
      { type: 'action', content: 'Он встаёт и уходит.' },
      { type: 'scene_header', content: '2. ЭКТ. ДВОР - НОЧЬ' },
      { type: 'scene_dialog', content: 'Только диалог.' },
    ]
    const scenes = [{ id: 's1' }, { id: 's2' }]
    const m = buildAutoSynopsis(blocks, scenes)
    expect(m.get('s1')).toBe('Он встаёт и уходит.') // action важнее диалога
    expect(m.get('s2')).toBe('Только диалог.') // fallback на первый текст
  })
})

describe('groupByEpisode / scenesOfSeries', () => {
  it('группирует по _episode и сортирует серии', () => {
    const scenes = [
      { _episode: 2, n: 'a' }, { _episode: 1, n: 'b' }, { n: 'c' }, { _episode: 2, n: 'd' },
    ]
    const g = groupByEpisode(scenes)
    expect(g.map(([ep]) => ep)).toEqual([1, 2])
    expect(g[0][1].map((s) => s.n)).toEqual(['b', 'c']) // без _episode → серия 1
  })
  it('scenesOfSeries парсит префикс «N-»', () => {
    const scenes = [{ number: '1-3' }, { number: '2-1' }, { number: '12' }, { number: '2-12' }]
    expect(scenesOfSeries(scenes, 2).map((s) => s.number)).toEqual(['2-1', '2-12'])
    expect(scenesOfSeries(scenes, 1).map((s) => s.number)).toEqual(['1-3'])
  })
})

describe('цвета', () => {
  it('sceneTypeColor: известный тип → цвет, неизвестный → серый', () => {
    expect(sceneTypeColor('ИНТ')).toBe('#8b5cf6')
    expect(sceneTypeColor('НЕТ ТАКОГО')).toBe('#94a3b8')
    expect(sceneTypeColor(undefined)).toBe('#94a3b8')
  })
  it('nextGroupColor циклически по палитре', () => {
    expect(nextGroupColor(0)).toBe(GROUP_COLORS[0])
    expect(nextGroupColor(5)).toBe(GROUP_COLORS[0])
    expect(nextGroupColor(3)).toBe(GROUP_COLORS[3])
  })
})
