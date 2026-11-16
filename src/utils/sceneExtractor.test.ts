import { describe, it, expect } from 'vitest'
import { extractScenesFromDocument } from './sceneExtractor'
import type { Node as PMNode } from '@tiptap/pm/model'

describe('extractScenesFromDocument', () => {
  it('should extract scenes and statistics from mock doc', () => {
    const nodes = [
      { type: { name: 'sceneHeader' }, textContent: '1. ИНТ. КВАРТИРА — ДЕНЬ' },
      { type: { name: 'sceneCast' }, textContent: 'МАША, ПЕТЯ' },
      { type: { name: 'sceneAction' }, textContent: 'Они обсуждают планы на вечер.' },
    ]

    const mockDoc = {
      forEach: (callback: (node: PMNode, index: number) => void) => {
        nodes.forEach((n, i) => callback(n as unknown as PMNode, i))
      }
    } as unknown as PMNode

    const result = extractScenesFromDocument({
      doc: mockDoc,
      forcedPages: 1.0,
      precisePagesFallback: 1.0,
      timingSystem: 'page',
      genreCoefficient: 1.0,
    })

    expect(result.scenes.length).toBe(1)
    const scene = result.scenes[0]
    expect(scene.number).toBe('1')
    expect(scene.type).toBe('ИНТ')
    expect(scene.location).toBe('КВАРТИРА')
    expect(scene.time).toBe('ДЕНЬ')
    expect(scene.cast).toEqual(['МАША', 'ПЕТЯ'])
    expect(scene.charCount).toBeGreaterThan(0)
  })

  it('should correctly parse alternative formats without dashes', () => {
    const nodes = [
      { type: { name: 'sceneHeader' }, textContent: '2. ЭКСТ. ОФИС. НОЧЬ.' },
    ]

    const mockDoc = {
      forEach: (callback: (node: PMNode, index: number) => void) => {
        nodes.forEach((n, i) => callback(n as unknown as PMNode, i))
      }
    } as unknown as PMNode

    const result = extractScenesFromDocument({
      doc: mockDoc,
      forcedPages: 0.5,
      precisePagesFallback: 0.5,
      timingSystem: 'page',
      genreCoefficient: 1.0,
    })

    expect(result.scenes.length).toBe(1)
    const scene = result.scenes[0]
    expect(scene.number).toBe('2')
    expect(scene.type).toBe('ЭКСТ')
    expect(scene.location).toBe('ОФИС')
    expect(scene.time).toBe('НОЧЬ')
  })

  it('should parse PAV (pavilion) type', () => {
    const nodes = [
      { type: { name: 'sceneHeader' }, textContent: '3. ПАВ. Студия A — УТРО' },
    ]

    const mockDoc = {
      forEach: (callback: (node: PMNode, index: number) => void) => {
        nodes.forEach((n, i) => callback(n as unknown as PMNode, i))
      }
    } as unknown as PMNode

    const result = extractScenesFromDocument({
      doc: mockDoc,
      forcedPages: 0.5,
      precisePagesFallback: 0.5,
      timingSystem: 'page',
      genreCoefficient: 1.0,
    })

    expect(result.scenes.length).toBe(1)
    const scene = result.scenes[0]
    expect(scene.type).toBe('ПАВ')
    expect(scene.location).toBe('СТУДИЯ A')
    expect(scene.time).toBe('УТРО')
  })

  it('should parse FilmToolz НАТ. as ЭКСТ', () => {
    const nodes = [
      { type: { name: 'sceneHeader' }, textContent: '4. НАТ. Улица Ленина — НОЧЬ' },
    ]

    const mockDoc = {
      forEach: (callback: (node: PMNode, index: number) => void) => {
        nodes.forEach((n, i) => callback(n as unknown as PMNode, i))
      }
    } as unknown as PMNode

    const result = extractScenesFromDocument({
      doc: mockDoc,
      forcedPages: 0.5,
      precisePagesFallback: 0.5,
      timingSystem: 'page',
      genreCoefficient: 1.0,
    })

    expect(result.scenes[0].type).toBe('ЭКСТ')
    expect(result.scenes[0].location).toBe('УЛИЦА ЛЕНИНА')
  })

  it('should split dot-notation location into location and sublocation', () => {
    const nodes = [
      { type: { name: 'sceneHeader' }, textContent: '5. ИНТ. Школа.Кабинет директора — ДЕНЬ' },
    ]

    const mockDoc = {
      forEach: (callback: (node: PMNode, index: number) => void) => {
        nodes.forEach((n, i) => callback(n as unknown as PMNode, i))
      }
    } as unknown as PMNode

    const result = extractScenesFromDocument({
      doc: mockDoc,
      forcedPages: 0.5,
      precisePagesFallback: 0.5,
      timingSystem: 'page',
      genreCoefficient: 1.0,
    })

    const scene = result.scenes[0]
    expect(scene.location).toBe('ШКОЛА')
    expect(scene.sublocation).toBe('КАБИНЕТ ДИРЕКТОРА')
  })

  it('should parse manual timing (мм:сс) from header', () => {
    const nodes = [
      { type: { name: 'sceneHeader' }, textContent: '6. ИНТ. КВАРТИРА — ДЕНЬ (01:30)' },
      { type: { name: 'sceneAction' }, textContent: 'Действие.' },
    ]

    const mockDoc = {
      forEach: (callback: (node: PMNode, index: number) => void) => {
        nodes.forEach((n, i) => callback(n as unknown as PMNode, i))
      }
    } as unknown as PMNode

    const result = extractScenesFromDocument({
      doc: mockDoc,
      forcedPages: 0.5,
      precisePagesFallback: 0.5,
      timingSystem: 'page',
      genreCoefficient: 1.0,
    })

    const scene = result.scenes[0]
    expect(scene.manualDuration).toBe(90) // 1 min 30 sec = 90 seconds
    expect(scene.duration).toBe(90) // should use manualDuration
  })
})

// === B9: усиление тонких мест ===
describe('B9 — идентичность и краевые случаи', () => {
  const makeDoc = (nodes: Array<{ type: string; text: string; sceneId?: string }>) => ({
    forEach: (cb: (node: PMNode, index: number) => void) => {
      nodes.forEach((n, i) => cb({
        type: { name: n.type },
        textContent: n.text,
        attrs: n.sceneId ? { sceneId: n.sceneId } : {},
      } as unknown as PMNode, i))
    }
  }) as unknown as PMNode

  const opts = { precisePagesFallback: 0, timingSystem: 'page' as const, genreCoefficient: 1.0 }

  it('UUID стабилен при перенумерации: тот же sceneId → тот же id', () => {
    const header = { type: 'sceneHeader', text: '1. ИНТ. КВАРТИРА — ДЕНЬ', sceneId: 'uuid-abc' }
    const before = extractScenesFromDocument({ ...opts, doc: makeDoc([header]) })
    const renumbered = extractScenesFromDocument({
      ...opts,
      doc: makeDoc([{ ...header, text: '5-1. ИНТ. КВАРТИРА — ДЕНЬ' }]),
    })
    expect(before.scenes[0].id).toBe('uuid-abc')
    expect(renumbered.scenes[0].id).toBe('uuid-abc') // id не изменился
    expect(renumbered.scenes[0].number).toBe('5-1') // номер изменился
  })

  it('дубли номеров → разные id (разные sceneId)', () => {
    const doc = makeDoc([
      { type: 'sceneHeader', text: '1. ИНТ. ДОМ — ДЕНЬ', sceneId: 'uuid-1' },
      { type: 'sceneAction', text: 'Первая сцена.' },
      { type: 'sceneHeader', text: '1. ЭКСТ. ДВОР — НОЧЬ', sceneId: 'uuid-2' },
      { type: 'sceneAction', text: 'Вторая сцена с тем же номером.' },
    ])
    const result = extractScenesFromDocument({ ...opts, doc })
    expect(result.scenes.length).toBe(2)
    expect(result.scenes[0].id).not.toBe(result.scenes[1].id)
    expect(result.scenes[0].number).toBe('1')
    expect(result.scenes[1].number).toBe('1')
  })

  it('нераспарсенная шапка не становится сценой и не сдвигает остальные', () => {
    const doc = makeDoc([
      { type: 'sceneHeader', text: '1. ИНТ. ДОМ — ДЕНЬ' },
      { type: 'sceneAction', text: 'Сцена один.' },
      { type: 'sceneHeader', text: 'ПРОСТО ТЕКСТ БЕЗ НОМЕРА' }, // не парсится
      { type: 'sceneHeader', text: '2. ЭКСТ. УЛИЦА — НОЧЬ' },
      { type: 'sceneAction', text: 'Сцена два.' },
    ])
    const result = extractScenesFromDocument({ ...opts, doc })
    expect(result.scenes.length).toBe(2) // не 3
    expect(result.scenes.map(s => s.number)).toEqual(['1', '2']) // порядок сохранён
  })

  it('«ИВАН (З/К)» из диалога нормализуется в ИВАН', () => {
    const doc = makeDoc([
      { type: 'sceneHeader', text: '1. ИНТ. КВАРТИРА — ДЕНЬ' },
      { type: 'sceneCharacter', text: 'ИВАН (З/К)' },
      { type: 'sceneDialog', text: 'Привет!' },
    ])
    const result = extractScenesFromDocument({ ...opts, doc })
    expect(result.scenes[0].dialogCharacters).toEqual(['ИВАН'])
    expect(result.scenes[0].cast).toEqual(['ИВАН'])
  })

  it('(продолжает) и (за кадром) тоже срезаются из имени', () => {
    const doc = makeDoc([
      { type: 'sceneHeader', text: '1. ИНТ. КВАРТИРА — ДЕНЬ' },
      { type: 'sceneCharacter', text: 'МАША (продолжает)' },
      { type: 'sceneDialog', text: 'Текст.' },
      { type: 'sceneCharacter', text: 'ПЕТЯ (за кадром)' },
      { type: 'sceneDialog', text: 'Ещё текст.' },
    ])
    const result = extractScenesFromDocument({ ...opts, doc })
    expect(result.scenes[0].dialogCharacters).toEqual(['МАША', 'ПЕТЯ'])
  })

  it('сумма pages сцен ≈ заданному total при распределении', () => {
    const doc = makeDoc([
      { type: 'sceneHeader', text: '1. ИНТ. ДОМ — ДЕНЬ' },
      { type: 'sceneAction', text: 'А'.repeat(400) },
      { type: 'sceneHeader', text: '2. ЭКСТ. УЛИЦА — НОЧЬ' },
      { type: 'sceneAction', text: 'Б'.repeat(400) },
    ])
    const total = 3.0
    const result = extractScenesFromDocument({ ...opts, doc, forcedPages: total })
    const sum = result.scenes.reduce((s, x) => s + x.pages, 0)
    expect(Math.abs(sum - total)).toBeLessThan(0.5) // округление до 0.1 даёт допуск
    expect(result.scenes.length).toBe(2)
  })

  it('manualDuration имеет приоритет над расчётным хронометражом', () => {
    const doc = makeDoc([
      { type: 'sceneHeader', text: '1. ИНТ. ДОМ — ДЕНЬ (00:45)' },
      { type: 'sceneAction', text: 'Очень длинное действие '.repeat(50) },
    ])
    const result = extractScenesFromDocument({ ...opts, doc, forcedPages: 2.0 })
    expect(result.scenes[0].manualDuration).toBe(45)
    expect(result.scenes[0].duration).toBe(45) // не расчётное от 2 страниц
  })
})
