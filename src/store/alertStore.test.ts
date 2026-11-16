import { describe, it, expect } from 'vitest'
import { computeAlerts } from './alertStore'
import type { Project } from '../types/project'

const iso = (offsetDays: number) => {
  const d = new Date(); d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const baseProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Тест',
  type: 'film',
  status: 'preproduction',
  dailyOutput: 5,
  shootingGroups: 1,
  plannedShootingDays: 20,
  cloudStorage: 'none',
  createdAt: iso(-10),
  updatedAt: iso(0),
  scriptProgress: 80,
  castingProgress: 80,
  locationsProgress: 80,
  scheduleProgress: 80,
  shotDays: 0,
  scheduledDays: 0,
  callSheetsSent: 0,
  callSheetsConfirmed: 0,
  shootingDays: [{ date: iso(5), type: 'shoot' }],
  locationsTotal: 0,
  locationsApproved: 0,
  locationsInScout: 0,
  shotMinutes: 0,
  totalMinutes: 0,
  conflicts: 0,
  ...over,
})

describe('computeAlerts', () => {
  it('проект без дат и с заполненным расписанием → без падения, без алертов', () => {
    const alerts = computeAlerts(baseProject({ startDate: undefined, endDate: undefined }))
    expect(alerts).toEqual([])
  })

  it('старт завтра + кастинг < 30% → critical', () => {
    const alerts = computeAlerts(baseProject({ startDate: iso(1), castingProgress: 10 }))
    const crit = alerts.find((a) => a.id === 'casting_critical')
    expect(crit?.level).toBe('critical')
  })

  it('старт завтра, расписание пустое → critical no_schedule', () => {
    const alerts = computeAlerts(baseProject({ startDate: iso(1), shootingDays: [] }))
    expect(alerts.find((a) => a.id === 'no_schedule')?.level).toBe('critical')
  })

  it('просроченный проект → critical overdue', () => {
    const alerts = computeAlerts(baseProject({ endDate: iso(-3) }))
    expect(alerts.find((a) => a.id === 'overdue')?.level).toBe('critical')
    expect(alerts.find((a) => a.id === 'overdue')?.description).toMatch(/прошла \d+ дн\. назад/)
  })

  it('низкая готовность сценария при близком старте → warning', () => {
    const alerts = computeAlerts(baseProject({ startDate: iso(10), scriptProgress: 30, castingProgress: 90, locationsProgress: 90 }))
    expect(alerts.find((a) => a.id === 'script_low')?.level).toBe('warning')
  })

  it('финиш < 14 дней → warning deadline_soon', () => {
    const alerts = computeAlerts(baseProject({ endDate: iso(10) }))
    expect(alerts.find((a) => a.id === 'deadline_soon')?.level).toBe('warning')
  })

  it('низкий общий прогресс и далёкий старт → info', () => {
    const alerts = computeAlerts(baseProject({
      startDate: iso(60),
      scriptProgress: 0, castingProgress: 0, locationsProgress: 0, scheduleProgress: 0,
    }))
    expect(alerts.find((a) => a.id === 'low_progress')?.level).toBe('info')
  })

  it('сортировка: critical → warning → info', () => {
    const alerts = computeAlerts(baseProject({
      startDate: iso(60), endDate: iso(-1),
      castingProgress: 0, scriptProgress: 0, locationsProgress: 0, scheduleProgress: 0,
    }))
    const order = { critical: 0, warning: 1, info: 2 }
    for (let i = 1; i < alerts.length; i++) {
      expect(order[alerts[i].level]).toBeGreaterThanOrEqual(order[alerts[i - 1].level])
    }
  })
})
