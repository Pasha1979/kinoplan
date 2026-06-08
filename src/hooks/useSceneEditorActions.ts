import { useEffect, useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { extractScenesFromDocument } from '../utils/sceneExtractor'
import type { TimingSystem } from '../store/scriptStore'

interface SceneUpdateEntry {
  id: string
  number: string
}

interface UseSceneEditorActionsOptions {
  editor: Editor | null
  focusSceneId: string | undefined
  onReorderReady: ((fn: (fromIndex: number, toIndex: number) => void) => void) | undefined
  onUpdateNumbersReady: ((fn: (scenes: SceneUpdateEntry[]) => void) => void) | undefined
  precisePagesRef: React.MutableRefObject<number>
  timingSystem: TimingSystem
  genreCoefficient: number
  onScenesChange?: (scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number; charCount: number }>) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
}

/**
 * Хук для управления сценами в редакторе:
 * - scroll к сцене по focusSceneId
 * - перестановка сцен (drag-and-drop)
 * - обновление номеров сцен
 */
export function useSceneEditorActions(options: UseSceneEditorActionsOptions) {
  const {
    editor,
    focusSceneId,
    onReorderReady,
    onUpdateNumbersReady,
    precisePagesRef,
    timingSystem,
    genreCoefficient,
    onScenesChange,
    onStatsChange,
  } = options

  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref'ы для callback'ов — избегаем stale closures
  const onScenesChangeRef = useRef(onScenesChange)
  const onStatsChangeRef = useRef(onStatsChange)
  onScenesChangeRef.current = onScenesChange
  onStatsChangeRef.current = onStatsChange

  // Очистка таймаута при unmount
  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current)
        reorderTimeoutRef.current = null
      }
    }
  }, [])

  // 1. Scroll к сцене при изменении focusSceneId
  useEffect(() => {
    if (!editor || !focusSceneId) return
    let found = false
    let scrollPos: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    editor.state.doc.descendants((node, pos) => {
      if (found) return false
      if (node.type.name === 'sceneHeader') {
        const headerText = node.textContent
        const headerMatch = headerText.match(/^(\d+(?:-\d+)?)\./)
        if (headerMatch) {
          const sceneNum = headerMatch[1]
          if (focusSceneId === sceneNum) {
            found = true
            scrollPos = pos
            const domNode = editor.view.nodeDOM(pos) as HTMLElement | null
            if (domNode) {
              domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        }
      }
    })

    if (scrollPos !== null) {
      timeoutId = setTimeout(() => {
        const domNode = editor.view.nodeDOM(scrollPos) as HTMLElement | null
        if (domNode) {
          domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 500)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [focusSceneId, editor])

  // 2. Регистрация handleReorder для drag-and-drop
  useEffect(() => {
    if (!editor || !onReorderReady) return

    const handleReorder = (fromIndex: number, toIndex: number) => {
      if (!editor) return
      if (fromIndex < 0 || toIndex < 0) return
      if (fromIndex === toIndex) return

      const doc = editor.getJSON()
      const content = doc.content || []
      if (content.length === 0) return

      const sceneIndices: number[] = []
      content.forEach((node: { type?: string }, index: number) => {
        if (node.type === 'sceneHeader') sceneIndices.push(index)
      })

      if (sceneIndices.length === 0) return
      if (fromIndex >= sceneIndices.length || toIndex >= sceneIndices.length) return

      const fromStart = sceneIndices[fromIndex]
      const toStart = sceneIndices[toIndex]

      const findSceneEnd = (startIndex: number) => {
        for (let i = startIndex + 1; i < content.length; i++) {
          if (content[i].type === 'sceneHeader') return i
        }
        return content.length
      }

      const fromEnd = findSceneEnd(fromStart)
      const toEnd = findSceneEnd(toStart)

      const sceneNodes = content.slice(fromStart, fromEnd)
      const newContent = [...content]

      newContent.splice(fromStart, fromEnd - fromStart)

      const newInsertPos = fromIndex < toIndex
        ? toEnd - (fromEnd - fromStart)
        : toStart

      newContent.splice(newInsertPos, 0, ...sceneNodes)
      editor.commands.setContent({ type: 'doc', content: newContent })

      if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current)
      reorderTimeoutRef.current = setTimeout(() => {
        if (editor) {
          const { scenes: extractedScenes, stats } = extractScenesFromDocument({
            doc: editor.state.doc,
            forcedPages: precisePagesRef.current,
            precisePagesFallback: precisePagesRef.current,
            timingSystem,
            genreCoefficient,
          })
          onScenesChangeRef.current?.(extractedScenes)
          onStatsChangeRef.current?.(stats)
        }
      }, 100)
    }

    onReorderReady(handleReorder)
  }, [editor, onReorderReady, precisePagesRef, timingSystem, genreCoefficient])

  // 3. Обновление номеров сцен
  const updateSceneNumbers = useCallback((scenes: SceneUpdateEntry[]) => {
    if (!editor) return
    if (!scenes || scenes.length === 0) return

    const doc = editor.getJSON()
    const content = doc.content || []
    if (content.length === 0) return

    let sceneIndex = 0

    type JSONNode = {
      type?: string
      content?: Array<{ type?: string; text?: string; [key: string]: unknown }>
      [key: string]: unknown
    }

    const newContent = content.map((node: JSONNode) => {
      if (node.type === 'sceneHeader' && node.content && node.content[0] && sceneIndex < scenes.length) {
        const text = node.content[0].text || ''
        const headerMatch = text.match(/^(\d+(?:-\d+)?)\./)

        if (headerMatch) {
          const oldNumber = headerMatch[1]
          const newNumber = scenes[sceneIndex].number
          sceneIndex++

          if (oldNumber !== newNumber) {
            return {
              ...node,
              content: [
                { ...node.content[0], text: text.replace(/^(\d+(?:-\d+)?)\./, `${newNumber}.`) },
                ...node.content.slice(1),
              ],
            }
          }
        }
      }

      return node
    })

    editor.commands.setContent({ type: 'doc', content: newContent })
  }, [editor])

  const updateSceneNumbersRef = useRef(updateSceneNumbers)
  // eslint-disable-next-line react-hooks/refs
  updateSceneNumbersRef.current = updateSceneNumbers

  // Регистрация updateSceneNumbers для вызова извне
  useEffect(() => {
    if (!editor || !onUpdateNumbersReady) return
    onUpdateNumbersReady((scenes) => updateSceneNumbersRef.current(scenes))
  }, [editor, onUpdateNumbersReady])
}
