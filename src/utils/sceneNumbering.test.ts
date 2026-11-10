import { describe, it, expect } from 'vitest'
import { renumberSceneNumbers } from './sceneNumbering'

describe('renumberSceneNumbers', () => {
  it('пример пользователя: 1-9-А между 1-6 и 1-7 → 1-6-А, а 1-9-Б → 1-9-А', () => {
    // Полный документ серии после переноса (порядок в файле):
    const current = [
      '1-1', '1-2', '1-3', '1-4', '1-5', '1-6',
      '1-9-А', // перенесённая сцена — стоит после 1-6
      '1-7', '1-8', '1-9', '1-9-Б', '1-10',
    ]
    expect(renumberSceneNumbers(current, true, 1)).toEqual([
      '1-1', '1-2', '1-3', '1-4', '1-5', '1-6',
      '1-6-А',
      '1-7', '1-8', '1-9', '1-9-А', '1-10',
    ])
  })

  it('классическая нумерация перенумеровывается подряд', () => {
    expect(renumberSceneNumbers(['1-5', '1-2', '1-9'], true, 1)).toEqual(['1-1', '1-2', '1-3'])
    expect(renumberSceneNumbers(['4', '2', '9'], false, 1)).toEqual(['1', '2', '3'])
  })

  it('варианты после основной уплотняют литеры по порядку в документе', () => {
    const current = ['1-1', '1-2-Б', '1-2-А']
    expect(renumberSceneNumbers(current, true, 1)).toEqual(['1-1', '1-1-А', '1-1-Б'])
  })

  it('пометки в скобках сохраняются', () => {
    const current = ['1-1', '1-2 (бывш)', '1-2-А (дубль)']
    expect(renumberSceneNumbers(current, true, 1)).toEqual(['1-1', '1-2 (бывш)', '1-2-А (дубль)'])
  })

  it('вариант до первой основной становится основной', () => {
    expect(renumberSceneNumbers(['1-9-А', '1-1'], true, 1)).toEqual(['1-1', '1-2'])
  })

  it('фильм без серий — варианты сохраняют литеру', () => {
    expect(renumberSceneNumbers(['1', '2-А', '3-Б', '4'], false, 1)).toEqual(['1', '1-А', '1-Б', '2'])
  })
})
