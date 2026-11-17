// @vitest-environment jsdom
// T-135: орфография RU — редактор с spellcheck+lang=ru,
// служебные блоки с именами/локациями — без проверки орфографии
import { describe, it, expect, beforeAll } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createTestEditor } from '../../test-utils/createTestEditor'
import { useScriptEditorLogic } from '../../hooks/useScriptEditorLogic'

beforeAll(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
  if (!document.elementFromPoint) {
    ;(document as Document & { elementFromPoint: () => null }).elementFromPoint = () => null
  }
})

const baseOpts = {
  format: 'russian' as const,
  projectType: 'film' as const,
  projectId: 'p1',
  currentSeries: 0,
  fontFamily: 'Courier New',
  fontSize: 12,
  isDark: true,
  genreCoefficient: 1,
  timingSystem: 'page' as const,
}

describe('T-135: орфография в редакторе', () => {
  it('элемент редактора: spellcheck=true, lang=ru', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const dom = result.current.editor!.view.dom as HTMLElement
    expect(dom.getAttribute('spellcheck')).toBe('true')
    expect(dom.getAttribute('lang')).toBe('ru')
    unmount()
  })

  it('служебные блоки (шапка/состав/имя) рендерятся со spellcheck=false', () => {
    const editor = createTestEditor()
    editor.commands.setContent([
      '<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ.</div>',
      '<div data-type="scene-cast">ИВАН, МАРИЯ</div>',
      '<div data-type="scene-character">ИВАН</div>',
      '<div data-type="scene-dialog">Привет.</div>',
      '<div data-type="scene-action">Обычная ремарка.</div>',
    ].join(''))
    const dom = editor.view.dom as HTMLElement
    for (const type of ['scene-header', 'scene-cast', 'scene-character']) {
      const el = dom.querySelector(`div[data-type="${type}"]`)
      expect(el?.getAttribute('spellcheck'), type).toBe('false')
    }
    // текстовые блоки — без атрибута (наследуют проверку редактора)
    expect(dom.querySelector('div[data-type="scene-dialog"]')?.getAttribute('spellcheck')).toBeNull()
    expect(dom.querySelector('div[data-type="scene-action"]')?.getAttribute('spellcheck')).toBeNull()
    editor.destroy()
  })
})
