// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createTestEditor } from '../test-utils/createTestEditor'
import { useSceneEditorActions } from './useSceneEditorActions'
import type { Editor } from '@tiptap/core'
import type React from 'react'

const HEADER = (n: string, uuid: string) => `<div data-type="scene-header" data-scene-id="${uuid}">${n}. ИНТ. ЛОКАЦИЯ — ДЕНЬ.</div>`
const ACTION = (t: string) => `<div data-type="scene-action">${t}</div>`

type ReorderFn = (from: number, to: number, newNumbers?: { id: string; number: string }[]) => void

const makeOptions = (over: Partial<Parameters<typeof useSceneEditorActions>[0]> = {}) => ({
  editor: null as Editor | null,
  focusSceneId: undefined as string | undefined,
  onReorderReady: undefined as ((fn: ReorderFn) => void) | undefined,
  precisePagesRef: { current: 0 } as React.MutableRefObject<number>,
  timingSystem: 'page' as const,
  genreCoefficient: 1,
  ...over,
})

describe('useSceneEditorActions: фокус на сцену', () => {
  let editor: Editor
  let scrollSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy as unknown as typeof Element.prototype.scrollIntoView
    editor = createTestEditor({
      content: HEADER('1-8-А', 'uuid-a') + ACTION('A') + HEADER('2', 'uuid-b') + ACTION('B'),
    })
    editor.commands.setContent(editor.getHTML()) // назначаем sceneId плагину
  })

  afterEach(() => { editor.destroy(); vi.useRealTimers() })

  const headerId = (i: number) => {
    let id = ''
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'sceneHeader' && !id && i-- === 0) id = n.attrs.sceneId
    })
    return id
  }

  it('фокус по UUID («id»-канал) скроллит к шапке', () => {
    const id = headerId(1) // вторая шапка
    renderHook(() => useSceneEditorActions(makeOptions({ editor, focusSceneId: id })))
    act(() => { vi.advanceTimersByTime(600) })
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('фокус «id|номер» — номер-канал с кириллической литерой матчит латинскую', () => {
    // шапка «1-8-А» с КИРИЛЛИЧЕСКОЙ А; фокус «x|1-8-a» латинской
    renderHook(() => useSceneEditorActions(makeOptions({ editor, focusSceneId: 'unknown-id|1-8-a' })))
    act(() => { vi.advanceTimersByTime(600) })
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('фокус «id|номер» по UUID в паре «id|номер»', () => {
    const id = headerId(1)
    renderHook(() => useSceneEditorActions(makeOptions({ editor, focusSceneId: `${id}|99` })))
    act(() => { vi.advanceTimersByTime(600) })
    expect(scrollSpy).toHaveBeenCalled()
  })
})

describe('useSceneEditorActions: reorder одной транзакцией', () => {
  let editor: Editor
  let reorder: ReorderFn

  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.scrollIntoView = vi.fn()
    editor = createTestEditor({
      content:
        HEADER('1', 'uuid-1') + ACTION('Сцена 1') +
        HEADER('2', 'uuid-2') + ACTION('Сцена 2') +
        HEADER('3', 'uuid-3') + ACTION('Сцена 3'),
    })
    editor.commands.setContent(editor.getHTML())
    renderHook(() => useSceneEditorActions(makeOptions({
      editor,
      onReorderReady: (fn) => { reorder = fn },
    })))
  })

  afterEach(() => { editor.destroy(); vi.useRealTimers() })

  const headerTexts = () => {
    const texts: string[] = []
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'sceneHeader') texts.push(n.textContent)
    })
    return texts
  }

  it('перестановка 0→2 двигает сцену в конец', () => {
    act(() => { reorder(0, 2) })
    const texts = headerTexts()
    expect(texts[0]).toContain('2. ИНТ')
    expect(texts[2]).toContain('1. ИНТ')
  })

  it('reorder + перенумерация — один undo-шаг', () => {
    const before = editor.getHTML()
    act(() => {
      reorder(0, 2, [
        { id: 'uuid-2', number: '1' },
        { id: 'uuid-3', number: '2' },
        { id: 'uuid-1', number: '3' },
      ])
    })
    const texts = headerTexts()
    expect(texts[0]).toContain('1. ИНТ') // uuid-2 перенумерован в 1
    expect(texts[2]).toContain('3. ИНТ') // uuid-1 перенумерован в 3
    // один Ctrl+Z откатывает И перестановку, И номера
    act(() => { editor.commands.undo() })
    expect(editor.getHTML()).toBe(before)
  })

  it('reorder вне границ — no-op', () => {
    const before = editor.getHTML()
    act(() => { reorder(0, 0) })
    act(() => { reorder(-1, 5) })
    expect(editor.getHTML()).toBe(before)
  })
})
