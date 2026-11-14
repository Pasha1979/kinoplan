import { describe, it, expect } from 'vitest'
import {
  parseSceneHeader,
  parseCharacter,
  parseActionForProps,
  parseScript,
  getUniqueElements,
  flattenSceneTags,
  mergeBreakdownElements,
  type Block
} from './scriptParser'

describe('scriptParser', () => {
  describe('parseSceneHeader', () => {
    it('should parse Russian scene header format', () => {
      const header = parseSceneHeader('1. ИНТ. КВАРТИРА ИВАНА — ДЕНЬ')
      expect(header).not.toBeNull()
      expect(header?.number).toBe('1')
      expect(header?.type).toBe('INT')
      expect(header?.location).toBe('КВАРТИРА ИВАНА')
      expect(header?.timeOfDay).toBe('ДЕНЬ')
    })

    it('should parse English scene header format', () => {
      const header = parseSceneHeader('1. INT. APARTMENT — DAY')
      expect(header).not.toBeNull()
      expect(header?.number).toBe('1')
      expect(header?.type).toBe('INT')
      expect(header?.location).toBe('APARTMENT')
      expect(header?.timeOfDay).toBe('DAY')
    })

    it('should parse PAV (pavilion) type', () => {
      const header = parseSceneHeader('3. ПАВ. Студия A — УТРО')
      expect(header).not.toBeNull()
      expect(header?.type).toBe('PAV')
      expect(header?.location).toBe('СТУДИЯ A')
      expect(header?.timeOfDay).toBe('УТРО')
    })

    it('should parse FilmToolz НАТ. as EXT', () => {
      const header = parseSceneHeader('4. НАТ. Улица Ленина — НОЧЬ')
      expect(header).not.toBeNull()
      expect(header?.type).toBe('EXT')
      expect(header?.location).toBe('УЛИЦА ЛЕНИНА')
    })

    it('should split dot-notation location into location and sublocation', () => {
      const header = parseSceneHeader('5. ИНТ. Школа.Кабинет директора — ДЕНЬ')
      expect(header).not.toBeNull()
      expect(header?.location).toBe('ШКОЛА')
      expect(header?.sublocation).toBe('КАБИНЕТ ДИРЕКТОРА')
    })

    it('should parse manual timing (мм:сс) from header', () => {
      const header = parseSceneHeader('6. ИНТ. Квартира — ДЕНЬ (01:30)')
      expect(header).not.toBeNull()
      expect(header?.manualDuration).toBe(90)
      expect(header?.timeOfDay).toBe('ДЕНЬ')
    })

    it('should return null for invalid format', () => {
      expect(parseSceneHeader('INVALID HEADER')).toBeNull()
    })
  })

  describe('parseCharacter', () => {
    it('should clean and uppercase character names', () => {
      expect(parseCharacter('иван (за кадром)')).toBe('ИВАН')
      expect(parseCharacter('МАША (О.С.)')).toBe('МАША')
    })
  })

  describe('parseActionForProps', () => {
    it('should find props in action block using keywords and caps words', () => {
      const result = parseActionForProps('Иван достает ПИСТОЛЕТ и кладет на стол.')
      expect(result.some(p => p.name === 'ПИСТОЛЕТ')).toBe(true)
    })
  })

  describe('parseScript', () => {
    it('should parse array of blocks into parsed scenes', () => {
      const blocks: Block[] = [
        { id: '1', type: 'scene_header', content: '1. ИНТ. КВАРТИРА — ДЕНЬ' },
        { id: '2', type: 'character', content: 'ИВАН' },
        { id: '3', type: 'action', content: 'Иван держит ТЕЛЕФОН.' }
      ]

      const scenes = parseScript(blocks)
      expect(scenes.length).toBe(1)
      expect(scenes[0].number).toBe('1')
      expect(scenes[0].elements.length).toBeGreaterThan(0)
    })
  })

  describe('getUniqueElements', () => {
    it('should aggregate elements from all scenes uniquely', () => {
      const mockScenes = [
        {
          id: '1',
          number: '1',
          type: 'INT' as const,
          location: 'HOME',
          sublocation: undefined,
          timeOfDay: 'DAY',
          manualDuration: undefined,
          elements: [
            { id: 'cast_IVAN', category: 'cast' as const, name: 'IVAN', sceneIds: ['1'], occurrences: [] }
          ]
        }
      ]
      const unique = getUniqueElements(mockScenes)
      expect(unique.length).toBe(1)
      expect(unique[0].name).toBe('IVAN')
    })
  })

  // T-108: разбивка — идентичность сцен по UUID и склейка ручных/авто тегов
  describe('T-108 breakdown', () => {
    const blocks = [
      { id: 'scene_header-u1', type: 'scene_header', content: '1. ИНТ. ДОМ — ДЕНЬ', sceneId: 'u1' },
      { id: 'a1', type: 'action', content: 'Иван входит с пистолетом.' },
      { id: 'c1', type: 'character', content: 'ИВАН' },
      { id: 'd1', type: 'dialog', content: 'Привет.' },
      { id: 'scene_header-u2', type: 'scene_header', content: '2. ЭКСТ. ЛЕС — НОЧЬ', sceneId: 'u2' },
      { id: 'c2', type: 'character', content: 'ИВАН' },
      { id: 'd2', type: 'dialog', content: 'Тишина.' },
    ]

    it('id сцены = sceneId блока (data-scene-id), не id блока', () => {
      const scenes = parseScript(blocks)
      expect(scenes.map((s) => s.id)).toEqual(['u1', 'u2'])
    })

    it('авто-элементы ссылаются на UUID сцен', () => {
      const elements = getUniqueElements(parseScript(blocks))
      const ivan = elements.find((e) => e.name === 'ИВАН')!
      expect(ivan.sceneIds).toEqual(['u1', 'u2'])
      const dom = elements.find((e) => e.name === 'ДОМ')!
      expect(dom.sceneIds).toEqual(['u1'])
    })

    it('без sceneId — fallback на id блока (легаси)', () => {
      const legacy = [{ id: 'h1', type: 'scene_header', content: '3. ИНТ. САД — ДЕНЬ' }]
      expect(parseScript(legacy)[0].id).toBe('h1')
    })

    it('flattenSceneTags собирает ручные теги со сцен с manualRefs', () => {
      const manual = flattenSceneTags([
        { id: 'u1', breakdownElements: [{ id: 't1', category: 'props', name: 'ПИСТОЛЕТ' }] },
        { id: 'u2' },
      ])
      expect(manual).toHaveLength(1)
      expect(manual[0].manualRefs).toEqual([{ sceneId: 'u1', elementId: 't1' }])
      expect(manual[0].sceneIds).toEqual(['u1'])
    })

    it('одноимённые авто и ручной элемент склеиваются по «категория|имя»', () => {
      const parsed = getUniqueElements(parseScript(blocks))
      const manual = flattenSceneTags([
        { id: 'u2', breakdownElements: [{ id: 't1', category: 'cast', name: 'ИВАН' }] },
      ])
      const merged = mergeBreakdownElements(parsed, manual)
      const ivan = merged.filter((e) => e.name === 'ИВАН' && e.category === 'cast')
      expect(ivan).toHaveLength(1)
      expect(ivan[0].sceneIds).toEqual(['u1', 'u2'])
      expect(ivan[0].manualRefs).toEqual([{ sceneId: 'u2', elementId: 't1' }])
    })

    it('разные категории не склеиваются', () => {
      const parsed = getUniqueElements(parseScript(blocks))
      const manual = flattenSceneTags([
        { id: 'u1', breakdownElements: [{ id: 't1', category: 'vehicles', name: 'ИВАН' }] },
      ])
      const merged = mergeBreakdownElements(parsed, manual)
      expect(merged.filter((e) => e.name === 'ИВАН')).toHaveLength(2)
    })

    it('ручные сцены добавляются к авто-списку без дублей', () => {
      const parsed = getUniqueElements(parseScript(blocks))
      const manual = flattenSceneTags([
        { id: 'u1', breakdownElements: [{ id: 't1', category: 'cast', name: 'ИВАН' }] },
        { id: 'u2', breakdownElements: [{ id: 't2', category: 'cast', name: 'ИВАН' }] },
      ])
      const merged = mergeBreakdownElements(parsed, manual)
      const ivan = merged.find((e) => e.name === 'ИВАН' && e.category === 'cast')!
      expect(ivan.sceneIds).toEqual(['u1', 'u2'])
      expect(ivan.manualRefs).toHaveLength(2)
    })
  })
})
