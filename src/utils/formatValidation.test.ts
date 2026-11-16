import { describe, it, expect } from 'vitest'
import { validateFormatBlocks } from './formatValidation'

const B = (type: string, content: string, id = type + '-' + Math.random().toString(36).slice(2, 8)) =>
  ({ id, type, content })

describe('validateFormatBlocks: валидные шапки — ноль предупреждений', () => {
  it('«1. ЭКСТ. УЛИЦА — ДЕНЬ» — 0 issues', () => {
    const issues = validateFormatBlocks([B('scene_header', '1. ЭКСТ. УЛИЦА — ДЕНЬ')], 'russian')
    expect(issues).toHaveLength(0)
  })

  it('«2. ПАВ. СТУДИЯ — НОЧЬ» — 0 issues', () => {
    const issues = validateFormatBlocks([B('scene_header', '2. ПАВ. СТУДИЯ — НОЧЬ')], 'russian')
    expect(issues).toHaveLength(0)
  })

  it('EN-формат «1. INT. HOUSE - DAY» — 0 issues', () => {
    const issues = validateFormatBlocks([B('scene_header', '1. INT. HOUSE - DAY')], 'hollywood')
    expect(issues).toHaveLength(0)
  })
})

describe('validateFormatBlocks: персонажи', () => {
  it('«АРТЁМ» — без «не капс» (Ё — валидная заглавная)', () => {
    const issues = validateFormatBlocks([B('character', 'АРТЁМ')], 'russian')
    expect(issues.filter((i) => i.id.endsWith('-case'))).toHaveLength(0)
  })

  it('«АРТЁМ (ЗА КАДРОМ)» — пометка в скобках тоже валидна', () => {
    const issues = validateFormatBlocks([B('character', 'АРТЁМ (ЗА КАДРОМ)')], 'russian')
    expect(issues).toHaveLength(0)
  })

  it('«Анна-Мария» строчными → предупреждение о капсе с автофиксом', () => {
    const issues = validateFormatBlocks([B('character', 'Анна-Мария', 'c1')], 'russian')
    const caseIssue = issues.find((i) => i.id === 'fmt-c1-case')
    expect(caseIssue?.severity).toBe('warning')
    expect(caseIssue?.suggestion).toBe('АННА-МАРИЯ')
    expect(caseIssue?.autoFixable).toBe(true)
  })

  it('имя с цифрой → ошибка', () => {
    const issues = validateFormatBlocks([B('character', 'АГЕНТ 007', 'c2')], 'russian')
    expect(issues.find((i) => i.id === 'fmt-c2-num')?.severity).toBe('error')
  })
})

describe('validateFormatBlocks: автофикс номера сцены', () => {
  it('шапка без номера → ошибка с автофиксом', () => {
    const issues = validateFormatBlocks([B('scene_header', 'ЭКСТ. УЛИЦА — ДЕНЬ', 'h1')], 'russian')
    const numIssue = issues.find((i) => i.id === 'fmt-h1-num')
    expect(numIssue?.severity).toBe('error')
    expect(numIssue?.autoFixable).toBe(true)
  })

  it('предлагает следующий номер по позиции, а не всегда «1»', () => {
    const issues = validateFormatBlocks([
      B('scene_header', '1. ИНТ. ДОМ — ДЕНЬ', 'h1'),
      B('scene_action', 'Действие.'),
      B('scene_header', '5. ИНТ. ЛЕС — НОЧЬ', 'h2'),
      B('scene_header', 'ЭКСТ. ПОЛЕ — УТРО', 'h3'),
    ], 'russian')
    const numIssue = issues.find((i) => i.id === 'fmt-h3-num')
    expect(numIssue?.suggestion).toBe('6. ЭКСТ. ПОЛЕ — УТРО')
  })

  it('первой сцене без номера предлагает «1»', () => {
    const issues = validateFormatBlocks([B('scene_header', 'ИНТ. ДОМ — ДЕНЬ', 'h1')], 'russian')
    expect(issues.find((i) => i.id === 'fmt-h1-num')?.suggestion).toBe('1. ИНТ. ДОМ — ДЕНЬ')
  })
})

describe('validateFormatBlocks: формат шапки и синонимы', () => {
  it('ЭКСТ НЕ «чинится» в НАТ — валидная шапка без замечаний', () => {
    const issues = validateFormatBlocks([
      B('scene_header', '1. ЭКСТ. ДВОР — ДЕНЬ', 'h1'),
      B('scene_header', 'ЭКСТ. УЛИЦА — НОЧЬ', 'h2'), // только нет номера
    ], 'russian')
    // у h2 — ошибка только про номер, без предложения сменить ЭКСТ на НАТ
    const fmtIssue = issues.find((i) => i.id === 'fmt-h2-fmt')
    expect(fmtIssue?.suggestion ?? '').not.toContain('НАТ')
    expect(issues.filter((i) => i.suggestion?.includes('НАТ'))).toHaveLength(0)
  })

  it('«ЭКСТЕРЬЕР.» проходит как валидная ЭКСТ-шапка (регекс принимает префикс)', () => {
    const issues = validateFormatBlocks([B('scene_header', '1. ЭКСТЕРЬЕР. УЛИЦА — ДЕНЬ', 'h1')], 'russian')
    expect(issues.filter((i) => i.id === 'fmt-h1-fmt')).toHaveLength(0)
  })

  it('«INT/EXT» в RU-формате → автофикс в «ИНТ-ЭКСТ.»', () => {
    const issues = validateFormatBlocks([B('scene_header', '1. INT/EXT. МАШИНА — ДЕНЬ', 'h1')], 'russian')
    const fmtIssue = issues.find((i) => i.id === 'fmt-h1-fmt')
    expect(fmtIssue?.autoFixable).toBe(true)
    expect(fmtIssue?.suggestion).toBe('1. ИНТ-ЭКСТ. МАШИНА — ДЕНЬ')
  })

  it('«I/E» в RU-формате → автофикс в «ИНТ-ЭКСТ.»', () => {
    const issues = validateFormatBlocks([B('scene_header', '2. I/E. ДВОР — НОЧЬ', 'h1')], 'russian')
    const fmtIssue = issues.find((i) => i.id === 'fmt-h1-fmt')
    expect(fmtIssue?.suggestion).toBe('2. ИНТ-ЭКСТ. ДВОР — НОЧЬ')
  })
})

describe('validateFormatBlocks: ремарки и переходы', () => {
  it('ремарка без скобок → ошибка с автофиксом', () => {
    const issues = validateFormatBlocks([B('parenthetical', 'пауза', 'p1')], 'russian')
    const issue = issues.find((i) => i.id === 'fmt-p1-parens')
    expect(issue?.severity).toBe('error')
    expect(issue?.suggestion).toBe('(пауза)')
  })

  it('пустая ремарка «()» → предупреждение', () => {
    const issues = validateFormatBlocks([B('parenthetical', '()', 'p1')], 'russian')
    expect(issues.find((i) => i.id === 'fmt-p1-empty')?.severity).toBe('warning')
  })

  it('переход без двоеточия → предупреждение с автофиксом', () => {
    const issues = validateFormatBlocks([B('transition', 'МОНТАЖ', 't1')], 'russian')
    const issue = issues.find((i) => i.id === 'fmt-t1-colon')
    expect(issue?.suggestion).toBe('МОНТАЖ:')
  })

  it('переход «МОНТАЖ:» — 0 issues', () => {
    expect(validateFormatBlocks([B('transition', 'МОНТАЖ:')], 'russian')).toHaveLength(0)
  })
})
