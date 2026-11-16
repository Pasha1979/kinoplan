// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScriptEditorLogic } from './useScriptEditorLogic'
import { useUiStore } from '../store/uiStore'
import type { Editor } from '@tiptap/core'

// jsdom не реализует elementFromPoint — нужен Placeholder-расширению прода
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  ;(document as Document & { elementFromPoint: () => null }).elementFromPoint = () => null
}

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

// Реальный DOM-евент — проходит весь плагинный порядок прода
const enter = (editor: Editor) => {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  )
}

const blockTypes = (editor: Editor) => {
  const types: string[] = []
  editor.state.doc.forEach((n) => types.push(n.type.name))
  return types
}

/** Позиция в КОНЦЕ первого top-level блока нужного типа (как курсор набравшего) */
const posInside = (editor: Editor, type: string, occurrence = 0) => {
  let found: number | null = null
  editor.state.doc.forEach((n, pos) => {
    if (n.type.name === type && occurrence-- === 0 && found === null) found = pos + n.nodeSize - 1
  })
  return found!
}


beforeEach(() => {
  useUiStore.setState({ enterPreset: 'kinoplan' })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { useUiStore.setState({ enterPreset: 'kinoplan' }) })

describe('useScriptEditorLogic: Enter-цепочки (пресет kinoplan)', () => {
  it('шапка с «— ВРЕМЯ.» авто-переходит в состав, Enter в составе → действие', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    // Шапка с точкой после времени → авто-сплит в sceneCast (прод-фича onUpdate)
    act(() => { editor.commands.setContent('<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ.</div>') })
    expect(blockTypes(editor)).toContain('sceneCast')
    // Enter внутри состава → действие
    act(() => { editor.commands.setTextSelection(posInside(editor, 'sceneCast')) })
    act(() => { enter(editor) })
    expect(blockTypes(editor)).toContain('sceneAction')
    unmount()
  })

  it('Enter в шапке без точки → переход в состав', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => { editor.commands.setContent('<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ</div>') })
    act(() => { editor.commands.setTextSelection(posInside(editor, 'sceneHeader')) })
    act(() => { enter(editor) })
    const types = blockTypes(editor)
    const headerIdx = types.indexOf('sceneHeader')
    expect(types[headerIdx + 1]).toBe('sceneCast')
    unmount()
  })

  it('персонаж → реплика', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => { editor.commands.setContent('<div data-type="scene-character">ИВАН</div>') })
    act(() => { editor.commands.setTextSelection(posInside(editor, 'sceneCharacter')) })
    act(() => { enter(editor) })
    const types = blockTypes(editor)
    expect(types[types.indexOf('sceneCharacter') + 1]).toBe('sceneDialog')
    unmount()
  })

  it('пустой диалог + Enter → действие (двойной Enter)', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => { editor.commands.setContent('<div data-type="scene-dialog"></div>') })
    act(() => { editor.commands.setTextSelection(posInside(editor, 'sceneDialog')) })
    act(() => { enter(editor) })
    const types = blockTypes(editor)
    expect(types).toContain('sceneAction')
    unmount()
  })

  it('пустое действие + Enter (kinoplan) → paragraph, НЕ новая сцена', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => { editor.commands.setContent('<div data-type="scene-action"></div>') })
    act(() => { editor.commands.setTextSelection(posInside(editor, 'sceneAction')) })
    const before = blockTypes(editor).filter((t) => t === 'sceneHeader').length
    act(() => { enter(editor) })
    expect(blockTypes(editor).filter((t) => t === 'sceneHeader').length).toBe(before)
    expect(blockTypes(editor)).toContain('paragraph')
    unmount()
  })
})

describe('useScriptEditorLogic: пресет kit', () => {
  it('пустое действие + Enter (kit) → новая сцена с номером', async () => {
    useUiStore.setState({ enterPreset: 'kit' })
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => {
      editor.commands.setContent(
        '<div data-type="scene-header">1. ИНТ. ДОМ — ДЕНЬ</div><div data-type="scene-action"></div>'
      )
    })
    act(() => { editor.commands.setTextSelection(posInside(editor, 'sceneAction')) })
    act(() => { enter(editor) })
    expect(blockTypes(editor).filter((t) => t === 'sceneHeader')).toHaveLength(2)
    const lastHeader = editor.state.doc.child(
      blockTypes(editor).lastIndexOf('sceneHeader')
    )
    expect(lastHeader.textContent).toMatch(/^2\.\s*$/)
    unmount()
  })
})

describe('useScriptEditorLogic: автокапс и автонумерация', () => {
  it('«иван» в блоке персонажа → «ИВАН», курсор сохраняется', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => {
      editor.commands.setContent('<div data-type="scene-character"></div>')
      editor.commands.insertContent('иван')
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 150)) })
    expect(editor.state.doc.firstChild?.textContent).toBe('ИВАН')
    const { from } = editor.state.selection
    const nodeStart = editor.state.selection.$from.start()
    expect(from).toBe(nodeStart + 'ИВАН'.length)
    unmount()
  })

  it('автонумерация film: «инт.» → «1. ИНТ.»', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic({ ...baseOpts, projectType: 'film' }))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => {
      editor.commands.setContent('<div data-type="scene-header"></div>')
      editor.commands.insertContent('ИНТ. ДОМ — ДЕНЬ')
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 150)) })
    expect(editor.state.doc.firstChild?.textContent).toMatch(/^1\.\s*ИНТ\./)
    unmount()
  })

  it('автонумерация serial: «инт.» → «S-N. ИНТ.»', async () => {
    const { result, unmount } = renderHook(() =>
      useScriptEditorLogic({ ...baseOpts, projectType: 'serial', currentSeries: 3 })
    )
    await act(async () => {})
    const editor = result.current.editor!
    act(() => {
      editor.commands.setContent('<div data-type="scene-header"></div>')
      editor.commands.insertContent('ИНТ. ДОМ — ДЕНЬ')
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 150)) })
    expect(editor.state.doc.firstChild?.textContent).toMatch(/^3-1\.\s*ИНТ\./)
    unmount()
  })
})

describe('useScriptEditorLogic: спецсимволы и Shift+Enter', () => {
  it('имя с & и < не искажается при вставке через insertText', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => {
      editor.commands.setContent('<div data-type="scene-action"></div>')
      editor.chain().command(({ tr }) => { tr.insertText('ТОМ & ДЖЕРРИ <x>'); return true }).run()
    })
    expect(editor.state.doc.firstChild?.textContent).toBe('ТОМ & ДЖЕРРИ <x>')
    unmount()
  })

  it('Shift+Enter — мягкий перенос внутри блока (hardBreak)', async () => {
    const { result, unmount } = renderHook(() => useScriptEditorLogic(baseOpts))
    await act(async () => {})
    const editor = result.current.editor!
    act(() => {
      editor.commands.setContent('<div data-type="scene-dialog">Строка один</div>')
      editor.commands.setTextSelection(posInside(editor, 'sceneDialog'))
    })
    act(() => { editor.commands.setHardBreak() })
    const dialog = blockTypes(editor).filter((t) => t === 'sceneDialog')
    expect(dialog).toHaveLength(1) // блок не разделился
    let hasBreak = false
    editor.state.doc.forEach((n) => {
      if (n.type.name === 'sceneDialog') {
        n.forEach((c) => { if (c.type.name === 'hardBreak') hasBreak = true })
      }
    })
    expect(hasBreak).toBe(true)
    unmount()
  })
})
