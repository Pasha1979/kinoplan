import { describe, it, expect } from 'vitest'
import {
  parseSceneHeader,
  parseCharacter,
  parseActionForProps,
  parseScript,
  getUniqueElements,
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
      expect(header?.location).toBe('Студия A')
      expect(header?.timeOfDay).toBe('УТРО')
    })

    it('should parse FilmToolz НАТ. as EXT', () => {
      const header = parseSceneHeader('4. НАТ. Улица Ленина — НОЧЬ')
      expect(header).not.toBeNull()
      expect(header?.type).toBe('EXT')
      expect(header?.location).toBe('Улица Ленина')
    })

    it('should split dot-notation location into location and sublocation', () => {
      const header = parseSceneHeader('5. ИНТ. Школа.Кабинет директора — ДЕНЬ')
      expect(header).not.toBeNull()
      expect(header?.location).toBe('Школа')
      expect(header?.sublocation).toBe('Кабинет директора')
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
})
