import type { TimingSystem } from '../store/scriptStore'
import { CHARS_PER_PAGE, MIN_SCENE_PAGES, SECONDS_PER_PAGE, SECONDS_PER_CHAR } from '../constants/scriptConstants'

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
    ? Math.max(MIN_SCENE_PAGES, parseFloat(input.pages.toFixed(1)))
    : Math.max(MIN_SCENE_PAGES, parseFloat((charCount / CHARS_PER_PAGE).toFixed(1)))

  switch (timingSystem) {
    case 'page':
      return { pages, duration: Math.round(pages * SECONDS_PER_PAGE * coeff) }

    case 'character':
      return { pages, duration: Math.round(charCount * SECONDS_PER_CHAR * coeff) }

    case 'flexible':
      // Гибкий: базовый расчёт по страницам (dialogLines игнорируется для простоты)
      return { pages, duration: Math.round(pages * SECONDS_PER_PAGE * coeff) }

    case 'manual':
      // Ручной: пользователь задаёт duration сам, здесь возвращаем 0
      return { pages, duration: 0 }

    default:
      return { pages, duration: Math.round(pages * SECONDS_PER_PAGE * coeff) }
  }
}
