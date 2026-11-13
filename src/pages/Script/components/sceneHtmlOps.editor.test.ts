// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneParenthetical } from '../../../components/tiptap'
import { replaceSceneInEditor } from './sceneHtmlOps'

const exts = [
  StarterKit.configure({
    orderedList: false, bulletList: false, listItem: false,
    codeBlock: false, blockquote: false, horizontalRule: false,
  }),
  SceneHeader, SceneCast, SceneAction, SceneCharacter,
  SceneDialog, SceneParenthetical, SceneTransition,
]

const DOC = [
  '<div data-type="scene-header" data-scene-id="uuid-1">1. ИНТ. ДОМ — ДЕНЬ.</div>',
  '<div data-type="scene-action">Сцена 1.</div>',
  '<div data-type="scene-header" data-scene-id="uuid-2">2. ЭКСТ. ЛЕС — НОЧЬ.</div>',
  '<div data-type="scene-action">Сцена 2.</div>',
  '<div data-type="scene-header" data-scene-id="uuid-3">3. ИНТ. САД — УТРО.</div>',
  '<div data-type="scene-action">Сцена 3.</div>',
].join('')

const mkEditor = (content: string) => new Editor({
  element: document.createElement('div'),
  extensions: exts,
  content,
})

// T-99: splice в живой документ одной транзакцией — undo/курсор живы
describe('replaceSceneInEditor (T-99)', () => {
  it('заменяет сцену по UUID, соседи и data-scene-id на месте', () => {
    const editor = mkEditor(DOC)
    const frag = '<div data-type="scene-header" data-scene-id="uuid-2">2. ЭКСТ. ЛЕС — НОЧЬ.</div><div data-type="scene-action">НОВАЯ-2</div>'
    expect(replaceSceneInEditor(editor, 'uuid-2', frag)).toBe(true)

    const html = editor.getHTML()
    expect(html).toContain('НОВАЯ-2')
    expect(html).toContain('Сцена 1.')
    expect(html).toContain('Сцена 3.')
    expect(html).toContain('data-scene-id="uuid-2"')
    expect(html).not.toContain('Сцена 2.')
    editor.destroy()
  })

  it('одна транзакция → один undo возвращает всю сцену', () => {
    const editor = mkEditor(DOC)
    const frag = '<div data-type="scene-header" data-scene-id="uuid-2">2. ЭКСТ. ЛЕС — НОЧЬ.</div><div data-type="scene-action">ЗАМЕНА</div>'
    replaceSceneInEditor(editor, 'uuid-2', frag)
    expect(editor.getHTML()).toContain('ЗАМЕНА')

    editor.commands.undo()
    const html = editor.getHTML()
    expect(html).toContain('Сцена 2.')
    expect(html).not.toContain('ЗАМЕНА')
    editor.destroy()
  })

  it('fallback по номеру, когда у шапки нет sceneId', () => {
    const noIds = DOC.replace(/ data-scene-id="[^"]*"/g, '')
    const editor = mkEditor(noIds)
    const frag = '<div data-type="scene-header">2. ЭКСТ. ЛЕС — НОЧЬ.</div><div data-type="scene-action">ПО-НОМЕРУ</div>'
    expect(replaceSceneInEditor(editor, 'unknown-id', frag, '2')).toBe(true)
    expect(editor.getHTML()).toContain('ПО-НОМЕРУ')
    editor.destroy()
  })

  it('сцена не найдена → false (вызывающий уходит в строковый splice)', () => {
    const editor = mkEditor(DOC)
    expect(replaceSceneInEditor(editor, 'uuid-nope', '<p>x</p>', '99')).toBe(false)
    expect(editor.getHTML()).toContain('Сцена 2.')
    editor.destroy()
  })
})
