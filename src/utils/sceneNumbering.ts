/**
 * Умная перенумерация сцен с литерными вариантами.
 *
 * Правила:
 * - «Основные» сцены (без литеры) нумеруются подряд: 1-6, 1-7, 1-8…
 * - «Варианты» (1-9-А, 1-9-Б) сохраняют литеру и получают базу
 *   от ближайшей предыдущей основной сцены. Литеры уплотняются
 *   в порядке документа: А, Б, В… — если А освободилась, Б станет А.
 * - Пометки в скобках («(бывш)») сохраняются у любого номера.
 * - Вариант до первой основной сцены считается основной.
 */

const LETTERS = 'АБВГДЕЖЗИКЛМНПРСТУФХЦЧШЩЭЮЯ'
const NOTE_RE = /\s*\(([^)]*)\)\s*$/
const VARIANT_RE = /-([А-ЯA-ZЁ])$/

interface NumInfo {
  isVariant: boolean
  note: string
}

function parseNum(num: string): NumInfo {
  const note = num.match(NOTE_RE)?.[1] ?? ''
  const core = num.replace(NOTE_RE, '')
  return { isVariant: VARIANT_RE.test(core), note }
}

function letterAt(i: number): string {
  const L = LETTERS.length
  return LETTERS[i % L] + (i >= L ? String(Math.floor(i / L) + 1) : '')
}

/**
 * Пересчитывает номера сцен после перестановки.
 * @param current текущие номера в порядке документа
 * @param isSerial серийный проект (номера «серия-сцена»)
 * @param episode номер серии
 */
export function renumberSceneNumbers(current: string[], isSerial: boolean, episode: number): string[] {
  const infos = current.map(parseNum)
  // Вариант «сирота» (нет основной сцены перед ним) → считаем основным
  let seenPrimary = false
  const effective = infos.map((info) => {
    if (!info.isVariant) seenPrimary = true
    return info.isVariant && !seenPrimary ? { ...info, isVariant: false } : info
  })

  // Проход 1: основные сцены — подряд
  let pi = 0
  const out = effective.map((info) => {
    if (!info.isVariant) {
      pi++
      const base = isSerial ? `${episode}-${pi}` : `${pi}`
      return { num: info.note ? `${base} (${info.note})` : base, base, isVariant: false as const, note: info.note }
    }
    return { num: '', base: '', isVariant: true as const, note: info.note }
  })

  // Проход 2: варианты — база от предыдущей основной, литеры А,Б,В… по базе
  const counters = new Map<string, number>()
  let lastBase = ''
  for (const item of out) {
    if (!item.isVariant) {
      lastBase = item.base
      counters.set(lastBase, 0)
      continue
    }
    const idx = counters.get(lastBase) ?? 0
    counters.set(lastBase, idx + 1)
    const variant = `${lastBase}-${letterAt(idx)}`
    item.num = item.note ? `${variant} (${item.note})` : variant
    item.base = lastBase
  }

  return out.map((o) => o.num)
}
