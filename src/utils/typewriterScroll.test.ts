// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { SceneHeader, SceneAction } from '../components/tiptap'
import { centerCursorBlock } from './typewriterScroll'

const exts = [
  StarterKit.configure({
    orderedList: false, bulletList: false, listItem: false,
    codeBlock: false, blockquote: false, horizontalRule: false,
  }),
  SceneHeader, SceneAction,
]

const DOC = [
  '<div data-type="scene-header" data-scene-id="u1">1. ИНТ. ДОМ — ДЕНЬ.</div>',
  '<div data-type="scene-action">Сцена 1.</div>',
  '<div data-type="scene-header" data-scene-id="u2">2. ЭКСТ. ЛЕС — НОЧЬ.</div>',
  '<div data-type="scene-action">Сцена 2.</div>',
].join('')

const scrollSpy = vi.fn()

beforeEach(() => {
  scrollSpy.mockClear()
  Element.prototype.scrollIntoView = scrollSpy as unknown as typeof Element.prototype.scrollIntoView
})

describe('centerCursorBlock (T-105)', () => {
  it('центрирует блок, в котором стоит курсор', () => {
    const editor = new Editor({ element: document.createElement('div'), extensions: exts, content: DOC })
    // курсор в «Сцена 2.» (последний блок)
    const pos = editor.state.doc.content.size - 1
    editor.commands.setTextSelection(pos)
    centerCursorBlock(editor)
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center' })
    const el = scrollSpy.mock.calls[0] && (scrollSpy.mock.instances[0] as HTMLElement)
    expect(el?.getAttribute('data-type')).toBe('scene-action')
    expect(el?.textContent).toBe('Сцена 2.')
    editor.destroy()
  })

  it('курсор в шапке — центрируется шапка, а не сосед', () => {
    const editor = new Editor({ element: document.createElement('div'), extensions: exts, content: DOC })
    editor.commands.setTextSelection(3) // внутри первой шапки
    centerCursorBlock(editor)
    const el = scrollSpy.mock.instances[0] as HTMLElement
    expect(el?.getAttribute('data-type')).toBe('scene-header')
    editor.destroy()
  })
})
