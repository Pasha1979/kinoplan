// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneParenthetical } from '../../../components/tiptap'
import { replaceSceneInEditor, setEditorContentNoHistory, extractSceneHtml } from './sceneHtmlOps'
import { spliceSceneHtml } from './SceneEditModal'

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

// T-136/ЧАСТЬ 4: инлайн-правка сцены в «каркасе» сохраняется в контент.
// Путь OutlineView: extractSceneHtml → встроенный редактор → getHTML →
// onSaveSceneHtml → replaceSceneInEditor (открытая серия) / spliceSceneHtml (другая серия)
describe('каркас: правка сцены → контент обновлён', () => {
  it('extract → правка → replace по UUID: документ обновлён, соседи целы', () => {
    const editor = mkEditor(DOC)
    // то же, что getOutlineSceneHtml в ScriptPage
    const frag = extractSceneHtml(editor.getHTML(), '2', 1, 'uuid-2')
    expect(frag).toContain('Сцена 2.')
    expect(frag).toContain('data-scene-id="uuid-2"')
    // «правка» во встроенном редакторе: дописан блок в конец сцены
    const edited = frag + '<div data-type="scene-action">ДОБАВЛЕНО ИЗ КАРКАСА.</div>'
    // то же, что handleSaveSceneHtml для открытой серии
    expect(replaceSceneInEditor(editor, 'uuid-2', edited, '2')).toBe(true)
    const html = editor.getHTML()
    expect(html).toContain('ДОБАВЛЕНО ИЗ КАРКАСА.')
    expect(html).toContain('Сцена 1.')
    expect(html).toContain('Сцена 3.')
    expect(html).toContain('data-scene-id="uuid-2"')
    editor.destroy()
  })

  it('другая серия (строковый путь): spliceSceneHtml обновляет content', () => {
    const frag = extractSceneHtml(DOC, '2', 1, 'uuid-2')
    const edited = frag + '<div data-type="scene-action">ИЗ КАРКАСА-2.</div>'
    const next = spliceSceneHtml(DOC, '2', 1, edited, 'uuid-2')
    expect(next).toContain('ИЗ КАРКАСА-2.')
    expect(next).toContain('Сцена 1.')
    expect(next).toContain('Сцена 3.')
    expect(next).toContain('data-scene-id="uuid-2"')
  })

  it('extract по номеру без sceneId (fallback) тоже находит сцену', () => {
    const noIds = DOC.replace(/ data-scene-id="[^"]*"/g, '')
    const frag = extractSceneHtml(noIds, '2', 1)
    expect(frag).toContain('Сцена 2.')
  })
})

// T-107: запись контента доски вне истории PM — стеки undo разведены
describe('setEditorContentNoHistory (T-107)', () => {
  it('заменяет контент, но Ctrl+Z редактора его не видит', () => {
    const editor = mkEditor(DOC)
    setEditorContentNoHistory(
      editor,
      '<div data-type="scene-header" data-scene-id="uuid-x">1. ИНТ. НОВЫЙ — ДЕНЬ.</div><div data-type="scene-action">Только одна сцена.</div>',
    )
    expect(editor.getHTML()).toContain('НОВЫЙ')
    expect(editor.getHTML()).not.toContain('Сцена 1.')
    // запись не попала в историю → undo нечего откатывать
    expect(editor.can().undo()).toBe(false)
    editor.commands.undo()
    expect(editor.getHTML()).toContain('НОВЫЙ')
    editor.destroy()
  })

  it('обычная печать после записи доски отменяет только печать', () => {
    const editor = mkEditor(DOC)
    setEditorContentNoHistory(editor, '<div data-type="scene-action">НОВЫЙ-БАЗА</div>')
    editor.commands.insertContent('<div data-type="scene-action">НАПЕЧАТАНО</div>')
    expect(editor.getHTML()).toContain('НАПЕЧАТАНО')
    editor.commands.undo()
    // undo снял печать, но НЕ запись доски
    expect(editor.getHTML()).toContain('НОВЫЙ-БАЗА')
    expect(editor.getHTML()).not.toContain('НАПЕЧАТАНО')
    expect(editor.can().undo()).toBe(false)
    editor.destroy()
  })
})
