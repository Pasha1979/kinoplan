// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { buildScenesExportHtml, wrapAsWordDoc } from './exportScenes'
import type { Scene } from '../store/scriptStore'

const CONTENT = [
  '<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ</div>',
  '<div data-type="scene-action">Действие первой сцены.</div>',
  '<div data-type="scene-header">2. ЭКСТ. УЛИЦА — НОЧЬ</div>',
  '<div data-type="scene-action">Действие второй сцены.</div>',
].join('')

const scenes = [
  { id: 'sc-1', number: '1' },
  { id: 'sc-2', number: '2' },
] as Scene[]

const script = { content: CONTENT, format: 'russian' as const }

describe('buildScenesExportHtml', () => {
  it('экспортирует все сцены при selectedIds=null', () => {
    const html = buildScenesExportHtml(script, scenes, null)
    expect(html).toContain('ДОМ')
    expect(html).toContain('УЛИЦА')
  })

  it('экспортирует только выбранные сцены', () => {
    const html = buildScenesExportHtml(script, scenes, new Set(['sc-2']))
    expect(html).not.toContain('ДОМ')
    expect(html).toContain('УЛИЦА')
    expect(html).toContain('Действие второй сцены')
  })

  it('применяет inline-стили из SCRIPT_STYLES', () => {
    const html = buildScenesExportHtml(script, scenes, null)
    expect(html).toContain('Courier New')
    expect(html).toMatch(/margin-left: 6\.75cm|text-transform: uppercase/)
  })
})

describe('wrapAsWordDoc', () => {
  it('оборачивает в Word-совместимый документ', () => {
    const doc = wrapAsWordDoc('<p>x</p>', 'Тест')
    expect(doc).toContain('xmlns:w')
    expect(doc).toContain('<title>Тест</title>')
    expect(doc).toContain('<body><p>x</p></body>')
  })
})
