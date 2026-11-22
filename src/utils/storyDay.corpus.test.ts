// T-227: корпус реальных шапок из сценариев — ЧАСТЬ 1 (зона дня + приоритет flash).
import { describe, it, expect } from 'vitest'
import { parseHeaderTail, SCENE_HEADER_RE } from './storyDay'
import { extractScenesFromDocument } from './sceneExtractor'
import type { Node as PMNode } from '@tiptap/pm/model'

const mkDoc = (headers: string[]) => {
  const nodes = headers.map((h) => ({
    type: { name: 'sceneHeader' },
    textContent: h,
    attrs: {},
  }))
  return {
    forEach: (cb: (n: PMNode, i: number) => void) =>
      nodes.forEach((n, i) => cb(n as unknown as PMNode, i)),
  } as unknown as PMNode
}

/** Шапка → (number, type, tail) через общий regex; tail → parseHeaderTail. */
const parse = (header: string) => {
  const m = header.match(SCENE_HEADER_RE)
  expect(m, `шапка не распознана: ${header}`).toBeTruthy()
  return { number: m![1], type: m![2], tail: parseHeaderTail(m![3], m![1]) }
}

describe('корпус реальных шапок — ЧАСТЬ 1', () => {
  it('1: «УЛИЦЫ… ДЕНЬ 32. ОСИНА, ДИМКА (02:08)» — чистый день + состав + тайминг', () => {
    const p = parse('14-1. НАТ. УЛИЦЫ ВЕРОНОВО.У СПОРТИВНОЙ ПЛОЩАДКИ. ДЕНЬ 32.    ОСИНА, ДИМКА (02:08)')
    expect(p.tail.mode).toBe('ДЕНЬ')
    expect(p.tail.day).toEqual({ kind: 'normal', value: 32, raw: '32' })
    expect(p.tail.issues).toEqual([])
    expect(p.tail.timingSec).toBe(128)
    expect(p.tail.tail).toContain('ОСИНА')
  })

  it('2: «ДЕЖУРКА. 32 РОМА, КУРЬЕР(14 СЕРИЯ ГР) (00:15)» — день без режима; «14» в скобках НЕ день', () => {
    const p = parse('14-52. ИНТ. ПОЛИЦИЯ.ДЕЖУРКА. 32   РОМА,  КУРЬЕР(14 СЕРИЯ ГР)  (00:15)')
    expect(p.tail.day).toEqual({ kind: 'normal', value: 32, raw: '32' })
    expect(p.tail.issues.map((i) => i.code)).toEqual(['day-without-mode'])
    expect(p.tail.timingSec).toBe(15)
  })

  it('4: «14-65-ФБ. … НОЧЬ 32 33» — flash приоритетнее double-day', () => {
    const p = parse('14-65-ФБ. НАТ. ВЕРОНОВО.ЛЕС. НОЧЬ   32   33 .')
    expect(p.tail.mode).toBe('НОЧЬ')
    expect(p.tail.day?.kind).toBe('special')
    expect(p.tail.day?.raw).toBe('ФБ')
    expect(p.tail.issues).toEqual([])
  })

  it('5: «14-16-ФБ. … ДЕНЬ 0» — спец-день 0 + маркер ФБ', () => {
    const p = parse('14-16-ФБ. ИНТ. ФИТНЕС-КЛУБ.КАЧАЛКА. ДЕНЬ 0.')
    expect(p.tail.day?.kind).toBe('special')
    expect(p.tail.day?.raw).toBe('ФБ')
    expect(p.tail.mode).toBe('ДЕНЬ')
  })

  it('12: «ДЕНЬ Х» — спец-день Х', () => {
    const p = parse('1-6-2.  ИНТ .  КВАРТИРА НИКИТЫ .  ДЕНЬ Х .')
    expect(p.tail.day).toEqual({ kind: 'special', value: null, raw: 'Х' })
  })

  it('13: «ДЕНЬ . ФЛЕШБЕК» — маркер в тексте, без missing-day', () => {
    const p = parse('1-23.  ИНТ .  КАФЕДРА ДИЗАЙНА .  ДЕНЬ .  ФЛЕШБЕК')
    expect(p.tail.mode).toBe('ДЕНЬ')
    expect(p.tail.day?.kind).toBe('special')
    expect(p.tail.day?.raw).toBe('ФЛЕШБЕК')
    expect(p.tail.issues).toEqual([])
  })

  it('14: «…(00:00) УДАЛЕНА» — omitted, без issue', () => {
    const p = parse('1-8-А. НАТ. У ШТАБА НАВОВ. ДЕНЬ 1.     (00:00)   УДАЛЕНА')
    expect(p.tail.omitted).toBe(true)
  })

  it('15: «…АРТЕФАКТОМ. 4 МАРИЯ… УДАЛЕНА» — omitted + голое 4', () => {
    const p = parse('1-54. ИНТ. ШТАБ НАВОВ.У ЗАЛА С АРТЕФАКТОМ. 4   МАРИЯ, ОРТЕГА, САНТЬЯГА (00:10)   УДАЛЕНА')
    expect(p.tail.omitted).toBe(true)
    expect(p.tail.day?.value).toBe(4)
  })

  it('16: «ШКОЛА 25. ДЕНЬ 32» — 25 локация, только день 32', () => {
    const p = parseHeaderTail('ИНТ. ШКОЛА 25. ДЕНЬ 32', 'x')
    expect(p.day?.value).toBe(32)
    expect(p.issues).toEqual([])
  })

  it('17: дубль номера «1-13.» — две сцены, разные id, без краша', () => {
    const doc = mkDoc(['1-13. ИНТ. ДОМ — ДЕНЬ 1', '1-13. ИНТ. ДОМ — ДЕНЬ 1'])
    const { scenes } = extractScenesFromDocument({ doc, forcedPages: 1, precisePagesFallback: 1, timingSystem: 'page', genreCoefficient: 1 })
    expect(scenes.length).toBe(2)
    expect(scenes[0].id).not.toBe(scenes[1].id)
    expect(scenes[0].storyDay?.value).toBe(1)
    expect(scenes[1].storyDay?.value).toBe(1)
  })

  it('18: «1-20-1. … ВЕЧЕР 2» — чистый день', () => {
    const p = parse('1-20-1.  НАТ .  УЛИЦЫ ГОРОДА .  САЛОН МАШИНЫ НИКИТЫ .  ВЕЧЕР  2.')
    expect(p.tail.mode).toBe('ВЕЧЕР')
    expect(p.tail.day?.value).toBe(2)
    expect(p.tail.issues).toEqual([])
  })
})
