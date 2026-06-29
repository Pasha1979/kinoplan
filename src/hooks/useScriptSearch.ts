import { useState, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Plugin, PluginKey } from 'prosemirror-state'

export type SearchBlockType = 'sceneHeader' | 'sceneCast' | 'sceneAction' | 'sceneCharacter' | 'sceneDialog' | 'sceneParenthetical' | 'sceneTransition'
export type SearchBlockFilter = SearchBlockType[]  // пустой массив = везде

export interface SearchMatch {
  from: number
  to: number
  text: string
  blockType: string
}

export const searchPluginKey = new PluginKey('scriptSearch')

export function useScriptSearch(editor: Editor | null) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SearchBlockFilter>([])
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isReplaceOpen, setIsReplaceOpen] = useState(false)
  const [replaceText, setReplaceText] = useState('')

  const matchesRef = useRef<SearchMatch[]>([])
  const currentIndexRef = useRef(0)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Запуск поиска (с дебаунсом для больших документов)
  const search = useCallback((q: string, f: SearchBlockFilter = filter) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!editor || !q.trim()) {
      setMatches([])
      matchesRef.current = []
      clearDecorations(editor)
      return
    }

    searchTimeoutRef.current = setTimeout(() => {
      const lowerQuery = q.toLowerCase()
      const found: SearchMatch[] = []
      const { doc } = editor.state

      doc.descendants((node, pos) => {
        const blockType = node.type.name
        const isTextBlock = ['sceneHeader', 'sceneCast', 'sceneAction', 'sceneCharacter', 'sceneDialog', 'sceneParenthetical', 'sceneTransition', 'paragraph'].includes(blockType)
        if (!isTextBlock || !node.isBlock) return

        if (f.length > 0 && !f.includes(blockType as SearchBlockType)) return

        const text = node.textContent
        const lowerText = text.toLowerCase()
        let idx = lowerText.indexOf(lowerQuery)

        while (idx !== -1) {
          // pos + 1 — начало текстового содержимого блока
          found.push({
            from: pos + 1 + idx,
            to: pos + 1 + idx + q.length,
            text: text.slice(idx, idx + q.length),
            blockType,
          })
          idx = lowerText.indexOf(lowerQuery, idx + 1)
        }
      })

      setMatches(found)
      matchesRef.current = found
      setCurrentIndex(0)
      currentIndexRef.current = 0

      applyDecorations(editor, found, 0)

      // Скролл к первому совпадению
      if (found.length > 0) {
        scrollToMatch(editor, found[0])
      }
    }, 150)
  }, [editor, filter])

  // Навигация вперёд
  const goNext = useCallback(() => {
    const m = matchesRef.current
    if (!m.length || !editor) return
    const next = (currentIndexRef.current + 1) % m.length
    currentIndexRef.current = next
    setCurrentIndex(next)
    applyDecorations(editor, m, next)
    scrollToMatch(editor, m[next])
  }, [editor])

  // Навигация назад
  const goPrev = useCallback(() => {
    const m = matchesRef.current
    if (!m.length || !editor) return
    const prev = (currentIndexRef.current - 1 + m.length) % m.length
    currentIndexRef.current = prev
    setCurrentIndex(prev)
    applyDecorations(editor, m, prev)
    scrollToMatch(editor, m[prev])
  }, [editor])

  // Открыть поиск
  const open = useCallback((replace = false) => {
    setIsOpen(true)
    setIsReplaceOpen(replace)
  }, [])

  // Закрыть поиск
  const close = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    setIsOpen(false)
    setIsReplaceOpen(false)
    setQuery('')
    setReplaceText('')
    setMatches([])
    matchesRef.current = []
    clearDecorations(editor)
  }, [editor])

  // Заменить текущее совпадение
  const replaceCurrent = useCallback(() => {
    const m = matchesRef.current
    if (!editor || !m.length) return
    // Безопасность: сбрасываем индекс если он вышел за границы
    if (currentIndexRef.current >= m.length) {
      currentIndexRef.current = 0
    }
    const match = m[currentIndexRef.current]
    if (!match) return
    editor.chain()
      .deleteRange({ from: match.from, to: match.to })
      .insertContentAt(match.from, replaceText)
      .run()
    // Сбрасываем индекс перед асинхронным перезапуском поиска
    currentIndexRef.current = 0
    setCurrentIndex(0)
    // Перезапускаем поиск после замены
    setTimeout(() => search(query, filter), 50)
  }, [editor, replaceText, query, filter, search])

  // Заменить все совпадения
  const replaceAll = useCallback(() => {
    const m = matchesRef.current
    if (!editor || !m.length) return
    // Заменяем с конца, чтобы не сбить позиции
    const sorted = [...m].sort((a, b) => b.from - a.from)
    const chain = editor.chain()
    sorted.forEach(match => {
      chain.deleteRange({ from: match.from, to: match.to })
        .insertContentAt(match.from, replaceText)
    })
    chain.run()
    // Сбрасываем индекс после массовой замены
    currentIndexRef.current = 0
    setCurrentIndex(0)
    setTimeout(() => search(query, filter), 50)
  }, [editor, replaceText, query, filter, search])

  return {
    query, setQuery,
    filter, setFilter,
    matches, currentIndex,
    isOpen, isReplaceOpen,
    replaceText, setReplaceText,
    search, goNext, goPrev,
    open, close,
    replaceCurrent, replaceAll,
  }
}

// --- Утилиты ---

function scrollToMatch(editor: Editor, match: SearchMatch) {
  const { view } = editor
  const domNode = view.nodeDOM(match.from)
  if (domNode instanceof HTMLElement) {
    domNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } else {
    // fallback — через координаты
    try {
      const coords = view.coordsAtPos(match.from)
      const editorEl = view.dom.parentElement
      if (editorEl) {
        editorEl.scrollTo({ top: coords.top + editorEl.scrollTop - 200, behavior: 'smooth' })
      }
    } catch {}
  }
}

function applyDecorations(editor: Editor, matches: SearchMatch[], currentIndex: number) {
  const { tr, doc } = editor.state
  const decorations: Decoration[] = matches.map((match, i) => {
    const isCurrent = i === currentIndex
    return Decoration.inline(match.from, match.to, {
      style: isCurrent
        ? 'background: #f97316; color: #fff; border-radius: 2px;'
        : 'background: #fbbf24; color: #111; border-radius: 2px;',
      class: isCurrent ? 'search-current' : 'search-match',
    })
  })

  const decoSet = DecorationSet.create(doc, decorations)
  const newTr = tr.setMeta(searchPluginKey, { decorations: decoSet })
  editor.view.dispatch(newTr)
}

function clearDecorations(editor: Editor | null) {
  if (!editor) return
  const { tr } = editor.state
  editor.view.dispatch(tr.setMeta(searchPluginKey, { decorations: DecorationSet.empty }))
}

// ProseMirror Plugin для хранения декораций
export function createSearchPlugin(): Plugin {
  return new Plugin({
    key: searchPluginKey,
    state: {
      init() {
        return DecorationSet.empty
      },
      apply(tr, old) {
        const meta = tr.getMeta(searchPluginKey)
        if (meta?.decorations !== undefined) {
          return meta.decorations
        }
        return old.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}
