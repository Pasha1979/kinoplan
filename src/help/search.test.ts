import { describe, it, expect } from 'vitest'
import { matchesQuery, filterByQuery } from './search'

describe('help search', () => {
  it('пустой запрос — всё совпадает', () => {
    expect(matchesQuery('', 'любой текст')).toBe(true)
    expect(matchesQuery('   ', 'любой текст')).toBe(true)
    expect(filterByQuery([{ t: 'a' }, { t: 'b' }], '', (i) => [i.t])).toHaveLength(2)
  })

  it('подстрока без учёта регистра', () => {
    expect(matchesQuery('ЗАКЛАДК', 'Закладки на сценах')).toBe(true)
    expect(matchesQuery('закладк', 'заголовок', null, 'сцена с ЗАКЛАДКОЙ')).toBe(true)
    expect(matchesQuery('нет такого', 'другой текст')).toBe(false)
  })

  it('filterByQuery — по любому полю элемента', () => {
    const items = [
      { title: 'Поиск и замена', body: 'Ctrl+F открывает панель', tag: 'Поиск' },
      { title: 'Focus Mode', body: 'полноэкранный режим', tag: 'Интерфейс' },
    ]
    expect(filterByQuery(items, 'ctrl+f', (i) => [i.title, i.body, i.tag])).toHaveLength(1)
    expect(filterByQuery(items, 'интерфейс', (i) => [i.title, i.body, i.tag])).toHaveLength(1)
    expect(filterByQuery(items, 'отсутствует', (i) => [i.title, i.body])).toHaveLength(0)
  })
})
