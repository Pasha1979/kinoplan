// @vitest-environment jsdom
import { it, expect } from 'vitest'
import { createTestEditor } from './createTestEditor'
it('создаёт редактор со script-нодами', () => {
  const e = createTestEditor({ content: '<div data-type="scene-header">ИНТ. ДОМ — ДЕНЬ</div>' })
  expect(e.state.doc.firstChild?.type.name).toBe('sceneHeader')
  e.destroy()
})
it('sceneIdAssign присваивает sceneId новой шапке при транзакции', () => {
  const e = createTestEditor()
  e.commands.setContent('<div data-type="scene-header">ИНТ. ДОМ — ДЕНЬ</div>')
  expect(e.state.doc.firstChild?.attrs.sceneId).toBeTruthy()
  e.destroy()
})
it('пустой редактор — paragraph', () => {
  const e = createTestEditor()
  expect(e.state.doc.firstChild?.type.name).toBe('paragraph')
  e.destroy()
})
