/**
 * T-72: авто-типографика при наборе.
 * Чистая функция — решает, чем заменить только что набранный символ,
 * по контексту текста ДО курсора внутри текущего блока.
 *
 * Правила (русская традиция):
 *   "--"        → "—"   (двойной дефис → тире)
 *   '"'         → "«" или "»" по контексту
 *   "(з/к)"     → "(З/К)" (ремарка «за кадром»)
 */

export interface TypoFix {
  /** Сколько символов перед курсора откатить (заменить вместе с набранным) */
  back: number
  /** Что вставить вместо */
  insert: string
}

// Открывающий контекст для кавычек: начало блока, пробел, открывающие скобки, тире, «
const OPEN_QUOTE_CTX = /[\s([{«„—–\-…]|^$/

export function typographyTransform(before: string, typed: string): TypoFix | null {
  if (typed.length !== 1) return null

  // "--" → "—"
  if (typed === '-' && before.endsWith('-')) {
    return { back: 1, insert: '—' }
  }

  // '"' → «/»
  if (typed === '"') {
    const prev = before.slice(-1)
    const open = prev === '' || OPEN_QUOTE_CTX.test(prev)
    return { back: 0, insert: open ? '«' : '»' }
  }

  // "(з/к)" → "(З/К)" — регистронезависимо, «(з/к» уже набрано до курсора
  if (typed === ')' && /\(з\s*\/\s*к$/i.test(before)) {
    const m = before.match(/\(з\s*\/\s*к$/i)!
    return { back: m[0].length, insert: '(З/К)' }
  }

  return null
}
