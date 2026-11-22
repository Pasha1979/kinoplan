import { describe, it, expect } from 'vitest'
import type { Node as PMNode } from '@tiptap/pm/model'
import {
  parseHeaderTail,
  parseTimeSlot,
  isDayBoundary,
  suggestDayNumber,
  fixTimeSlot,
  storyDaysEnabled,
  storyDayBadgeLabel,
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

// ─── ЧАСТЬ 2: автоформат / SmartType / RU↔EN ────────────────────────────────

import { splitMergedText, needsSplitting } from './smartFormat'
import { RU_TO_EN_REPLACEMENTS, EN_TO_RU_REPLACEMENTS } from './formatRules'
import { dayChoices } from './storyDay'

const applyAll = (s: string, rules: [RegExp, string][]) =>
  rules.reduce((acc, [re, rep]) => acc.replace(new RegExp(re.source, re.flags), rep), s)

describe('splitMergedText — день остаётся в шапке', () => {
  it('«ДЕНЬ 32. ОСИНА, ДИМКА» → состав уходит на новую строку, день в шапке', () => {
    const out = splitMergedText('14-1. НАТ. УЛИЦЫ. ДЕНЬ 32. ОСИНА, ДИМКА')
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean)
    expect(lines[0]).toContain('ДЕНЬ 32')
    expect(lines.some((l) => l === '32')).toBe(false) // «32» не режется в контент
    expect(lines.some((l) => l.includes('ОСИНА'))).toBe(true)
  })

  it('«ДЕНЬ 32» без контента — не делится', () => {
    expect(needsSplitting('14-1. НАТ. УЛИЦЫ. ДЕНЬ 32')).toBe(false)
    const out = splitMergedText('14-1. НАТ. УЛИЦЫ. ДЕНЬ 32')
    expect(out).toContain('ДЕНЬ 32')
  })

  it('«ДЕНЬ . ФЛЕШБЕК» — маркер не режется', () => {
    expect(needsSplitting('1-23. ИНТ. УЛИЦА. ДЕНЬ . ФЛЕШБЕК')).toBe(false)
  })

  it('«ДЕНЬ ИВАН» — имя после режима всё ещё делится', () => {
    const out = splitMergedText('1. ИНТ. КВАРТИРА. ДЕНЬ ИВАН')
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean)
    expect(lines[0]).toContain('ДЕНЬ')
    expect(lines[1]).toBe('ИВАН')
  })

  it('«ДЕНЬ 32 ОСИНА» — день + состав через пробел', () => {
    const out = splitMergedText('1. ИНТ. КВАРТИРА. ДЕНЬ 32 ОСИНА')
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean)
    expect(lines[0]).toContain('ДЕНЬ 32')
    expect(lines[1]).toBe('ОСИНА')
  })
})

describe('RU↔EN — режим переводится, день сохраняется', () => {
  it('«ДЕНЬ 32» → «DAY 32»; «НОЧЬ 1» → «НОЧЬ 1»', () => {
    expect(applyAll('ДЕНЬ 32', RU_TO_EN_REPLACEMENTS)).toBe('DAY 32')
    expect(applyAll('НОЧЬ 1', RU_TO_EN_REPLACEMENTS)).toBe('NIGHT 1')
    expect(applyAll('DAY 32', EN_TO_RU_REPLACEMENTS)).toBe('ДЕНЬ 32')
    expect(applyAll('NIGHT 1', EN_TO_RU_REPLACEMENTS)).toBe('НОЧЬ 1')
  })

  it('спец-маркеры: Х/ФЛЕШБЕК/ФБ/ФФ', () => {
    expect(applyAll('ДЕНЬ Х', RU_TO_EN_REPLACEMENTS)).toBe('DAY X')
    expect(applyAll('ДЕНЬ ФЛЕШБЕК', RU_TO_EN_REPLACEMENTS)).toBe('DAY FLASHBACK')
    expect(applyAll('ДЕНЬ ФБ', RU_TO_EN_REPLACEMENTS)).toBe('DAY FB')
    expect(applyAll('ДЕНЬ ФФ', RU_TO_EN_REPLACEMENTS)).toBe('DAY FF')
    expect(applyAll('DAY FLASHBACK', EN_TO_RU_REPLACEMENTS)).toBe('ДЕНЬ ФЛЕШБЕК')
    expect(applyAll('DAY FB', EN_TO_RU_REPLACEMENTS)).toBe('ДЕНЬ ФБ')
    expect(applyAll('DAY X', EN_TO_RU_REPLACEMENTS)).toBe('ДЕНЬ Х')
  })
})

describe('dayChoices — быстрые варианты SmartType', () => {
  it('НОЧЬ прошлого дня → УТРО: следующий; ДЕНЬ → НОЧЬ: тот же', () => {
    expect(dayChoices('УТРО', { mode: 'НОЧЬ', value: 5 })).toEqual(['6', '7', 'ФЛЕШБЕК', 'ФЛЕШФОРВАРД'])
    expect(dayChoices('НОЧЬ', { mode: 'ДЕНЬ', value: 5 })).toEqual(['5', '6', 'ФЛЕШБЕК', 'ФЛЕШФОРВАРД'])
    expect(dayChoices('ДЕНЬ', null)).toEqual(['1', '2', 'ФЛЕШБЕК', 'ФЛЕШФОРВАРД'])
  })
})

describe('storyDaysEnabled — переключатель', () => {
  it('по умолчанию: serial/film вкл, clip/ad/other выкл', () => {
    expect(storyDaysEnabled({ type: 'serial' })).toBe(true)
    expect(storyDaysEnabled({ type: 'film' })).toBe(true)
    expect(storyDaysEnabled({ type: 'clip' })).toBe(false)
    expect(storyDaysEnabled({ type: 'ad' })).toBe(false)
    expect(storyDaysEnabled(null)).toBe(false)
    expect(storyDaysEnabled(undefined)).toBe(false)
  })
  it('явный storyDays перекрывает дефолт типа', () => {
    expect(storyDaysEnabled({ type: 'serial', storyDays: false })).toBe(false)
    expect(storyDaysEnabled({ type: 'clip', storyDays: true })).toBe(true)
  })
})

describe('storyDayBadgeLabel — подпись бейджа', () => {
  it('режим + обычный день → «ДЕНЬ 32», «НОЧЬ 1»', () => {
    expect(storyDayBadgeLabel({ mode: 'ДЕНЬ', storyDay: { raw: '32' } })).toBe('ДЕНЬ 32')
    expect(storyDayBadgeLabel({ mode: 'НОЧЬ', storyDay: { raw: '1' } })).toBe('НОЧЬ 1')
  })
  it('день без режима → «ДЕНЬ 32»; маркер без режима → «ФЛЕШБЕК»', () => {
    expect(storyDayBadgeLabel({ storyDay: { raw: '32' } })).toBe('ДЕНЬ 32')
    expect(storyDayBadgeLabel({ storyDay: { raw: 'ФЛЕШБЕК' } })).toBe('ФЛЕШБЕК')
    expect(storyDayBadgeLabel({ storyDay: { raw: 'Х' } })).toBe('ДЕНЬ Х')
    expect(storyDayBadgeLabel({ storyDay: { raw: '-3' } })).toBe('ДЕНЬ -3')
  })
  it('маркер при режиме → только маркер; без storyDay → null', () => {
    expect(storyDayBadgeLabel({ mode: 'ДЕНЬ', storyDay: { raw: 'ФЛЕШБЕК' } })).toBe('ФЛЕШБЕК')
    expect(storyDayBadgeLabel({ mode: 'ДЕНЬ', storyDay: null })).toBeNull()
    expect(storyDayBadgeLabel({})).toBeNull()
  })
})

// ─── ЧАСТЬ 4: перенос и пересчёт ────────────────────────────────────────────
import { analyzeSceneMove, planDayRenumber, rewriteHeaderDay } from './storyDay'

const N = (v: number, raw = String(v)) => ({ kind: 'normal' as const, value: v, raw })
const S = (raw: string) => ({ kind: 'special' as const, value: null, raw })

describe('analyzeSceneMove — пример A', () => {
  // [1-5 ДЕНЬ 1 | 1-6 НОЧЬ 1] ← переносим 1-8 (ДЕНЬ 2)
  const prev = { mode: 'ДЕНЬ', storyDay: N(1) }
  const next = { mode: 'НОЧЬ', storyDay: N(1) }
  it('ДЕНЬ 2 между ДЕНЬ 1 и НОЧЬ 1 → конфликт, рекомендации день 1', () => {
    const a = analyzeSceneMove({ mode: 'ДЕНЬ', storyDay: N(2) }, prev, next)
    expect(a.fits).toBe(false)
    expect(a.variants).toEqual([
      { mode: 'ДЕНЬ', day: 1 },
      { mode: 'ВЕЧЕР', day: 1 },
      { mode: 'НОЧЬ', day: 1 },
    ])
  })
  it('ДЕНЬ 1 или ВЕЧЕР 1 на том же месте → молча', () => {
    expect(analyzeSceneMove({ mode: 'ДЕНЬ', storyDay: N(1) }, prev, next).fits).toBe(true)
    expect(analyzeSceneMove({ mode: 'ВЕЧЕР', storyDay: N(1) }, prev, next).fits).toBe(true)
  })
})

describe('analyzeSceneMove — пример B', () => {
  // [1-5 ВЕЧЕР 1 | 1-6 НОЧЬ 1] ← переносим 1-8 (УТРО 2)
  const prev = { mode: 'ВЕЧЕР', storyDay: N(1) }
  const next = { mode: 'НОЧЬ', storyDay: N(1) }
  it('УТРО 2 между ВЕЧЕР 1 и НОЧЬ 1 → конфликт, ВЕЧЕР/НОЧЬ 1', () => {
    const a = analyzeSceneMove({ mode: 'УТРО', storyDay: N(2) }, prev, next)
    expect(a.fits).toBe(false)
    expect(a.variants).toEqual([
      { mode: 'ВЕЧЕР', day: 1 },
      { mode: 'НОЧЬ', day: 1 },
    ])
  })
  it('спец-день и сцена без дня → всегда молча', () => {
    expect(analyzeSceneMove({ mode: 'ДЕНЬ', storyDay: S('ФЛЕШБЕК') }, prev, next).fits).toBe(true)
    expect(analyzeSceneMove({ mode: 'ДЕНЬ' }, prev, next).fits).toBe(true)
  })
  it('на границе дней: день соседа с подходящим режимом → молча', () => {
    // [НОЧЬ 1 | УТРО 2]: УТРО 2 вписывается в начало дня 2
    const p = { mode: 'НОЧЬ', storyDay: N(1) }
    const n = { mode: 'УТРО', storyDay: N(2) }
    expect(analyzeSceneMove({ mode: 'УТРО', storyDay: N(2) }, p, n).fits).toBe(true)
    expect(analyzeSceneMove({ mode: 'НОЧЬ', storyDay: N(1) }, p, n).fits).toBe(true)
    // ДЕНЬ 5 на границе → конфликт с вариантами обоих дней
    const a = analyzeSceneMove({ mode: 'ДЕНЬ', storyDay: N(5) }, p, n)
    expect(a.fits).toBe(false)
    expect(a.variants.some((v) => v.day === 1)).toBe(true)
    expect(a.variants.some((v) => v.day === 2)).toBe(true)
  })
})

describe('planDayRenumber — пересчёт по сезону', () => {
  it('дырки схлопываются 1..N, границы и спец сохраняются', () => {
    const scenes = [
      { id: 'a', number: '1-1', mode: 'ДЕНЬ', storyDay: N(5) },
      { id: 'b', number: '1-2', mode: 'НОЧЬ', storyDay: N(5) },
      { id: 'c', number: '1-3', mode: 'ДЕНЬ', storyDay: S('ФЛЕШБЕК') },
      { id: 'd', number: '1-4', mode: 'УТРО', storyDay: N(12) },
      { id: 'e', number: '1-5', mode: 'ДЕНЬ', storyDay: N(12) },
      { id: 'f', number: '1-6', mode: 'ДЕНЬ', storyDay: N(40) },
      { id: 'g', number: '1-7', mode: 'ДЕНЬ', isOmitted: true },
      { id: 'h', number: '1-8', mode: 'ДЕНЬ' },
    ]
    const rows = planDayRenumber(scenes)
    expect(rows.map((r) => r.to)).toEqual([1, 1, null, 2, 2, 3, 3])
    expect(rows.find((r) => r.sceneId === 'c')!.from).toBe('ФЛЕШБЕК')
    expect(rows.find((r) => r.sceneId === 'h')!.missing).toBe(true)
  })
  it('неявная граница: тот же день, но НОЧЬ→УТРО → новый', () => {
    const scenes = [
      { id: 'a', number: '1', mode: 'НОЧЬ', storyDay: N(1) },
      { id: 'b', number: '2', mode: 'УТРО', storyDay: N(1) },
      { id: 'c', number: '3', mode: 'ДЕНЬ', storyDay: N(1) },
    ]
    expect(planDayRenumber(scenes).map((r) => r.to)).toEqual([1, 2, 2])
  })
})

describe('rewriteHeaderDay — перепись токена в шапке', () => {
  it('режим+день меняются, хвост/тайминг целы', () => {
    expect(rewriteHeaderDay('14-1. НАТ. УЛИЦЫ — ДЕНЬ 32. ОСИНА, ДИМКА (02:08)', 'НОЧЬ', 1))
      .toBe('14-1. НАТ. УЛИЦЫ — НОЧЬ 1. ОСИНА, ДИМКА (02:08)')
  })
  it('дня не было → вставляется после режима', () => {
    expect(rewriteHeaderDay('1-3. ИНТ. ДОМ — НОЧЬ. ИВАН', 'НОЧЬ', 5))
      .toBe('1-3. ИНТ. ДОМ — НОЧЬ 5. ИВАН')
  })
  it('двойной режим/день схлопывается в канонический слот', () => {
    expect(rewriteHeaderDay('1-9. ИНТ. ДОМ — НОЧЬ ДЕНЬ 32 33.', 'ВЕЧЕР', 2))
      .toBe('1-9. ИНТ. ДОМ — ВЕЧЕР 2.')
  })
})
