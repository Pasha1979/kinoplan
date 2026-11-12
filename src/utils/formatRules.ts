import { SCENE_NUMBER } from './sceneNumber'

/**
 * Канонические правила формата сценария.
 * Единый источник истины: до этого константы и regex'ы
 * размножались по smartFormat/sceneExtractor/useScriptEditorLogic
 * и расходились (классический баг: \b не видит кириллицу).
 */

export const TIME_WORDS = new Set([
  'ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ',
  'DAY', 'NIGHT', 'MORNING', 'EVENING', 'DAWN', 'DUSK',
])

export const TRANSITION_WORDS = new Set([
  'РАССВЕТ', 'ЗАТЕМНЕНИЕ', 'ПЕРЕХОД', 'СМЕНА',
  'CUT TO', 'FADE IN', 'FADE OUT', 'DISSOLVE TO',
])

// CAPS-слова — акценты действия/звука, НЕ имена персонажей
export const NON_CHARACTER_WORDS = new Set([
  'ВЗРЫВ', 'ВЫСТРЕЛ', 'ВЫСТРЕЛЫ', 'КРИК', 'КРИКИ', 'СМЕХ', 'ГРОХОТ', 'ГРОМ',
  'ЗВОНОК', 'СИРЕНА', 'ТИШИНА', 'ТИТР', 'ТИТРЫ', 'ОГОНЬ', 'ДЫМ',
  'УДАР', 'УДАРЫ', 'ШУМ', 'ГУЛ', 'СКРИП', 'ГУДОК', 'СТУК', 'ЗВУК',
  'BOOM', 'CRASH', 'BANG', 'SOUND', 'SILENCE',
])

export const HEADER_RE = new RegExp(`(${SCENE_NUMBER}\\.\\s*)?(ИНТ|ЭКСТ|ИНТ-ЭКСТ|ПАВ|НАТ)\\.`, 'i')

/** Анкорованная проверка полной шапки сцены (для валидатора). Канон: ИНТ/ЭКСТ/ПАВ/НАТ. */
export const SCENE_HEADER_RE_RU = new RegExp(`^${SCENE_NUMBER}\\.\\s*(ИНТ|ЭКСТ|ПАВ|НАТ|ИНТ[.\\/-]?(?:ЭКСТ|НАТ))\\.?\\s*.+$`, 'i')
export const SCENE_HEADER_RE_EN = new RegExp(`^${SCENE_NUMBER}\\.\\s*(INT|EXT|INT\\.\\/EXT|I\\/E)\\.?\\s*.+$`, 'i')

/** Неканоничные → каноничные токены локации (для автозамены валидатора). */
export const LOCATION_SYNONYMS: Record<string, string> = {
  'ЭКСТЕРЬЕР': 'ЭКСТ.',
  'INT/EXT': 'ИНТ-ЭКСТ.',
  'I/E': 'ИНТ-ЭКСТ.',
  'ИНТ/ЭКСТ': 'ИНТ-ЭКСТ.',
}

export const TIME_WORD_RE = /(?:ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ|DAY|NIGHT|MORNING|EVENING|DAWN|DUSK)/i

/**
 * Граница слова с поддержкой кириллицы.
 * \b в JS видит только [a-zA-Z0-9_] — для русских слов не работает.
 */
export function wordBoundary(word: string): RegExp {
  return new RegExp(`(?<![А-ЯЁа-яёA-Za-z])${word}(?![А-ЯЁа-яёA-Za-z])`, 'gi')
}

/** Таблицы замен для конвертации RU ↔ EN формата шапок */
export const RU_TO_EN_REPLACEMENTS: [RegExp, string][] = [
  [/ИНТ-ЭКСТ\./gi, 'INT/EXT.'],
  [/ИНТ\./gi, 'INT.'],
  [/ЭКСТ\./gi, 'EXT.'],
  [/ПАВ\./gi, 'PAV.'],
  [/—/g, '-'],
  [wordBoundary('ДЕНЬ'), 'DAY'],
  [wordBoundary('НОЧЬ'), 'NIGHT'],
  [wordBoundary('УТРО'), 'MORNING'],
  [wordBoundary('ВЕЧЕР'), 'EVENING'],
  [wordBoundary('РАССВЕТ'), 'DAWN'],
  [wordBoundary('ЗАКАТ'), 'DUSK'],
]

export const EN_TO_RU_REPLACEMENTS: [RegExp, string][] = [
  [/INT\/EXT\./gi, 'ИНТ-ЭКСТ.'],
  [/INT\./gi, 'ИНТ.'],
  [/EXT\./gi, 'ЭКСТ.'],
  [/PAV\./gi, 'ПАВ.'],
  [/ - /g, ' — '],
  [wordBoundary('DAY'), 'ДЕНЬ'],
  [wordBoundary('NIGHT'), 'НОЧЬ'],
  [wordBoundary('MORNING'), 'УТРО'],
  [wordBoundary('EVENING'), 'ВЕЧЕР'],
  [wordBoundary('DAWN'), 'РАССВЕТ'],
  [wordBoundary('DUSK'), 'ЗАКАТ'],
]
