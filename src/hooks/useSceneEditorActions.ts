import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { extractScenesFromDocument } from '../utils/sceneExtractor'
import { SCENE_NUMBER } from '../utils/sceneNumber'
import type { TimingSystem } from '../store/scriptStore'

interface SceneUpdateEntry {
  id: string
  number: string
}

interface UseSceneEditorActionsOptions {
  editor: Editor | null
  focusSceneId: string | undefined
  onReorderReady: ((fn: (fromIndex: number, toIndex: number, newNumbers?: SceneUpdateEntry[]) => void) => void) | undefined
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
    precisePagesRef,
    timingSystem,
    genreCoefficient,
    onScenesChange,
    onStatsChange,
  } = options

  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref'ы для callback'ов — избегаем stale closures (обновляем в useEffect)
  const onScenesChangeRef = useRef(onScenesChange)
  const onStatsChangeRef = useRef(onStatsChange)
  const timingSystemRef = useRef(timingSystem)
  const genreCoefficientRef = useRef(genreCoefficient)

  useEffect(() => {
    onScenesChangeRef.current = onScenesChange
    onStatsChangeRef.current = onStatsChange
    timingSystemRef.current = timingSystem
    genreCoefficientRef.current = genreCoefficient
  }, [onScenesChange, onStatsChange, timingSystem, genreCoefficient])

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
        // T-101: сначала по стабильному UUID, номер — fallback для старых вызовов
        const byId = node.attrs.sceneId === focusSceneId
        const headerText = node.textContent
        const headerMatch = headerText.match(new RegExp(`^(${SCENE_NUMBER})\\.`))
        if (byId || (headerMatch && headerMatch[1] === focusSceneId)) {
          found = true
          scrollPos = pos
          const domNode = editor.view.nodeDOM(pos) as HTMLElement | null
          if (domNode) {
            domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }
      }
    })

    if (scrollPos !== null) {
      timeoutId = setTimeout(() => {
        const domNode = editor.view.nodeDOM(scrollPos!) as HTMLElement | null
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

    const handleReorder = (fromIndex: number, toIndex: number, newNumbers?: SceneUpdateEntry[]) => {
      if (!editor) return
      if (fromIndex < 0 || toIndex < 0) return
      if (fromIndex === toIndex) return

      const doc = editor.state.doc
      if (doc.childCount === 0) return

      // Собираем позиции всех sceneHeader на верхнем уровне (ProseMirror content positions)
      const sceneHeaders: { from: number; to: number }[] = []
      let pos = 0
      for (let i = 0; i < doc.childCount; i++) {
        const node = doc.child(i)
        const nodeFrom = pos
        const nodeTo = pos + node.nodeSize
        if (node.type.name === 'sceneHeader') {
          sceneHeaders.push({ from: nodeFrom, to: nodeTo })
        }
        pos = nodeTo
      }

      if (sceneHeaders.length === 0) return
      if (fromIndex >= sceneHeaders.length || toIndex >= sceneHeaders.length) return

      // Границы сцен: от начала sceneHeader до начала следующей sceneHeader (или конец документа)
      const fromStart = sceneHeaders[fromIndex].from
      const fromEnd = fromIndex + 1 < sceneHeaders.length
        ? sceneHeaders[fromIndex + 1].from
        : doc.content.size

      const toStart = sceneHeaders[toIndex].from
      const toEnd = toIndex + 1 < sceneHeaders.length
        ? sceneHeaders[toIndex + 1].from
        : doc.content.size

      const removedSize = fromEnd - fromStart

      // Создаём ProseMirror транзакцию: delete + insert = одно undo-шаг
      const tr = editor.state.tr

      // 1. Запоминаем содержимое вырезаемой сцены
      const slice = doc.slice(fromStart, fromEnd)

      // 2. Вырезаем сцену
      tr.delete(fromStart, fromEnd)

      // 3. Считаем позицию вставки с учётом смещения после удаления
      let insertPos: number
      if (fromIndex < toIndex) {
        // Двигаем вперёд: удаление было ДО toEnd → toEnd сдвинулся на removedSize назад
        insertPos = toEnd - removedSize
      } else {
        // Двигаем назад: удаление было ПОСЛЕ toStart → toStart не изменился
        insertPos = toStart
      }

      // 4. Вставляем сцену на новое место
      tr.insert(insertPos, slice.content)

      // 5. Перенумерация — В ТОЙ ЖЕ транзакции (T-43): один dispatch, один undo-шаг.
      // Позиции считаем по tr.doc (после перестановки), применяем в обратном порядке.
      if (newNumbers?.length) {
        const changes: { from: number; to: number; newText: string }[] = []
        let sceneIndex = 0
        tr.doc.descendants((node, pos) => {
          if (node.type.name !== 'sceneHeader' || sceneIndex >= newNumbers.length) return
          const text = node.textContent
          const headerMatch = text.match(new RegExp(`^(${SCENE_NUMBER})\\.`))
          if (!headerMatch) { sceneIndex++; return }
          const newNumber = newNumbers[sceneIndex].number
          sceneIndex++
          if (headerMatch[1] === newNumber) return
          const newText = text.replace(new RegExp(`^(${SCENE_NUMBER})\\.`), `${newNumber}.`)
          changes.push({ from: pos + 1, to: pos + 1 + text.length, newText })
        })
        for (let i = changes.length - 1; i >= 0; i--) {
          const { from, to, newText } = changes[i]
          tr.insertText(newText, from, to)
        }
      }

      // 6. Применяем как единое действие (сохраняется в undo-истории)
      editor.view.dispatch(tr)

      if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current)
      reorderTimeoutRef.current = setTimeout(() => {
        if (editor) {
          const { scenes: extractedScenes, stats } = extractScenesFromDocument({
            doc: editor.state.doc,
            forcedPages: precisePagesRef.current,
            precisePagesFallback: precisePagesRef.current,
            timingSystem: timingSystemRef.current,
            genreCoefficient: genreCoefficientRef.current,
          })
          onScenesChangeRef.current?.(extractedScenes)
          onStatsChangeRef.current?.(stats)
        }
      }, 100)
    }

    onReorderReady(handleReorder)
  }, [editor, onReorderReady, precisePagesRef, timingSystem, genreCoefficient])

  // T-43: отдельной транзакции перенумерации больше нет — номера применяются
  // внутри транзакции перестановки (handleReorder, шаг 5). appendedTransaction
  // удалён полностью: один Ctrl+Z атомарно отменяет порядок и номера.
}
