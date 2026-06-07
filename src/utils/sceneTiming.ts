import type { TimingSystem } from '../store/scriptStore'

export interface TimingInput {
  pages?: number
  charCount?: number
  dialogLines?: number
}

/**
 * Рассчитывает хронометраж сцены в зависимости от выбранной системы.
 * pages: точное кол-во страниц (от PageCounter) или undefined для fallback.
 */
export function calculateSceneTiming(
  input: TimingInput,
  timingSystem: TimingSystem = 'page',
  genreCoefficient: number = 1.0,
): { pages: number; duration: number } {
  const coeff = genreCoefficient || 1.0
  const charCount = input.charCount || 0

  const pages = input.pages !== undefined
    ? Math.max(0.1, parseFloat(input.pages.toFixed(1)))
    : Math.max(0.1, parseFloat((charCount / 1800).toFixed(1)))

  switch (timingSystem) {
    case 'page':
      return { pages, duration: Math.round(pages * 55 * coeff) }

    case 'character':
      return { pages, duration: Math.round(charCount * 0.05 * coeff) }

    case 'flexible':
      // Гибкий: базовый расчёт по страницам (dialogLines игнорируется для простоты)
      return { pages, duration: Math.round(pages * 55 * coeff) }

    case 'manual':
      // Ручной: пользователь задаёт duration сам, здесь возвращаем 0
      return { pages, duration: 0 }

    default:
      return { pages, duration: Math.round(pages * 55 * coeff) }
  }
}
