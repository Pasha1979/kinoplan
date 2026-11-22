// ─── Сценарные дни (storyDay) — спека _ai_workspace/v4/08_СЦЕНАРНЫЕ_ДНИ.md ───
// Три сущности: time (строка автора), mode (нормализованный режим), storyDay.
// shootDayNumber — отдельное съёмочное поле, здесь НЕ участвует.

export type StoryDayKind = 'normal' | 'special'

export interface StoryDay {
  kind: StoryDayKind
  /** normal: ≥1; special: 0 | отрицательное | null (Х/ФБ/ФФ) */
  value: number | null
  /** «сырое» написание автора: «32», «−3», «Х», «ФЛЕШБЕК», «ФБ» */
  raw: string
}

/** Нормализованные режимы времени суток (RU + EN). */
export const DAY_MODE_WORDS = [
  'УТРО', 'ДЕНЬ', 'ВЕЧЕР', 'НОЧЬ', 'РАССВЕТ', 'ЗАКАТ',
  'MORNING', 'DAY', 'EVENING', 'NIGHT', 'DAWN', 'DUSK',
] as const

/** Режимы «конца дня»: переход с них на утренние = новый день. */
const NIGHTISH = new Set(['ВЕЧЕР', 'НОЧЬ', 'ЗАКАТ', 'EVENING', 'NIGHT', 'DUSK'])
/** Утренние режимы: начало нового дня после вечернего/ночного. */
const MORNISH = new Set(['РАССВЕТ', 'УТРО', 'ДЕНЬ', 'DAWN', 'MORNING', 'DAY'])

const MODE_SRC = DAY_MODE_WORDS.join('|')
const MODE_G = new RegExp(`(?<![А-ЯЁа-яёA-Za-z0-9])(${MODE_SRC})(?![А-ЯЁа-яёA-Za-z0-9])`, 'gi')
const NUM_G = /(?<![0-9A-Za-zА-Яа-яЁё])[+\-−]?[0-9]+(?![0-9A-Za-zА-Яа-яЁё])/g
const XDAY_G = /(?<![А-ЯЁа-яёA-Za-z0-9])[ХХXx](?![А-ЯЁа-яёA-Za-z0-9])/g
const FLASH_G = /(?<![А-ЯЁа-яёA-Za-z])(ФЛЕШФОРВАРД|ФЛЕШБЕК|FLASHFORWARD|FLASHBACK|ФФ|ФБ|FF|FB)(?![А-ЯЁа-яёA-Za-z])/gi
const OMITTED_RE = /(?:^|[\s.,(])УДАЛ[ЕЁ]НА\.?\s*$/i
const TIMING_END_RE = /\((\d{1,2}):(\d{2})\)\s*$/
/** ФБ/ФФ-суффикс в номере сцены: «14-16-ФБ». */
const FLASH_NUMBER_RE = /-(ФБ|ФФ|FB|FF)\s*(?:\([^)]*\))?$/i

// Общий regex шапки сцены — единый источник для экстрактора и валидатора
import { SCENE_NUMBER } from './sceneNumber'
export const SCENE_TYPE_TOKEN = 'ИНТ-ЭКСТ\\.?|ИНТ-НАТ\\.?|ИНТ\\.?|ЭКСТ\\.?|ПАВ\\.?|НАТ\\/ИНТ\\.?|ИНТ\\/НАТ\\.?|НАТ\\.?'
export const SCENE_HEADER_RE = new RegExp(`^(${SCENE_NUMBER})\\.\\s*(${SCENE_TYPE_TOKEN})\\s+(.+)$`, 'i')

export interface ModeToken { word: string; start: number; end: number }
export interface DayToken { raw: string; start: number; end: number; value: number | null; kind: StoryDayKind }

export type StoryDayIssueCode =
  | 'double-mode'       // два режима: «НОЧЬ ДЕНЬ 32» — ошибка + выбор фикса
  | 'double-day'        // два дня: «НОЧЬ 32 33» — ошибка + выбор фикса
  | 'day-without-mode'  // день без режима: «…ДЕЖУРКА. 32» — мягкое предупреждение
  | 'missing-day'       // режим есть, дня нет — мягкое предупреждение

export interface StoryDayIssue {
  code: StoryDayIssueCode
  /** варианты для «оставить один» (индексы токенов) */
  options?: string[]
}

export interface TimeSlotParse {
  /** первый (очищенный) режим, '' если не найден */
  mode: string
  modes: ModeToken[]
  /** собранный storyDay или null */
  day: StoryDay | null
  dayTokens: DayToken[]
  /** флешбек/форвард: нормализованный маркер ФБ/ФФ + исходное написание */
  flash: { marker: 'ФБ' | 'ФФ'; raw: string; start: number; end: number } | null
  /** сцена помечена УДАЛЕНА */
  omitted: boolean
  /** конец «зоны дня» в исходной строке: дальше — состав/хвост */
  zoneEnd: number
  /** состав/прочий текст после токенов режима/дня */
  tail: string
  /** нормализованное отображение: «ДЕНЬ 32», «НОЧЬ 32 33», «ДЕНЬ ФЛЕШБЕК» */
  cleanTime: string
  issues: StoryDayIssue[]
}

function mkNumToken(raw: string, start: number, end: number): DayToken {
  const norm = raw.replace('−', '-')
  const value = parseInt(norm, 10)
  const special = value === 0 || /^[+\-−]/.test(raw)
  return { raw, start, end, value, kind: special ? 'special' : 'normal' }
}

/** Парсит «временной слот» шапки: режим(ы), день(и), флеш-маркер, хвост. */
export function parseTimeSlot(slot: string, sceneNumber?: string): TimeSlotParse {
  let text = slot
  let omitted = false
  const om = text.match(OMITTED_RE)
  if (om) { omitted = true; text = text.slice(0, text.length - om[0].trimEnd().length).replace(/[\s.,(]+$/, '') }

  // Флеш-маркер из номера сцены («14-16-ФБ»)
  let flash: TimeSlotParse['flash'] = null
  if (sceneNumber) {
    const fm = sceneNumber.match(FLASH_NUMBER_RE)
    if (fm) flash = { marker: /^ФФ|FF$/i.test(fm[1]) ? 'ФФ' : 'ФБ', raw: fm[1].toUpperCase(), start: -1, end: -1 }
  }

  const modes: ModeToken[] = []
  const dayTokens: DayToken[] = []
  const consumed: Array<{ start: number; end: number }> = []
  let m: RegExpExecArray | null

  MODE_G.lastIndex = 0
  while ((m = MODE_G.exec(text))) {
    modes.push({ word: m[1].toUpperCase(), start: m.index, end: m.index + m[0].length })
    consumed.push({ start: m.index, end: m.index + m[0].length })
  }
  NUM_G.lastIndex = 0
  while ((m = NUM_G.exec(text))) {
    // не считать числом дня число внутри режима/флеша (пересечений не будет — слова не цифры)
    dayTokens.push(mkNumToken(m[0], m.index, m.index + m[0].length))
    consumed.push({ start: m.index, end: m.index + m[0].length })
  }
  XDAY_G.lastIndex = 0
  while ((m = XDAY_G.exec(text))) {
    dayTokens.push({ raw: m[0].toUpperCase() === 'X' ? 'Х' : m[0], start: m.index, end: m.index + m[0].length, value: null, kind: 'special' })
    consumed.push({ start: m.index, end: m.index + m[0].length })
  }
  FLASH_G.lastIndex = 0
  while ((m = FLASH_G.exec(text))) {
    let fs = m.index, fe = m.index + m[0].length, raw = m[1]
    // «(ФЛЕШБЕК)» — сохранить скобки в raw
    if (text[fs - 1] === '(' && text[fe] === ')') { fs -= 1; fe += 1; raw = `(${raw})` }
    const marker = /^(ФФ|ФЛЕШФОРВАРД|FF|FLASHFORWARD)$/i.test(m[1]) ? 'ФФ' : 'ФБ'
    flash = { marker, raw, start: fs, end: fe }
    consumed.push({ start: fs, end: fe })
  }

  dayTokens.sort((a, b) => a.start - b.start)
  modes.sort((a, b) => a.start - b.start)
  const zoneEnd = consumed.length ? Math.max(...consumed.map(c => c.end)) : 0
  const tail = text.slice(zoneEnd).replace(/^[\s.,;]+/, '')

  // День: флеш-маркер приоритетнее числа; иначе первый числовой/Х токен
  let day: StoryDay | null = null
  if (flash) day = { kind: 'special', value: null, raw: flash.raw }
  else if (dayTokens.length) {
    const t = dayTokens[0]
    day = { kind: t.kind, value: t.value, raw: t.raw }
  }

  const issues: StoryDayIssue[] = []
  if (modes.length > 1) issues.push({ code: 'double-mode', options: modes.map(mm => mm.word) })
  if (dayTokens.length > 1) issues.push({ code: 'double-day', options: dayTokens.map(d => d.raw) })
  if (!modes.length && dayTokens.length) issues.push({ code: 'day-without-mode' })
  if (modes.length && !day) issues.push({ code: 'missing-day' })

  const cleanTime = text.slice(0, zoneEnd).trim().replace(/[.,;]+$/, '')

  return { mode: modes[0]?.word ?? '', modes, day, dayTokens, flash, omitted, zoneEnd, tail, cleanTime, issues }
}

export interface HeaderTailParse extends TimeSlotParse {
  location: string
  /** индекс начала временного слота в исходной строке */
  zoneStart: number
  /** сам временной слот как подстрока исходного текста */
  slotText: string
  /** срезанный с конца хвост (тайминг (мм:сс), УДАЛЕНА) — вернуть при автофиксе */
  suffix: string
  /** ручной хронометраж из (мм:сс) в секундах */
  timingSec?: number
}

/**
 * Разбирает «хвост» шапки (всё после типа ИНТ./НАТ.…): локация + временной слот.
 * Понимает грязные шапки: «— ДЕНЬ 32», «ДЕНЬ 32. СОСТАВ», «…ДЕЖУРКА. 32 РОМА, КУРЬЕР».
 */
export function parseHeaderTail(text: string, sceneNumber?: string): HeaderTailParse {
  let omitted = false
  let body = text
  const om = body.match(OMITTED_RE)
  if (om) { omitted = true; body = body.slice(0, body.length - om[0].trimEnd().length).replace(/[\s.,(]+$/, '') }
  let timingSec: number | undefined
  const tm = body.match(TIMING_END_RE)
  if (tm) {
    timingSec = parseInt(tm[1], 10) * 60 + parseInt(tm[2], 10)
    body = body.slice(0, body.length - tm[0].length)
  }
  body = body.trim()
  const suffix = text.slice(body.length)

  // 1) Тире/дефис-разделитель: «ЛОКАЦИЯ — ДЕНЬ 32»
  const dashParts = body.split(/\s*[—–]\s*|\s+-\s+/)
  if (dashParts.length >= 2) {
    const slotIdx = body.lastIndexOf(dashParts[dashParts.length - 1])
    const p = parseTimeSlot(body.slice(slotIdx), sceneNumber)
    return { ...p, omitted: omitted || p.omitted, location: dashParts[0].replace(/[\s.,;]+$/, '').trim(), zoneStart: slotIdx, slotText: body.slice(slotIdx), suffix, timingSec }
  }

  // 2) Первое слово-режим: «УЛИЦЫ…. ДЕНЬ 32. СОСТАВ»
  MODE_G.lastIndex = 0
  const mm = MODE_G.exec(body)
  if (mm) {
    const p = parseTimeSlot(body.slice(mm.index), sceneNumber)
    return { ...p, omitted: omitted || p.omitted, location: body.slice(0, mm.index).replace(/[\s.,;]+$/, '').trim(), zoneStart: mm.index, slotText: body.slice(mm.index), suffix, timingSec }
  }

  // 3) Голое число дня после точки: «…ДЕЖУРКА. 32 РОМА, КУРЬЕР»
  //    Принимаем только если за числом идёт ещё текст (состав) — иначе это часть локации.
  const bareRe = /(?:^|\.)\s*([+\-−]?[0-9]+|[ХХXx])(?=[\s.,]|$)/g
  let bm: RegExpExecArray | null
  while ((bm = bareRe.exec(body))) {
    const numStart = bm.index + bm[0].indexOf(bm[1])
    const after = body.slice(numStart + bm[1].length).replace(/^[\s.,;]+/, '')
    if (after) {
      const p = parseTimeSlot(body.slice(numStart), sceneNumber)
      return { ...p, omitted: omitted || p.omitted, location: body.slice(0, numStart).replace(/[.,;\s]+$/, '').trim(), zoneStart: numStart, slotText: body.slice(numStart), suffix, timingSec }
    }
  }

  // 4) Временного слота нет — всё локация (но УДАЛЕНА/флеш-номер всё ещё значимы)
  const p = parseTimeSlot('', sceneNumber)
  return { ...p, omitted, location: body.trim(), zoneStart: body.length, slotText: '', suffix, timingSec }
}

/** Токен дня для regex-переиспользования (smartFormat/переход к составу). */
export const DAY_TOKEN_SRC = '[+\\-−]?[0-9]+|[ХХXx]|ФЛЕШФОРВАРД|ФЛЕШБЕК|ФФ|ФБ|FLASHFORWARD|FLASHBACK|FF|FB'
export const MODE_SRC_ALL = DAY_MODE_WORDS.join('|')

/** Быстрые варианты дня для SmartType: тот же / следующий / флешбек / флешфорвард. */
export function dayChoices(
  mode: string,
  last: { mode: string; value: number } | null,
): string[] {
  const rec = suggestDayNumber(last, mode)
  return [String(rec), String(rec + 1), 'ФЛЕШБЕК', 'ФЛЕШФОРВАРД']
}

// ─── Правило границы дня ────────────────────────────────────────────────────

/** Новый обычный день: вечер/ночь прошлой сцены → утро/день текущей. */
export function isDayBoundary(prevMode: string, curMode: string): boolean {
  return NIGHTISH.has(prevMode.toUpperCase()) && MORNISH.has(curMode.toUpperCase())
}

/** Подсказка номера дня: НОЧЬ→УТРО/ДЕНЬ = следующий, иначе тот же; без прошлого = 1. */
export function suggestDayNumber(
  prev: { mode: string; value: number } | null,
  curMode: string,
): number {
  if (!prev) return 1
  if (isDayBoundary(prev.mode, curMode)) return prev.value + 1
  return prev.value
}

// ─── Автофиксы временного слота ──────────────────────────────────────────────

export type SlotFix =
  | { type: 'keep-mode'; index: number }
  | { type: 'keep-day'; index: number }
  | { type: 'add-mode'; mode: string }
  | { type: 'add-day'; day: number | string }

function collapse(zone: string): string {
  return zone.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').replace(/^[\s.,;]+|[\s.,;]+$/g, '')
}

/** Применяет фикс к временному слоту, возвращает новую строку слота (с хвостом). */
export function fixTimeSlot(slot: string, p: TimeSlotParse, fix: SlotFix): string {
  const zone = slot.slice(0, p.zoneEnd)
  const tail = slot.slice(p.zoneEnd).replace(/^[ \t]{2,}/, ' ')
  switch (fix.type) {
    case 'keep-mode': {
      const t = p.modes[1 - fix.index]
      return collapse(zone.slice(0, t.start) + zone.slice(t.end)) + tail
    }
    case 'keep-day': {
      const t = p.dayTokens[1 - fix.index]
      return collapse(zone.slice(0, t.start) + zone.slice(t.end)) + tail
    }
    case 'add-mode':
      return `${fix.mode} ${collapse(zone)}` + tail
    case 'add-day': {
      const anchor = p.modes.length ? p.modes[p.modes.length - 1].end : p.zoneEnd
      return collapse(zone.slice(0, anchor) + ` ${fix.day} ` + zone.slice(anchor)) + tail
    }
  }
}

/** T-227: включены ли сценарные дни для проекта.
 *  undefined → по умолчанию: serial/film — вкл, остальные — выкл. */
export function storyDaysEnabled(
  p: { type?: string; storyDays?: boolean } | null | undefined,
): boolean {
  if (p?.storyDays !== undefined) return p.storyDays
  return p?.type === 'serial' || p?.type === 'film'
}

/** Подпись бейджа сценарного дня для навигатора/карточек/каркаса.
 *  «Сырое» значение: ДЕНЬ 32, ДЕНЬ −3, ФЛЕШБЕК, ДЕНЬ Х. */
export function storyDayBadgeLabel(
  sc: { mode?: string; storyDay?: { raw: string } | null },
): string | null {
  const sd = sc.storyDay
  if (!sd) return null
  const mode = (sc.mode || '').trim().toUpperCase()
  if (mode && sd.raw.toUpperCase() !== mode) {
    // «ДЕНЬ 32» — режим + день; маркер без режима («ФЛЕШБЕК») — как есть
    return /^(ФЛЕШБЕК|ФЛЕШФОРВАРД|ФБ|ФФ|FLASHBACK|FLASHFORWARD|FB|FF)$/i.test(sd.raw)
      ? sd.raw.toUpperCase()
      : `${mode} ${sd.raw}`
  }
  return /^[0-9+-]|^[хx]/i.test(sd.raw) ? `ДЕНЬ ${sd.raw}` : sd.raw.toUpperCase()
}

// ─── Перенос и пересчёт дней (T-227 ЧАСТЬ 4) ────────────────────────────────

const MODE_RANK: Record<string, number> = {
  'РАССВЕТ': 0, 'УТРО': 1, 'ДЕНЬ': 2, 'ВЕЧЕР': 3, 'ЗАКАТ': 3, 'НОЧЬ': 4,
}
const rank = (m?: string) => MODE_RANK[(m || '').toUpperCase()] ?? 2
const RANK_MODES = ['РАССВЕТ', 'УТРО', 'ДЕНЬ', 'ВЕЧЕР', 'НОЧЬ']
const modesBetween = (a: number, b: number) => RANK_MODES.filter((m) => rank(m) >= a && rank(m) <= b)

export interface DayCtx { mode?: string; storyDay?: { kind: string; value: number | null; raw: string } | null }
export interface MoveAnalysis {
  fits: boolean
  /** варианты «привести к контексту»: режим + день */
  variants: { mode: string; day: number }[]
}

/** Анализ переноса сцены между prev/next (ближайшие сцены с обычным днём). */
export function analyzeSceneMove(moved: DayCtx, prev?: DayCtx | null, next?: DayCtx | null): MoveAnalysis {
  const md = moved.storyDay
  if (!md || md.kind !== 'normal' || md.value == null) return { fits: true, variants: [] }
  const pv = prev?.storyDay?.kind === 'normal' ? prev!.storyDay!.value : null
  const nv = next?.storyDay?.kind === 'normal' ? next!.storyDay!.value : null
  const pm = prev?.mode, nm = next?.mode, mm = moved.mode

  if (pv != null && nv != null) {
    if (pv === nv) {
      // внутри одного дня: день должен совпасть, режим — между prev и next
      if (md.value === pv && (!mm || (rank(pm) <= rank(mm) && rank(mm) <= rank(nm)))) {
        return { fits: true, variants: [] }
      }
      return { fits: false, variants: modesBetween(rank(pm), rank(nm)).map((mode) => ({ mode, day: pv })) }
    }
    if (pv < nv) {
      // на границе дней: конец prev-дня или начало next-дня
      const fitsPrev = md.value === pv && (!mm || rank(mm) >= rank(pm))
      const fitsNext = md.value === nv && (!mm || rank(mm) <= rank(nm))
      if (fitsPrev || fitsNext) return { fits: true, variants: [] }
      const variants = [
        ...modesBetween(rank(pm), 4).map((mode) => ({ mode, day: pv })),
        ...modesBetween(0, rank(nm)).map((mode) => ({ mode, day: nv })),
      ]
      return { fits: false, variants }
    }
  }
  if (pv != null && nv == null) {
    if (md.value === pv && (!mm || rank(mm) >= rank(pm))) return { fits: true, variants: [] }
    if (md.value > pv) return { fits: true, variants: [] } // дальше по хронологии — молча
    return { fits: false, variants: modesBetween(rank(pm), 4).map((mode) => ({ mode, day: pv })) }
  }
  if (pv == null && nv != null) {
    if (md.value === nv && (!mm || rank(mm) <= rank(nm))) return { fits: true, variants: [] }
    if (md.value < nv) return { fits: true, variants: [] }
    return { fits: false, variants: modesBetween(0, rank(nm)).map((mode) => ({ mode, day: nv })) }
  }
  return { fits: true, variants: [] }
}

export interface RenumberRow {
  sceneId: string
  number: string
  /** сырой день до (null — не было), станет после (null — спец/без дня, не трогаем) */
  from: string | null
  to: number | null
  missing: boolean // у сцены не было дня — токен не переписываем
}

/** План пересчёта по сезону: границы сохраняются, обычные дни → 1..N подряд. */
export function planDayRenumber(
  scenes: { id: string; number: string; mode?: string; storyDay?: { kind: string; value: number | null; raw: string } | null; isOmitted?: boolean }[],
): RenumberRow[] {
  const rows: RenumberRow[] = []
  let counter = 0
  let lastOrd: { mode: string; value: number } | null = null
  for (const sc of scenes) {
    if (sc.isOmitted) continue
    const sd = sc.storyDay
    if (!sd) {
      rows.push({ sceneId: sc.id, number: sc.number, from: null, to: counter || null, missing: true })
      continue
    }
    if (sd.kind !== 'normal' || sd.value == null) {
      rows.push({ sceneId: sc.id, number: sc.number, from: sd.raw, to: null, missing: false })
      continue
    }
    const boundary = !lastOrd || sd.value !== lastOrd.value
      || isDayBoundary(lastOrd.mode, sc.mode || '')
    if (boundary) counter++
    rows.push({ sceneId: sc.id, number: sc.number, from: sd.raw, to: counter, missing: false })
    lastOrd = { mode: sc.mode || '', value: sd.value }
  }
  return rows
}

/** Переписать слот «режим день» в хвосте шапки: новый режим+день.
 *  Если дня не было — вставляет после режима; режима нет — добавляет оба. */
export function rewriteHeaderDay(headerText: string, mode: string, day: number): string {
  // Тайминг (мм:сс) — не день: срезаем до парсинга, возвращаем в конец
  const tm = headerText.match(/\s*\(\d{1,2}:\d{2}(?::\d{2})?\)\s*\.?\s*$/)
  const timing = tm ? ` ${tm[0].trim()}` : ''
  const body = tm ? headerText.slice(0, headerText.length - tm[0].length) : headerText
  const dash = body.lastIndexOf(' — ')
  const head = dash >= 0 ? body.slice(0, dash) : body
  const slot = dash >= 0 ? body.slice(dash + 3) : body
  const p = parseTimeSlot(slot)
  const tail = slot.slice(p.zoneEnd).replace(/^[\s.,;]+|[\s.,;]+$/g, '')
  return `${head} — ${mode.toUpperCase()} ${day}.${tail ? ` ${tail}` : ''}${timing}`
}
