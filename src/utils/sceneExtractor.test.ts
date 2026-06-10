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
    expect(scene.location).toBe('Студия A')
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
    expect(result.scenes[0].location).toBe('Улица Ленина')
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
    expect(scene.location).toBe('Школа')
    expect(scene.sublocation).toBe('Кабинет директора')
  })

  it('should parse manual timing (мм:сс) from header', () => {
    const nodes = [
      { type: { name: 'sceneHeader' }, textContent: '6. ИНТ. Квартира — ДЕНЬ (01:30)' },
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
