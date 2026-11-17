// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SceneNavigator from './SceneNavigator'
import type { Scene } from '../types/scene'

beforeAll(() => {
  // jsdom: Placeholder/dnd иконки скроллят карточки
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
})

afterEach(cleanup)

function scene(over: Partial<Scene>): Scene {
  return {
    id: 's1', number: '1', type: 'ИНТ', location: 'ЛОКАЦИЯ',
    time: 'ДЕНЬ', pages: 1, cast: [], ...over,
  }
}

const scenes: Scene[] = [
  scene({ id: 's1', number: '1', type: 'ИНТ', location: 'КВАРТИРА', cast: ['ИВАН', 'МАРИЯ'], synopsis: 'Иван читает письмо' }),
  scene({ id: 's2', number: '2', type: 'ЭКСТ', location: 'УЛИЦА', time: 'НОЧЬ', cast: ['ПЁТР'], synopsis: 'Пётр бежит по улице' }),
  scene({ id: 's3', number: '3', type: 'ИНТ-ЭКСТ', location: 'ДВОР', cast: ['ИВАН'], colorTag: 'blue' }),
]

function renderNav(overrides: Record<string, unknown> = {}) {
  const props = {
    scenes, isDark: true, onSceneClick: vi.fn(), ...overrides,
  }
  render(<SceneNavigator {...props} />)
  return props
}

const locationOf = (loc: string) => screen.queryByText(`${loc}.`)
const openFilters = () => fireEvent.click(screen.getByText(/^Фильтры/))
const closeFilters = () => fireEvent.click(document.querySelector('.fixed.inset-0.z-40') as HTMLElement)

describe('SceneNavigator — поиск и фильтры (UI)', () => {
  it('без фильтров показывает все сцены', () => {
    renderNav()
    expect(locationOf('КВАРТИРА')).toBeTruthy()
    expect(locationOf('УЛИЦА')).toBeTruthy()
    expect(locationOf('ДВОР')).toBeTruthy()
  })

  it('поиск по локации оставляет только совпадение; ✕ очищает', () => {
    renderNav()
    const input = screen.getByPlaceholderText('Поиск: локация, персонаж, синопсис…')
    fireEvent.change(input, { target: { value: 'улица' } })
    expect(locationOf('УЛИЦА')).toBeTruthy()
    expect(locationOf('КВАРТИРА')).toBeNull()

    const clear = input.parentElement!.querySelector('button') as HTMLElement
    fireEvent.click(clear)
    expect(locationOf('КВАРТИРА')).toBeTruthy()
  })

  it('поиск по персонажу и синопсису регистронезависим', () => {
    renderNav()
    const input = screen.getByPlaceholderText('Поиск: локация, персонаж, синопсис…')
    fireEvent.change(input, { target: { value: 'иван' } })
    expect(locationOf('КВАРТИРА')).toBeTruthy()
    expect(locationOf('ДВОР')).toBeTruthy()
    expect(locationOf('УЛИЦА')).toBeNull()

    fireEvent.change(input, { target: { value: 'письмо' } })
    expect(locationOf('КВАРТИРА')).toBeTruthy()
    expect(locationOf('ДВОР')).toBeNull()
  })

  it('фильтр «ИНТ» включает ИНТ-ЭКСТ и прячет ЭКСТ; счётчик на кнопке', () => {
    renderNav()
    openFilters()
    fireEvent.click(screen.getByText('ИНТ', { selector: 'button' }))
    expect(locationOf('КВАРТИРА')).toBeTruthy()
    expect(locationOf('ДВОР')).toBeTruthy()
    expect(locationOf('УЛИЦА')).toBeNull()
    expect(screen.getByText('Фильтры ·1')).toBeTruthy()
    closeFilters()
  })

  it('фильтр по локации через панель + «Сбросить фильтры»', () => {
    renderNav()
    openFilters()
    fireEvent.click(screen.getByText('КВАРТИРА', { selector: 'button span' }))
    expect(locationOf('КВАРТИРА')).toBeTruthy()
    expect(locationOf('УЛИЦА')).toBeNull()

    fireEvent.click(screen.getByText('✕ Сбросить фильтры'))
    expect(locationOf('УЛИЦА')).toBeTruthy()
    closeFilters()
  })

  it('фильтр по персонажу (OR внутри категории)', () => {
    renderNav()
    openFilters()
    fireEvent.click(screen.getByText('ПЁТР', { selector: 'button span' }))
    expect(locationOf('УЛИЦА')).toBeTruthy()
    expect(locationOf('КВАРТИРА')).toBeNull()
    closeFilters()
  })

  it('стрелки «следующая/предыдущая» идут по отфильтрованному списку', () => {
    const props = renderNav({ activeSceneId: 's2' })
    // фильтр ИНТ → в списке s1, s3
    openFilters()
    fireEvent.click(screen.getByText('ИНТ', { selector: 'button' }))
    closeFilters()

    fireEvent.click(screen.getByTitle('Следующая сцена'))
    // активная s2 не в списке → начинается с первой отфильтрованной
    expect(props.onSceneClick).toHaveBeenCalledWith('s1')
    fireEvent.click(screen.getByTitle('Предыдущая сцена'))
    expect(props.onSceneClick).toHaveBeenLastCalledWith('s3')
  })
})
