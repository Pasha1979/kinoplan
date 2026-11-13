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

describe('buildPrintableHtml', () => {
  it('содержит @page A4 и поля КИТ', async () => {
    const { buildPrintableHtml } = await import('./exportScenes')
    const html = buildPrintableHtml(script, scenes, null)
    expect(html).toContain('@page { size: A4; margin: 2cm 2cm 2cm 3cm; }')
    expect(html).toContain('ДОМ')
  })

  it('добавляет титульный лист при titlePage.print', async () => {
    const { buildPrintableHtml } = await import('./exportScenes')
    const withTitle = {
      ...script,
      title: 'Фильм',
      titlePage: {
        title: 'ФИЛЬМ', writtenBy: 'ИВАНОВ', basedOn: '', director: 'ПЕТРОВ',
        company: '', email: '', phone: '', address: '', draftNumber: 'v2', date: '13.11', print: true,
      },
    }
    const html = buildPrintableHtml(withTitle as never, scenes, null)
    expect(html).toContain('title-page')
    expect(html).toContain('ФИЛЬМ')
    expect(html).toContain('ИВАНОВ')
    expect(html).toContain('page-break-after: always')
  })

  it('без titlePage.print титульного листа нет', async () => {
    const { buildPrintableHtml } = await import('./exportScenes')
    const html = buildPrintableHtml(script, scenes, null)
    expect(html).not.toContain('<div class="title-page">')
  })
})
