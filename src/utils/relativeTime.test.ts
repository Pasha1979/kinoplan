import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './relativeTime'

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

describe('formatRelativeTime', () => {
  it('returns dash for missing or invalid input', () => {
    expect(formatRelativeTime(undefined)).toBe('—')
    expect(formatRelativeTime('not-a-date')).toBe('—')
  })

  it('returns "только что" for recent timestamps', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('только что')
    expect(formatRelativeTime(minutesAgo(0))).toBe('только что')
  })

  it('formats minutes with correct plural', () => {
    expect(formatRelativeTime(minutesAgo(1))).toBe('1 минуту назад')
    expect(formatRelativeTime(minutesAgo(3))).toBe('3 минуты назад')
    expect(formatRelativeTime(minutesAgo(15))).toBe('15 минут назад')
    expect(formatRelativeTime(minutesAgo(21))).toBe('21 минуту назад')
  })

  it('formats hours with correct plural', () => {
    expect(formatRelativeTime(hoursAgo(1))).toBe('1 час назад')
    expect(formatRelativeTime(hoursAgo(3))).toBe('3 часа назад')
    expect(formatRelativeTime(hoursAgo(10))).toBe('10 часов назад')
  })

  it('returns "вчера" for 1 day ago', () => {
    expect(formatRelativeTime(daysAgo(1))).toBe('вчера')
  })

  it('formats days with correct plural', () => {
    expect(formatRelativeTime(daysAgo(2))).toBe('2 дня назад')
    expect(formatRelativeTime(daysAgo(6))).toBe('6 дней назад')
  })

  it('falls back to date for older timestamps', () => {
    expect(formatRelativeTime(daysAgo(30))).toMatch(/\d{2}\.\d{2}\.\d{4}/)
  })
})
