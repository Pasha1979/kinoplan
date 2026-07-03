import { useRef, useCallback, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface MultiRange {
  from: number
  to: number
  blockType: string
}

const pluginKey = new PluginKey('multiCursor')

export function useMultiCursor() {
  const rangesRef = useRef<MultiRange[]>([])
  const isActiveRef = useRef(false)
  const [activeCount, setActiveCount] = useState(0)

  // ProseMirror plugin для отрисовки подсветок (decorations)
  const pluginRef = useRef(
    new Plugin({
      key: pluginKey,
      state: {
        init() { return DecorationSet.empty },
        apply(tr, oldSet) {
          const meta = tr.getMeta(pluginKey)
          if (meta?.decorations !== undefined) return meta.decorations
          return oldSet.map(tr.mapping, tr.doc)
        },
      },
      props: {
        decorations(state) { return this.getState(state) || DecorationSet.empty },
      },
    })
  )

  const updateDecorations = useCallback((editor: Editor | null) => {
    if (!editor) return
    const ranges = rangesRef.current
    if (ranges.length <= 1) {
      editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { decorations: DecorationSet.empty }))
      return
    }
    const decorations = ranges.map((range) =>
      Decoration.inline(range.from, range.to, { class: 'multi-cursor-selection' })
    )
    const set = DecorationSet.create(editor.state.doc, decorations)
    editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { decorations: set }))
  }, [])

  const exitMultiSelection = useCallback((editor: Editor | null) => {
    rangesRef.current = []
    isActiveRef.current = false
    setActiveCount(0)
    updateDecorations(editor)
  }, [updateDecorations])

  // Ctrl+D — добавить следующее совпадение (только в том же типе блока)
  const addNextMatch = useCallback((editor: Editor): boolean => {
    const { state } = editor
    const { selection, doc } = state
    const { from, to } = selection

    let searchText: string
    let searchFrom: number
    let searchBlockType: string

    if (rangesRef.current.length === 0) {
      // Первый Ctrl+D: если нет выделения — выделяем слово под курсором
      if (from === to) {
        const $pos = doc.resolve(from)
        const node = $pos.node()
        const text = node?.textContent || ''
        const posInNode = from - $pos.start()
        if (!text || posInNode < 0 || posInNode > text.length) return false
        const before = text.slice(0, posInNode).match(/[\p{L}\p{N}_\-']*$/u)
        const after = text.slice(posInNode).match(/^[\p{L}\p{N}_\-']*/u)
        const wordStart = posInNode - (before ? before[0].length : 0)
        const wordEnd = posInNode + (after ? after[0].length : 0)
        if (wordEnd === wordStart) return false
        searchText = text.slice(wordStart, wordEnd)
        searchFrom = $pos.start() + wordEnd
        searchBlockType = node?.type?.name || 'paragraph'
        rangesRef.current = [{
          from: $pos.start() + wordStart,
          to: $pos.start() + wordEnd,
          blockType: searchBlockType,
        }]
      } else {
        searchText = doc.textBetween(from, to)
        searchFrom = to
        const $pos = doc.resolve(from)
        searchBlockType = $pos.node()?.type?.name || 'paragraph'
        rangesRef.current = [{ from, to, blockType: searchBlockType }]
      }
    } else {
      const lastRange = rangesRef.current[rangesRef.current.length - 1]
      searchText = doc.textBetween(lastRange.from, lastRange.to)
      searchFrom = lastRange.to
      searchBlockType = lastRange.blockType
    }

    if (!searchText || rangesRef.current.length >= 50) return false

    let found: MultiRange | null = null
    doc.descendants((node, pos) => {
      if (found) return false
      if (node.type.name !== searchBlockType || !node.isBlock) return true
      const nodeText = node.textContent
      const startPos = pos + 1
      const searchStart = Math.max(0, searchFrom - startPos)
      const idx = nodeText.indexOf(searchText, searchStart)
      if (idx !== -1) {
        const matchFrom = startPos + idx
        const matchTo = matchFrom + searchText.length
        const alreadySelected = rangesRef.current.some(r => r.from === matchFrom && r.to === matchTo)
        if (!alreadySelected) {
          found = { from: matchFrom, to: matchTo, blockType: searchBlockType }
        }
      }
      return true
    })

    if (found) {
      rangesRef.current.push(found)
      isActiveRef.current = true
      setActiveCount(rangesRef.current.length)
      updateDecorations(editor)
      editor.chain().setTextSelection({ from: found.to, to: found.to }).run()
    }
    return !!found
  }, [updateDecorations])

  // Применить введённый текст ко всем ranges одной транзакцией
  const applyTextToRanges = useCallback((editor: Editor, text: string): boolean => {
    const ranges = rangesRef.current
    if (ranges.length <= 1) return false
    const originalRanges = [...ranges]
    const sorted = [...originalRanges].sort((a, b) => b.from - a.from)
    const tr = editor.state.tr
    sorted.forEach(range => { tr.insertText(text, range.from, range.to) })
    editor.view.dispatch(tr)
    const mapping = tr.mapping
    rangesRef.current = originalRanges.map(range => {
      const newFrom = mapping.map(range.from)
      return { from: newFrom, to: newFrom + text.length, blockType: range.blockType }
    })
    updateDecorations(editor)
    return true
  }, [updateDecorations])

  return {
    plugin: pluginRef.current,
    isActiveRef,
    rangesRef,
    activeCount,
    addNextMatch,
    exitMultiSelection,
    applyTextToRanges,
    updateDecorations,
  }
}
