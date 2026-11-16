import { describe, it, expect } from 'vitest'
import {
  wordBoundary,
  RU_TO_EN_REPLACEMENTS,
  EN_TO_RU_REPLACEMENTS,
  HEADER_RE,
  SCENE_HEADER_RE_RU,
  SCENE_HEADER_RE_EN,
  NON_CHARACTER_WORDS,
  LOCATION_SYNONYMS,
  TIME_WORDS,
} from './formatRules'

const applyAll = (text: string, rules: [RegExp, string][]) =>
  rules.reduce((acc, [re, to]) => acc.replace(re, to), text)

describe('formatRules: wordBoundary (кириллические границы)', () => {
  it('ловит слово после тире: «— ДЕНЬ»', () => {
    expect('ИНТ. ДОМ — ДЕНЬ'.match(wordBoundary('ДЕНЬ'))).toBeTruthy()
  })

  it('ловит слово перед точкой: «ДЕНЬ.»', () => {
    expect('…ЗАКАНЧИВАЕТСЯ ДЕНЬ. ДАЛЕЕ'.match(wordBoundary('ДЕНЬ'))).toBeTruthy()
  })

  it('НЕ ловит внутри слова: «ДЕНЬГИ»', () => {
    expect('ДЕНЬГИ'.match(wordBoundary('ДЕНЬ'))).toBeNull()
    expect('ВЗЯЛ ДЕНЬГИ С СТОЛА'.match(wordBoundary('ДЕНЬ'))).toBeNull()
  })

  it('НЕ ловит при кириллическом префиксе: «ПЕРЕДЕНЬ»', () => {
    expect('ПЕРЕДЕНЬ'.match(wordBoundary('ДЕНЬ'))).toBeNull()
  })

  it('регистронезависим: «день» тоже ловится', () => {
    expect('утро и день'.match(wordBoundary('ДЕНЬ'))).toBeTruthy()
  })

  it('ловит несколько вхождений (g-флаг)', () => {
    const matches = 'ДЕНЬ и снова ДЕНЬ'.match(wordBoundary('ДЕНЬ'))
    expect(matches).toHaveLength(2)
  })
})

describe('formatRules: конвертация RU → EN', () => {
  it('ИНТ → INT', () => {
    expect(applyAll('1. ИНТ. ДОМ — ДЕНЬ', RU_TO_EN_REPLACEMENTS)).toBe('1. INT. ДОМ - DAY')
  })

  it('ЭКСТ → EXT', () => {
    expect(applyAll('2. ЭКСТ. УЛИЦА — НОЧЬ', RU_TO_EN_REPLACEMENTS)).toBe('2. EXT. УЛИЦА - NIGHT')
  })

  it('ПАВ → PAV', () => {
    expect(applyAll('3. ПАВ. СТУДИЯ — ДЕНЬ', RU_TO_EN_REPLACEMENTS)).toBe('3. PAV. СТУДИЯ - DAY')
  })

  it('ДЕНЬ → DAY, НОЧЬ → NIGHT, УТРО → MORNING и др.', () => {
    expect(applyAll('УТРО', RU_TO_EN_REPLACEMENTS)).toBe('MORNING')
    expect(applyAll('ВЕЧЕР', RU_TO_EN_REPLACEMENTS)).toBe('EVENING')
    expect(applyAll('РАССВЕТ', RU_TO_EN_REPLACEMENTS)).toBe('DAWN')
    expect(applyAll('ЗАКАТ', RU_TO_EN_REPLACEMENTS)).toBe('DUSK')
  })

  it('ИНТ-ЭКСТ → INT/EXT', () => {
    expect(applyAll('5. ИНТ-ЭКСТ. МАШИНА — НОЧЬ', RU_TO_EN_REPLACEMENTS)).toBe('5. INT/EXT. МАШИНА - NIGHT')
  })

  it('«ДЕНЬГИ» в тексте действия НЕ превращается в «DAYГИ»', () => {
    expect(applyAll('Он взял ДЕНЬГИ и вышел. — ДЕНЬ', RU_TO_EN_REPLACEMENTS)).toBe('Он взял ДЕНЬГИ и вышел. - DAY')
  })
})

describe('formatRules: конвертация EN → RU', () => {
  it('INT → ИНТ', () => {
    expect(applyAll('1. INT. HOUSE - DAY', EN_TO_RU_REPLACEMENTS)).toBe('1. ИНТ. HOUSE — ДЕНЬ')
  })

  it('EXT → ЭКСТ', () => {
    expect(applyAll('2. EXT. STREET - NIGHT', EN_TO_RU_REPLACEMENTS)).toBe('2. ЭКСТ. STREET — НОЧЬ')
  })

  it('PAV → ПАВ', () => {
    expect(applyAll('3. PAV. STUDIO - DAY', EN_TO_RU_REPLACEMENTS)).toBe('3. ПАВ. STUDIO — ДЕНЬ')
  })

  it('DAY → ДЕНЬ, NIGHT → НОЧЬ, INT/EXT → ИНТ-ЭКСТ', () => {
    expect(applyAll('INT/EXT. CAR - NIGHT', EN_TO_RU_REPLACEMENTS)).toBe('ИНТ-ЭКСТ. CAR — НОЧЬ')
  })

  it('round-trip RU→EN→RU стабилен для токенов формата', () => {
    const src = '7. ЭКСТ. ПАРК — ДЕНЬ'
    const en = applyAll(src, RU_TO_EN_REPLACEMENTS)
    const back = applyAll(en, EN_TO_RU_REPLACEMENTS)
    expect(back).toBe(src)
  })
})

describe('formatRules: HEADER_RE', () => {
  it.each(['ИНТ.', 'ЭКСТ.', 'ПАВ.', 'НАТ.', 'ИНТ-ЭКСТ.'])('принимает %s', (tok) => {
    expect(HEADER_RE.test(`1. ${tok} ЛОКАЦИЯ`)).toBe(true)
  })

  it('принимает литерные номера: «1-8-А. ИНТ.»', () => {
    expect(HEADER_RE.test('1-8-А. ИНТ. ДОМ')).toBe(true)
    expect(HEADER_RE.test('1-8-A. ЭКСТ. ДВОР')).toBe(true)
  })

  it('принимает сериальные номера: «2-15.»', () => {
    expect(HEADER_RE.test('2-15. ИНТ. КВАРТИРА')).toBe(true)
  })

  it('принимает без номера', () => {
    expect(HEADER_RE.test('ИНТ. ДОМ — ДЕНЬ')).toBe(true)
  })

  it('регистронезависим', () => {
    expect(HEADER_RE.test('1. инт. дом')).toBe(true)
  })
})

describe('formatRules: SCENE_HEADER_RE_RU / _EN (анкорованные)', () => {
  it('валидная RU-шапка: «1. ЭКСТ. УЛИЦА — ДЕНЬ»', () => {
    expect(SCENE_HEADER_RE_RU.test('1. ЭКСТ. УЛИЦА — ДЕНЬ')).toBe(true)
  })

  it('валидная RU-шапка ПАВ/НАТ', () => {
    expect(SCENE_HEADER_RE_RU.test('2. ПАВ. СТУДИЯ — НОЧЬ')).toBe(true)
    expect(SCENE_HEADER_RE_RU.test('3. НАТ. ПОЛЕ — УТРО')).toBe(true)
  })

  it('RU-шапка ИНТ-ЭКСТ', () => {
    expect(SCENE_HEADER_RE_RU.test('4. ИНТ-ЭКСТ. МАШИНА — ДЕНЬ')).toBe(true)
  })

  it('отклоняет шапку без номера', () => {
    expect(SCENE_HEADER_RE_RU.test('ЭКСТ. УЛИЦА — ДЕНЬ')).toBe(false)
  })

  it('валидная EN-шапка', () => {
    expect(SCENE_HEADER_RE_EN.test('1. INT. HOUSE - DAY')).toBe(true)
    expect(SCENE_HEADER_RE_EN.test('2. EXT. STREET - NIGHT')).toBe(true)
  })

  it('EN-шапка INT./EXT и I/E', () => {
    expect(SCENE_HEADER_RE_EN.test('3. INT./EXT. CAR - DAY')).toBe(true)
    expect(SCENE_HEADER_RE_EN.test('4. I/E. CAR - DAY')).toBe(true)
  })
})

describe('formatRules: NON_CHARACTER_WORDS', () => {
  it('ВЗРЫВ — не персонаж', () => {
    expect(NON_CHARACTER_WORDS.has('ВЗРЫВ')).toBe(true)
  })

  it('ВЫСТРЕЛ, СИРЕНА, ТИТР — не персонажи', () => {
    expect(NON_CHARACTER_WORDS.has('ВЫСТРЕЛ')).toBe(true)
    expect(NON_CHARACTER_WORDS.has('СИРЕНА')).toBe(true)
    expect(NON_CHARACTER_WORDS.has('ТИТР')).toBe(true)
  })

  it('обычные имена НЕ в списке', () => {
    expect(NON_CHARACTER_WORDS.has('ИВАН')).toBe(false)
    expect(NON_CHARACTER_WORDS.has('АРТЁМ')).toBe(false)
  })
})

describe('formatRules: LOCATION_SYNONYMS и TIME_WORDS', () => {
  it('ЭКСТЕРЬЕР → ЭКСТ.', () => {
    expect(LOCATION_SYNONYMS['ЭКСТЕРЬЕР']).toBe('ЭКСТ.')
  })

  it('INT/EXT и I/E → ИНТ-ЭКСТ.', () => {
    expect(LOCATION_SYNONYMS['INT/EXT']).toBe('ИНТ-ЭКСТ.')
    expect(LOCATION_SYNONYMS['I/E']).toBe('ИНТ-ЭКСТ.')
  })

  it('ЭКСТ НЕ синоним — не «чинится» в НАТ', () => {
    expect(LOCATION_SYNONYMS['ЭКСТ']).toBeUndefined()
    expect(LOCATION_SYNONYMS['ЭКСТ.']).toBeUndefined()
  })

  it('времена суток RU+EN в одном наборе', () => {
    for (const w of ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'DAY', 'NIGHT']) {
      expect(TIME_WORDS.has(w)).toBe(true)
    }
  })
})
