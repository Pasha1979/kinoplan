// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StatisticsView from './StatisticsView'
import type { Scene } from '../../../types/scene'

function sc(p: Record<string, unknown> & { id: string; number: string }): Scene & { _episode?: number } {
  return { type: 'ИНТ', location: 'ДОМ', time: 'ДЕНЬ', charCount: 100, cast: [], pages: 1, ...p } as Scene
}

const ALL = [
  sc({ id: 'a', number: '1-1', duration: 60, cast: ['ИВАН'], _episode: 1 }),
  sc({ id: 'b', number: '1-2', duration: 30, cast: ['МАША'], _episode: 1 }),
]

const BLOCKS = [
  { type: 'scene_header', content: 'ИНТ. ДОМ - ДЕНЬ' },
  { type: 'dialog', content: 'привет' },
  { type: 'action', content: 'входит' },
]

const props = {
  isDark: true,
  scenes: ALL,
  blocks: BLOCKS,
  precisePages: 2,
  isSerial: true,
  episodesCount: 2,
  episodeDuration: 25,
}

beforeEach(() => localStorage.clear())

const clickPill = (name: string) =>
  fireEvent.click(screen.getAllByRole('button', { name })[0])

describe('StatisticsView', () => {
  it('показывает все ключевые блоки', () => {
    render(<StatisticsView {...props} />)
    expect(screen.getByText('Сцен', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Страниц', { exact: true })).toBeInTheDocument()
    expect(screen.getAllByText('Темп по сценам').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Диалог / Действие').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Готовность серий').length).toBeGreaterThan(0)
  })

  it('«Все» — темп показывает сцены серии 1', () => {
    render(<StatisticsView {...props} />)
    // номера сцен видны в темпе
    expect(screen.getAllByText('1-1').length).toBeGreaterThan(0)
  })

  it('фильтр «С2» (пустая серия) — блоки остаются с заглушками', () => {
    render(<StatisticsView {...props} />)
    clickPill('С2')
    expect(screen.getByText(/Здесь будет темп сцен/)).toBeInTheDocument()
    expect(screen.getByText(/Здесь будет хронометраж/)).toBeInTheDocument()
    // «Готовность серий» остаётся — она всегда актуальна
    expect(screen.getAllByText('Готовность серий').length).toBeGreaterThan(0)
  })

  it('фильтр «С1» — реальные данные серии 1', () => {
    render(<StatisticsView {...props} />)
    clickPill('С1')
    expect(screen.getByText('Диалог / Действие · серия 1')).toBeInTheDocument()
    expect(screen.getAllByText('1-1').length).toBeGreaterThan(0)
  })

  it('«Готовность серий» показывает прогресс каждой серии', () => {
    render(<StatisticsView {...props} />)
    // строки прогресса серий содержат целевой хронометраж
    expect(screen.getAllByText(/\/25:00/).length).toBeGreaterThanOrEqual(2)
  })

  it('унаследованная раскладка без h не ломает карточки (фикс темпа)', () => {
    localStorage.setItem('statsLayout', JSON.stringify({ 's-tempo': { dx: 10, dy: 20 } }))
    render(<StatisticsView {...props} />)
    expect(screen.getAllByText('Темп по сценам').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1-1').length).toBeGreaterThan(0)
  })

  it('наведение на строку (тултип) не ремаунтит блоки — скролл списков не сбрасывается', () => {
    const { container } = render(<StatisticsView {...props} />)
    const timings = container.querySelector('[data-layout-box="s-timings"]') as HTMLElement
    const listBefore = timings.querySelector('[data-scene-row]')!.parentElement!.parentElement!
    const row = [...container.querySelectorAll('[data-layout-box="s-chars"] span')]
      .find((e) => e.textContent === 'ИВАН')!.parentElement as HTMLElement
    fireEvent.mouseEnter(row)
    fireEvent.mouseLeave(row)
    const listAfter = container.querySelector('[data-layout-box="s-timings"] [data-scene-row]')!.parentElement!.parentElement!
    expect(listAfter).toBe(listBefore)
    expect(listBefore.isConnected).toBe(true)
  })

  it('макетные смещения не применяются вне конструктора — блоки не перекрываются ни на каком экране', () => {
    // Сохранённая раскладка с пиксельными смещениями не должна влиять на обычный режим
    localStorage.setItem('statsLayout_dev', JSON.stringify({ 's-tempo': { dx: 100, dy: 200, w: 500, h: 300 } }))
    const { container } = render(<StatisticsView {...props} />)
    const boxes = container.querySelectorAll('[data-layout-box]')
    expect(boxes.length).toBeGreaterThan(0)
    boxes.forEach((b) => {
      const style = (b as HTMLElement).style
      expect(style.transform).toBe('')
      expect(style.width).toBe('')
      expect(style.height).toBe('')
    })
    // И запечённый APPLIED_LAYOUT (s-heatmap: dy -734px) тоже не применяется
    const heatmap = container.querySelector('[data-layout-box="s-heatmap"]') as HTMLElement
    expect(heatmap.style.transform).toBe('')
  })
})
