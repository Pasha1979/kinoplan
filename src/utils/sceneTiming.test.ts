import { describe, it, expect } from 'vitest'
import { calculateSceneTiming } from './sceneTiming'
import { SECONDS_PER_PAGE, SECONDS_PER_CHAR, SECONDS_PER_DIALOG_LINE } from '../constants/scriptConstants'

describe('calculateSceneTiming', () => {
  it('should calculate timing by pages system', () => {
    const result = calculateSceneTiming({ pages: 1.5 }, 'page', 1.0)
    expect(result.pages).toBe(1.5)
    expect(result.duration).toBe(Math.round(1.5 * SECONDS_PER_PAGE))
  })

  it('should calculate timing by character system', () => {
    const charCount = 1500
    const result = calculateSceneTiming({ charCount }, 'character', 1.0)
    expect(result.duration).toBe(Math.round(charCount * SECONDS_PER_CHAR))
  })

  it('should respect genre coefficient', () => {
    const result = calculateSceneTiming({ pages: 1.0 }, 'page', 1.5)
    expect(result.duration).toBe(Math.round(1.0 * SECONDS_PER_PAGE * 1.5))
  })

  it('should fallback to MIN_SCENE_PAGES if pages is too small', () => {
    const result = calculateSceneTiming({ pages: 0.01 }, 'page', 1.0)
    expect(result.pages).toBe(0.1) // MIN_SCENE_PAGES
  })

  it('should calculate pages from character count if pages is undefined', () => {
    const charCount = 1800
    const result = calculateSceneTiming({ charCount }, 'page', 1.0)
    expect(result.pages).toBe(1.0) // 1800 / 1800 = 1.0
  })

  it('should return 0 duration for manual system', () => {
    const result = calculateSceneTiming({ pages: 2.0 }, 'manual', 1.0)
    expect(result.duration).toBe(0)
  })

  it('should calculate flexible timing: pages + dialog lines', () => {
    const pages = 1.0
    const dialogLines = 5
    const result = calculateSceneTiming({ pages, dialogLines }, 'flexible', 1.0)
    const expected = Math.round(pages * SECONDS_PER_PAGE + dialogLines * SECONDS_PER_DIALOG_LINE)
    expect(result.duration).toBe(expected)
  })

  it('should apply genre coefficient to flexible timing', () => {
    const pages = 2.0
    const dialogLines = 10
    const coeff = 1.2
    const result = calculateSceneTiming({ pages, dialogLines }, 'flexible', coeff)
    const expected = Math.round((pages * SECONDS_PER_PAGE + dialogLines * SECONDS_PER_DIALOG_LINE) * coeff)
    expect(result.duration).toBe(expected)
  })
})
