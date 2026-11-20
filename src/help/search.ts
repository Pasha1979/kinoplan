/**
 * Поиск по справке — чистые функции (unit-тестируемы).
 * Ищется подстрока без учёта регистра во всех текстовых полях элемента.
 */

/** Совпадает ли любой из переданных текстов с запросом */
export function matchesQuery(query: string, ...texts: (string | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return texts.some((t) => !!t && t.toLowerCase().includes(q))
}

/** Фильтрует элементы произвольного типа по функции извлечения текстов */
export function filterByQuery<T>(items: T[], query: string, texts: (item: T) => (string | undefined | null)[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((it) => matchesQuery(q, ...texts(it)))
}
