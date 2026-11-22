import { describe, it, expect } from 'vitest'
import type { Node as PMNode } from '@tiptap/pm/model'
import {
  parseHeaderTail,
  parseTimeSlot,
  isDayBoundary,
  suggestDayNumber,
  fixTimeSlot,
} from './storyDay'
import { extractScenesFromDocument } from './sceneExtractor'
import { validateFormatBlocks } from './formatValidation'

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

const extract = (headers: string[]) =>
  extractScenesFromDocument({
    doc: mkDoc(headers),
    forcedPages: 1.0,
    precisePagesFallback: 1.0,
    timingSystem: 'page',
    genreCoefficient: 1.0,
  }).scenes

// ─── parseTimeSlot — từng cụm "thời gian" ───────────────────────────────────

describe('parseTimeSlot', () => {
  it('«ДЕНЬ 32.  ОСИНА, ДИМКА» → режим ДЕНЬ, день 32, хвост состав', () => {
    const p = parseTimeSlot('ДЕНЬ 32.  ОСИНА, ДИМКА')
    expect(p.mode).toBe('ДЕНЬ')
    expect(p.day).toEqual({ kind: 'normal', value: 32, raw: '32' })
    expect(p.tail).toBe('ОСИНА, ДИМКА')
    expect(p.issues).toEqual([])
  })

  it('«НОЧЬ 32 33» → дубль дня (ошибка)', () => {
    const p = parseTimeSlot('НОЧЬ 32 33')
    expect(p.dayTokens.map((t) => t.raw)).toEqual(['32', '33'])
    expect(p.issues.map((i) => i.code)).toEqual(['double-day'])
  })

  it('«ДЕНЬ НОЧЬ 32» → дубль режима (ошибка), день 32 сохранён', () => {
    const p = parseTimeSlot('ДЕНЬ НОЧЬ 32')
    expect(p.modes.map((t) => t.word)).toEqual(['ДЕНЬ', 'НОЧЬ'])
    expect(p.day?.value).toBe(32)
    expect(p.issues.map((i) => i.code)).toEqual(['double-mode'])
  })

  it('«32 РОМА, КУРЬЕР» → день без режима (мягкое предупреждение)', () => {
    const p = parseTimeSlot('32 РОМА, КУРЬЕР')
    expect(p.mode).toBe('')
    expect(p.day).toEqual({ kind: 'normal', value: 32, raw: '32' })
    expect(p.tail).toBe('РОМА, КУРЬЕР')
    expect(p.issues.map((i) => i.code)).toEqual(['day-without-mode'])
  })

  it('«ДЕНЬ» (без дня) → missing-day', () => {
    const p = parseTimeSlot('ДЕНЬ')
    expect(p.day).toBeNull()
    expect(p.issues.map((i) => i.code)).toEqual(['missing-day'])
  })

  it.each([
    ['ДЕНЬ 0', { kind: 'special', value: 0, raw: '0' }],
    ['ДЕНЬ Х', { kind: 'special', value: null, raw: 'Х' }],
    ['ДЕНЬ −3', { kind: 'special', value: -3, raw: '−3' }],
    ['ДЕНЬ +7', { kind: 'special', value: 7, raw: '+7' }],
    ['ДЕНЬ ФЛЕШБЕК', { kind: 'special', value: null, raw: 'ФЛЕШБЕК' }],
    ['ДЕНЬ (ФЛЕШБЕК)', { kind: 'special', value: null, raw: '(ФЛЕШБЕК)' }],
  ])('%s → special-day %j', (slot, want) => {
    const p = parseTimeSlot(slot)
    expect(p.mode).toBe('ДЕНЬ')
    expect(p.day).toEqual(want)
    expect(p.issues).toEqual([])
  })

  it('ФБ/ФФ в номере сцены → special-day авто, не требует номера', () => {
    const fb = parseTimeSlot('НОЧЬ', '14-16-ФБ')
    expect(fb.day).toEqual({ kind: 'special', value: null, raw: 'ФБ' })
    expect(fb.issues).toEqual([]) // не missing-day
    const ff = parseTimeSlot('ДЕНЬ', '14-16-ФФ')
    expect(ff.day?.raw).toBe('ФФ')
  })

  it('УДАЛЕНА в конце → omitted, день не требуется', () => {
    const p = parseTimeSlot('(00:00) УДАЛЕНА')
    expect(p.omitted).toBe(true)
  })
})

// ─── parseHeaderTail — «грязные» шапки из спеки ─────────────────────────────

describe('parseHeaderTail — шапки спеки', () => {
  it('«УЛИЦЫ. ДЕНЬ 32.  ОСИНА, ДИМКА (02:08)»', () => {
    const p = parseHeaderTail('УЛИЦЫ. ДЕНЬ 32.  ОСИНА, ДИМКА (02:08)')
    expect(p.location).toBe('УЛИЦЫ')
    expect(p.mode).toBe('ДЕНЬ')
    expect(p.day?.value).toBe(32)
    expect(p.tail).toBe('ОСИНА, ДИМКА')
    expect(p.timingSec).toBe(128)
  })

  it('«ШКОЛА. ДЕЖУРКА. 32 РОМА, КУРЬЕР (00:15)» → день без режима', () => {
    const p = parseHeaderTail('ШКОЛА. ДЕЖУРКА. 32  РОМА, КУРЬЕР (00:15)')
    expect(p.location).toBe('ШКОЛА. ДЕЖУРКА')
    expect(p.mode).toBe('')
    expect(p.day?.value).toBe(32)
    expect(p.tail).toBe('РОМА, КУРЬЕР')
    expect(p.issues.map((i) => i.code)).toEqual(['day-without-mode'])
    expect(p.timingSec).toBe(15)
  })

  it('«УЛИЦА. (00:00) УДАЛЕНА» → omitted + timing', () => {
    const p = parseHeaderTail('УЛИЦА. (00:00) УДАЛЕНА')
    expect(p.omitted).toBe(true)
    expect(p.timingSec).toBe(0)
  })
})

// ─── Граница дня / подсказка номера ─────────────────────────────────────────

describe('граница дня', () => {
  it('НОЧЬ/ВЕЧЕР прошлого → УТРО/ДЕНЬ = новый день', () => {
    expect(isDayBoundary('НОЧЬ', 'УТРО')).toBe(true)
    expect(isDayBoundary('НОЧЬ', 'ДЕНЬ')).toBe(true)
    expect(isDayBoundary('ВЕЧЕР', 'УТРО')).toBe(true)
    expect(isDayBoundary('ДЕНЬ', 'НОЧЬ')).toBe(false)
    expect(isDayBoundary('ДЕНЬ', 'ВЕЧЕР')).toBe(false)
    expect(isDayBoundary('УТРО', 'ДЕНЬ')).toBe(false)
  })

  it('suggestDayNumber: ДЕНЬ→НОЧЬ = тот же; НОЧЬ→УТРО = +1; нет прошлого = 1', () => {
    expect(suggestDayNumber({ mode: 'ДЕНЬ', value: 5 }, 'НОЧЬ')).toBe(5)
    expect(suggestDayNumber({ mode: 'НОЧЬ', value: 5 }, 'УТРО')).toBe(6)
    expect(suggestDayNumber(null, 'ДЕНЬ')).toBe(1)
  })
})

// ─── fixTimeSlot ────────────────────────────────────────────────────────────

describe('fixTimeSlot', () => {
  it('keep-mode: «ДЕНЬ НОЧЬ 32» → «ДЕНЬ 32» или «НОЧЬ 32»', () => {
    const p = parseTimeSlot('ДЕНЬ НОЧЬ 32')
    expect(fixTimeSlot('ДЕНЬ НОЧЬ 32', p, { type: 'keep-mode', index: 0 })).toBe('ДЕНЬ 32')
    expect(fixTimeSlot('ДЕНЬ НОЧЬ 32', p, { type: 'keep-mode', index: 1 })).toBe('НОЧЬ 32')
  })

  it('keep-day: «НОЧЬ 32 33» → «НОЧЬ 32» или «НОЧЬ 33»', () => {
    const p = parseTimeSlot('НОЧЬ 32 33')
    expect(fixTimeSlot('НОЧЬ 32 33', p, { type: 'keep-day', index: 0 })).toBe('НОЧЬ 32')
    expect(fixTimeSlot('НОЧЬ 32 33', p, { type: 'keep-day', index: 1 })).toBe('НОЧЬ 33')
  })

  it('add-mode / add-day', () => {
    const p1 = parseTimeSlot('32 РОМА, КУРЬЕР')
    expect(fixTimeSlot('32 РОМА, КУРЬЕР', p1, { type: 'add-mode', mode: 'ВЕЧЕР' }))
      .toBe('ВЕЧЕР 32 РОМА, КУРЬЕР')
    const p2 = parseTimeSlot('НОЧЬ')
    expect(fixTimeSlot('НОЧЬ', p2, { type: 'add-day', day: 7 })).toBe('НОЧЬ 7')
  })
})

// ─── extractScenesFromDocument — все примеры шапок спеки ────────────────────

describe('extractor — примеры шапок из спеки', () => {
  it('«14-1. НАТ. УЛИЦЫ. ДЕНЬ 32.  ОСИНА, ДИМКА (02:08)»', () => {
    const [s] = extract(['14-1. НАТ. УЛИЦЫ. ДЕНЬ 32.  ОСИНА, ДИМКА (02:08)'])
    expect(s.number).toBe('14-1')
    expect(s.type).toBe('ЭКСТ')
    expect(s.location).toBe('УЛИЦЫ')
    expect(s.time).toBe('ДЕНЬ 32')
    expect(s.mode).toBe('ДЕНЬ')
    expect(s.storyDay).toEqual({ kind: 'normal', value: 32, raw: '32' })
    expect(s.cast).toEqual(['ОСИНА', 'ДИМКА'])
    expect(s.manualDuration).toBe(128)
  })

  it('«14-52. ИНТ. ШКОЛА. ДЕЖУРКА. 32  РОМА, КУРЬЕР (00:15)» — день без режима', () => {
    const [s] = extract(['14-52. ИНТ. ШКОЛА. ДЕЖУРКА. 32  РОМА, КУРЬЕР (00:15)'])
    expect(s.location).toBe('ШКОЛА')
    expect(s.sublocation).toBe('ДЕЖУРКА')
    expect(s.storyDay?.value).toBe(32)
    expect(s.mode).toBe('')
    expect(s.cast).toEqual(['РОМА', 'КУРЬЕР'])
    expect(s.manualDuration).toBe(15)
  })

  it('«14-65-ФБ. УЛИЦА. НОЧЬ 32 33 .» — ФБ-номер + дубль дня', () => {
    const [s] = extract(['14-65-ФБ. ИНТ. УЛИЦА. НОЧЬ 32 33 .'])
    expect(s.number).toBe('14-65-ФБ')
    expect(s.mode).toBe('НОЧЬ')
    expect(s.storyDay).toEqual({ kind: 'special', value: null, raw: 'ФБ' })
  })

  it('«14-16-ФБ. УЛИЦА. ДЕНЬ 0.» — ФБ-номер, день 0 special', () => {
    const [s] = extract(['14-16-ФБ. ИНТ. УЛИЦА. ДЕНЬ 0.'])
    expect(s.storyDay?.kind).toBe('special')
    expect(s.mode).toBe('ДЕНЬ')
  })

  it('«1-6-2. УЛИЦА. ДЕНЬ Х .» — день Х special', () => {
    const [s] = extract(['1-6-2. ИНТ. УЛИЦА. ДЕНЬ Х .'])
    expect(s.storyDay).toEqual({ kind: 'special', value: null, raw: 'Х' })
  })

  it('«1-23. УЛИЦА. ДЕНЬ . ФЛЕШБЕК» — флешбек в тексте', () => {
    const [s] = extract(['1-23. ИНТ. УЛИЦА. ДЕНЬ . ФЛЕШБЕК'])
    expect(s.mode).toBe('ДЕНЬ')
    expect(s.storyDay).toEqual({ kind: 'special', value: null, raw: 'ФЛЕШБЕК' })
  })

  it('«1.a. НАТ. УЛИЦА. ДЕНЬ 1.» — литерный номер', () => {
    const [s] = extract(['1.a. НАТ. УЛИЦА. ДЕНЬ 1.'])
    expect(s.number).toBe('1.a')
    expect(s.storyDay?.value).toBe(1)
  })

  it('«1-8-А. УЛИЦА. (00:00) УДАЛЕНА» — omitted', () => {
    const [s] = extract(['1-8-А. ИНТ. УЛИЦА. (00:00) УДАЛЕНА'])
    expect(s.number).toBe('1-8-А')
    expect(s.omitted).toBe(true)
  })

  it('дубль номера «1-13» — обе сцены извлекаются', () => {
    const scenes = extract(['1-13. ИНТ. КВАРТИРА — ДЕНЬ 1', '1-13. ИНТ. ОФИС — НОЧЬ 1'])
    expect(scenes.length).toBe(2)
    expect(scenes.map((s) => s.number)).toEqual(['1-13', '1-13'])
  })
})

// ─── validateFormatBlocks — правила валидации спеки ─────────────────────────

describe('validateFormatBlocks — сценарные дни', () => {
  const blk = (id: string, content: string) => ({ id, type: 'scene_header', content })

  it('двойной режим «ДЕНЬ НОЧЬ 32» → error + 2 варианта фикса', () => {
    const issues = validateFormatBlocks(
      [blk('h1', '14-29. ИНТ. УЛИЦА. ДЕНЬ НОЧЬ 32.')],
      'russian',
      { storyDays: true }
    )
    const e = issues.find((i) => i.id.endsWith('-dmode'))
    expect(e?.severity).toBe('error')
    expect(e?.suggestions).toEqual([
      '14-29. ИНТ. УЛИЦА. ДЕНЬ 32.',
      '14-29. ИНТ. УЛИЦА. НОЧЬ 32.',
    ])
  })

  it('два дня «НОЧЬ 32 33» → error + 2 варианта фикса', () => {
    const issues = validateFormatBlocks(
      [blk('h1', '14-65. ИНТ. УЛИЦА. НОЧЬ 32 33 .')],
      'russian',
      { storyDays: true }
    )
    const e = issues.find((i) => i.id.endsWith('-dday'))
    expect(e?.severity).toBe('error')
    expect(e?.suggestions).toEqual([
      '14-65. ИНТ. УЛИЦА. НОЧЬ 32 .',
      '14-65. ИНТ. УЛИЦА. НОЧЬ 33 .',
    ])
  })

  it('день без режима «…ДЕЖУРКА. 32» → warning + подсказка режима', () => {
    const issues = validateFormatBlocks(
      [blk('h1', '14-52. ИНТ. ШКОЛА. ДЕЖУРКА. 32  РОМА, КУРЬЕР (00:15)')],
      'russian',
      { storyDays: true }
    )
    const w = issues.find((i) => i.id.endsWith('-nomode'))
    expect(w?.severity).toBe('warning')
    expect(w?.suggestion).toBe('14-52. ИНТ. ШКОЛА. ДЕЖУРКА. ДЕНЬ 32 РОМА, КУРЬЕР (00:15)')
  })

  it('отсутствует день → мягкое предупреждение + подсказка по логике', () => {
    const issues = validateFormatBlocks(
      [
        blk('h1', '1-1. ИНТ. УЛИЦА. НОЧЬ 1'),
        blk('h2', '1-2. ИНТ. УЛИЦА. УТРО'),
      ],
      'russian',
      { storyDays: true }
    )
    const w = issues.find((i) => i.id === 'fmt-h2-noday')
    expect(w?.severity).toBe('warning')
    expect(w?.suggestion).toBe('1-2. ИНТ. УЛИЦА. УТРО 2') // НОЧЬ→УТРО = +1
  })

  it('шапка совсем без времени → warning «день обязателен»', () => {
    const issues = validateFormatBlocks(
      [blk('h1', '1-1. ИНТ. УЛИЦА')],
      'russian',
      { storyDays: true }
    )
    const w = issues.find((i) => i.id.endsWith('-noday'))
    expect(w?.severity).toBe('warning')
    expect(w?.suggestion).toBe('1-1. ИНТ. УЛИЦА — ДЕНЬ 1')
  })

  it('ФБ в номере не требует дня; УДАЛЕНА пропускается', () => {
    const issues = validateFormatBlocks(
      [
        blk('h1', '14-16-ФБ. ИНТ. УЛИЦА. ДЕНЬ 0.'),
        blk('h2', '1-8-А. ИНТ. УЛИЦА. (00:00) УДАЛЕНА'),
        blk('h3', '1-23. ИНТ. УЛИЦА. ДЕНЬ . ФЛЕШБЕК'),
      ],
      'russian',
      { storyDays: true }
    )
    expect(issues.filter((i) => /-dmode$|-dday$|-nomode$|-noday$/.test(i.id))).toEqual([])
  })

  it('storyDays=false → без проверок дней (legacy не спамим)', () => {
    const issues = validateFormatBlocks(
      [blk('h1', '1-1. ИНТ. УЛИЦА. ДЕНЬ')],
      'russian'
    )
    expect(issues.find((i) => i.id.endsWith('-noday'))).toBeUndefined()
  })
})
