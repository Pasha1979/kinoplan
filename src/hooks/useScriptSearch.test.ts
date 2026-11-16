// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createTestEditor } from '../test-utils/createTestEditor'
import { useScriptSearch } from './useScriptSearch'
import type { Editor } from '@tiptap/core'

const DOC = [
  '<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ.</div>',
  '<div data-type="scene-action">Иван смотрит в окно. Иван молчит.</div>',
  '<div data-type="scene-character">МАША</div>',
  '<div data-type="scene-dialog">Иван, иди сюда.</div>',
].join('')

describe('useScriptSearch', () => {
  let editor: Editor

  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.scrollIntoView = vi.fn()
    editor = createTestEditor({ content: DOC })
  })

  afterEach(() => {
    editor.destroy()
    vi.useRealTimers()
  })

  const runSearch = (result: { current: ReturnType<typeof useScriptSearch> }, q: string) => {
    act(() => { result.current.search(q) })
    act(() => { vi.advanceTimersByTime(200) })
  }

  it('находит все совпадения (регистронезависимо, кириллица)', () => {
    const { result } = renderHook(() => useScriptSearch(editor))
    runSearch(result, 'иван')
    expect(result.current.matches.length).toBe(3) // 2 в action + 1 в dialog
    expect(result.current.currentIndex).toBe(0)
  })

  it('goNext/goPrev ходят по кругу', () => {
    const { result } = renderHook(() => useScriptSearch(editor))
    runSearch(result, 'иван')
    act(() => result.current.goNext())
    expect(result.current.currentIndex).toBe(1)
    act(() => result.current.goNext())
    expect(result.current.currentIndex).toBe(2)
    act(() => result.current.goNext()) // круг → 0
    expect(result.current.currentIndex).toBe(0)
    act(() => result.current.goPrev()) // назад с 0 → последний
    expect(result.current.currentIndex).toBe(2)
  })

  it('пустой запрос → 0 совпадений', () => {
    const { result } = renderHook(() => useScriptSearch(editor))
    runSearch(result, '   ')
    expect(result.current.matches).toHaveLength(0)
  })

  it('запрос без совпадений → 0', () => {
    const { result } = renderHook(() => useScriptSearch(editor))
    runSearch(result, 'космодром')
    expect(result.current.matches).toHaveLength(0)
  })

  it('replaceCurrent заменяет текущее совпадение', () => {
    const { result } = renderHook(() => useScriptSearch(editor))
    runSearch(result, 'окно')
    expect(result.current.matches.length).toBe(1)
    act(() => { result.current.setReplaceText('занавеску') })
    act(() => { result.current.replaceCurrent() })
    expect(editor.getText()).toContain('занавеску')
    expect(editor.getText()).not.toContain('окно')
  })

  it('replaceAll заменяет все совпадения с конца (позиции не съезжают)', () => {
    const { result } = renderHook(() => useScriptSearch(editor))
    runSearch(result, 'иван')
    expect(result.current.matches.length).toBe(3)
    act(() => { result.current.setReplaceText('Пётр') })
    act(() => { result.current.replaceAll() })
    const text = editor.getText()
    expect(text).not.toMatch(/иван/i)
    expect(text.match(/Пётр/g)?.length).toBe(3)
  })

  it('позиции совпадений корректны (from/to указывают на текст)', () => {
    const { result } = renderHook(() => useScriptSearch(editor))
    runSearch(result, 'МАША')
    expect(result.current.matches.length).toBe(1)
    const m = result.current.matches[0]
    const slice = editor.state.doc.textBetween(m.from, m.to)
    expect(slice).toBe('МАША')
    expect(m.blockType).toBe('sceneCharacter')
  })

  it('open/close управляют состоянием панели', () => {
    const { result } = renderHook(() => useScriptSearch(editor))
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.open(true))
    expect(result.current.isReplaceOpen).toBe(true)
    runSearch(result, 'иван')
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.matches).toHaveLength(0)
  })
})
