// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SceneStatusMenu from './SceneStatusMenu'
import type { DraftStatus } from '../../../types/scene'

afterEach(cleanup)

const theme = {
  isDark: true,
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#e5e7eb',
  textSecondary: '#9ca3af',
}

function renderMenu(overrides: Partial<Parameters<typeof SceneStatusMenu>[0]> = {}) {
  const props = {
    x: 10, y: 10, sceneId: 'scene-1',
    ...theme,
    onSelectStatus: vi.fn(),
    onCreateStatus: vi.fn(),
    onOpenManager: vi.fn(),
    ...overrides,
  }
  render(<SceneStatusMenu {...props} />)
  return props
}

describe('SceneStatusMenu — выпадашка редакционного статуса', () => {
  it('показывает встроенные статусы и «Без статуса»', () => {
    renderMenu()
    for (const label of ['Набросок', 'В работе', 'На доработке', 'На проверке', 'Готова', 'Финал']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('✕ Без статуса')).toBeTruthy()
  })

  it('клик по статусу → onSelectStatus(sceneId, statusId)', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByText('Финал'))
    expect(props.onSelectStatus).toHaveBeenCalledWith('scene-1', 'final')
  })

  it('«Без статуса» → onSelectStatus(sceneId, undefined)', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByText('✕ Без статуса'))
    expect(props.onSelectStatus).toHaveBeenCalledWith('scene-1', undefined)
  })

  it('свои статусы из draftStatuses попадают в список и выбираются', () => {
    const custom: DraftStatus = { id: 'custom-1', label: 'На переводе', color: '#0ea5e9', weight: 60 }
    const props = renderMenu({ draftStatuses: [custom] })
    fireEvent.click(screen.getByText('На переводе'))
    expect(props.onSelectStatus).toHaveBeenCalledWith('scene-1', 'custom-1')
  })

  it('«Управление статусами» видно только при наличии своих статусов', () => {
    renderMenu()
    expect(screen.queryByText('⚙ Управление статусами')).toBeNull()
  })

  it('«Управление статусами» → onOpenManager', () => {
    const custom: DraftStatus = { id: 'custom-1', label: 'Черновик 2', color: '#0ea5e9', weight: 30 }
    const props = renderMenu({ draftStatuses: [custom] })
    fireEvent.click(screen.getByText('⚙ Управление статусами'))
    expect(props.onOpenManager).toHaveBeenCalled()
  })

  it('«＋ Свой статус…» открывает форму; «Создать» без имени не срабатывает', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByText('＋ Свой статус…'))
    expect(screen.getByPlaceholderText('Название статуса…')).toBeTruthy()
    fireEvent.click(screen.getByText('Создать'))
    expect(props.onCreateStatus).not.toHaveBeenCalled()
  })

  it('создание своего статуса → onCreateStatus с label/color/weight и custom-id', () => {
    const onCreateStatus = vi.fn()
    renderMenu({ onCreateStatus })
    fireEvent.click(screen.getByText('＋ Свой статус…'))
    fireEvent.change(screen.getByPlaceholderText('Название статуса…'), { target: { value: '  Правки режиссёра  ' } })
    fireEvent.change(screen.getByDisplayValue('Почти готово · 70%'), { target: { value: '100' } })
    fireEvent.click(screen.getByText('Создать'))
    expect(onCreateStatus).toHaveBeenCalledTimes(1)
    const [sceneId, st] = onCreateStatus.mock.calls[0]
    expect(sceneId).toBe('scene-1')
    expect(st.label).toBe('Правки режиссёра')
    expect(st.weight).toBe(100)
    expect(st.id).toMatch(/^custom-/)
    expect(st.color).toBeTruthy()
  })

  it('✕ в форме создания закрывает форму без создания', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByText('＋ Свой статус…'))
    fireEvent.click(screen.getByText('✕'))
    expect(screen.getByText('＋ Свой статус…')).toBeTruthy()
    expect(props.onCreateStatus).not.toHaveBeenCalled()
  })
})
