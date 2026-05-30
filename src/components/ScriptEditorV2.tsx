import { useState, useRef, useCallback } from 'react'
import type { ScriptFormat } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'

type BlockType = 'scene_header' | 'scene_cast' | 'action' | 'character' | 'dialog' | 'parenthetical' | 'transition' | 'empty'

interface Line {
  id: string
  type: BlockType
  content: string
}

interface ScriptEditorV2Props {
  format: ScriptFormat
  projectType: ProjectType
  currentSeries: number
  fontFamily: string
  fontSize: number
  isDark: boolean
  onSceneCountChange?: (count: number) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
  onBlocksChange?: (blocks: Line[]) => void
  onScenesChange?: (scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number }>) => void
  focusSceneId?: string
}

export default function ScriptEditorV2({
  format, projectType, currentSeries, fontFamily, fontSize, isDark,
  onSceneCountChange, onStatsChange, onBlocksChange, onScenesChange
}: ScriptEditorV2Props) {
  const [lines, setLines] = useState<Line[]>([
    { id: '1', type: 'scene_header', content: '' }
  ])
  const [showTutorial, setShowTutorial] = useState(true)
  const editorRef = useRef<HTMLDivElement>(null)
  const isUpdatingRef = useRef(false)

  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const editorBg = isDark ? '#111126' : '#fefefe'

  // ─── АВТООПРЕДЕЛЕНИЕ ТИПА СТРОКИ ─────────────────────────────────────
  const detectLineType = (content: string, prevType: BlockType): BlockType => {
    const trimmed = content.trim()
    if (trimmed === '') return 'empty'

    // Scene header: ИНТ. / ЭКСТ. / НАТ. в начале или с номером
    if (/^(\d+\.\s*)?(ИНТ\.?|ЭКСТ\.?|НАТ\.?)/i.test(trimmed)) return 'scene_header'
    if (/^(INT\.?|EXT\.?)/i.test(trimmed)) return 'scene_header'

    // Parenthetical: в скобках
    if (/^\(.*\)$/.test(trimmed)) return 'parenthetical'

    // Character: КАПСЛОК (для русского — все заглавные, короткая строка)
    if (/^[А-ЯA-Z][А-ЯA-Z\s\.]+$/.test(trimmed) && trimmed.length < 40 && !trimmed.includes('.')) {
      // Но не переход
      if (!/^(НАПЛЫВ|РАСТЯЖКА|СМЕНА|ЗАТЕМНЕНИЕ|ПЕРЕХОД)/i.test(trimmed)) {
        return 'character'
      }
    }

    // Transition
    if (/^(НАПЛЫВ|РАСТЯЖКА|СМЕНА|ЗАТЕМНЕНИЕ|ПЕРЕХОД|FADE IN|FADE OUT|CUT TO|DISSOLVE)/i.test(trimmed)) {
      return 'transition'
    }

    // Dialog: идёт после character
    if (prevType === 'character' || prevType === 'parenthetical') return 'dialog'

    // Scene cast: если предыдущая — шапка и это не пустая строка
    if (prevType === 'scene_header') {
      // Проверяем, похоже ли это на список персонажей (через запятую)
      if (/^[А-Я][а-я]+(,\s*[А-Я][а-я]+)*$/i.test(trimmed)) return 'scene_cast'
    }

    // По умолчанию — action
    return 'action'
  }

  // ─── ПАРСИНГ ВСЕГО ТЕКСТА ────────────────────────────────────────────
  const parseAllLines = useCallback((rawLines: string[]): Line[] => {
    const result: Line[] = []
    let prevType: BlockType = 'empty'

    for (let i = 0; i < rawLines.length; i++) {
      const content = rawLines[i]
      const type = detectLineType(content, prevType)
      result.push({ id: crypto.randomUUID(), type, content })
      if (type !== 'empty') prevType = type
    }

    return result
  }, [])

  // ─── РЕНУМЕРАЦИЯ СЦЕН ───────────────────────────────────────────────
  const renumberScenes = useCallback((lines: Line[]): Line[] => {
    if (format !== 'russian') return lines

    let sceneNumber = 1
    return lines.map(line => {
      if (line.type === 'scene_header') {
        const content = line.content.trim()
        const match = content.match(/^(?:\d+(?:-\d+)?\.\s*)?(.*)$/i)
        if (match) {
          const rest = match[1]
          const newContent = projectType === 'serial'
            ? `${currentSeries}-${sceneNumber}. ${rest}`
            : `${sceneNumber}. ${rest}`
          sceneNumber++
          return { ...line, content: newContent }
        }
      }
      return line
    })
  }, [format, projectType, currentSeries])

  // ─── ОБНОВЛЕНИЕ ИЗ DOM ──────────────────────────────────────────────
  const updateFromDom = useCallback(() => {
    if (!editorRef.current || isUpdatingRef.current) return

    const div = editorRef.current
    const children = Array.from(div.children) as HTMLDivElement[]
    const rawLines = children.map(child => child.innerText.replace(/\n/g, ''))

    const parsed = parseAllLines(rawLines)
    const renumbered = renumberScenes(parsed)

    isUpdatingRef.current = true
    setLines(renumbered)

    // Восстанавливаем DOM структуру с правильными типами
    requestAnimationFrame(() => {
      if (!editorRef.current) { isUpdatingRef.current = false; return }

      const newChildren = Array.from(editorRef.current.children) as HTMLDivElement[]
      newChildren.forEach((child, i) => {
        if (renumbered[i]) {
          child.setAttribute('data-type', renumbered[i].type)
          child.innerText = renumbered[i].content
        }
      })

      isUpdatingRef.current = false
    })
  }, [parseAllLines, renumberScenes])

  // ─── ОБРАБОТКА ВВОДА ──────────────────────────────────────────────
  const handleInput = useCallback(() => {
    updateFromDom()
  }, [updateFromDom])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const selection = window.getSelection()
    if (!selection || !editorRef.current) return

    const currentNode = selection.anchorNode?.parentElement as HTMLDivElement
    const allLines = Array.from(editorRef.current.children) as HTMLDivElement[]
    const currentIndex = allLines.indexOf(currentNode)

    // Enter — новая строка
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const newLine = document.createElement('div')
      newLine.innerHTML = '<br>'
      newLine.setAttribute('data-type', 'empty')

      if (currentIndex >= 0) {
        allLines[currentIndex].after(newLine)
      } else {
        editorRef.current.appendChild(newLine)
      }

      // Фокус на новую строку
      const range = document.createRange()
      range.setStart(newLine, 0)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)

      updateFromDom()
      return
    }

    // Backspace на пустой строке — удалить строку
    if (e.key === 'Backspace' && currentNode.innerText === '') {
      e.preventDefault()
      if (allLines.length > 1) {
        const prevLine = allLines[currentIndex - 1]
        currentNode.remove()
        if (prevLine) {
          const range = document.createRange()
          range.selectNodeContents(prevLine)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        }
        updateFromDom()
      }
      return
    }

    // Ctrl+S — сохранение
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      localStorage.setItem('kinoplan_draft_lines', JSON.stringify(lines))
      console.log('Сохранено')
      return
    }
  }, [updateFromDom, lines])

  // ─── CSS КЛАССЫ ДЛЯ ТИПОВ ──────────────────────────────────────────
  const getLineClass = (type: BlockType): string => {
    const base = 'py-1 outline-none'
    switch (type) {
      case 'scene_header':
        return `${base} pl-0 uppercase font-bold`
      case 'scene_cast':
        return `${base} pl-[5%] text-sm`
      case 'action':
        return `${base} pl-0`
      case 'character':
        return `${base} pl-[40%] uppercase font-bold`
      case 'dialog':
        return `${base} pl-[25%]`
      case 'parenthetical':
        return `${base} pl-[35%] text-sm`
      case 'transition':
        return `${base} pl-[60%] uppercase font-bold text-right`
      case 'empty':
        return `${base} h-4`
      default:
        return base
    }
  }

  // ─── РЕНДЕР ────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Область редактора */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 overflow-y-auto p-8 text-sm leading-relaxed font-mono"
        style={{
          background: editorBg,
          color: textPrimary,
          fontFamily,
          fontSize: `${fontSize}pt`,
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          direction: 'ltr',
          textAlign: 'left',
          unicodeBidi: 'normal',
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            data-type={line.type}
            className={getLineClass(line.type)}
            style={{
              borderLeft: line.type === 'scene_header' ? '2px solid rgba(99,102,241,0.3)' :
                         line.type === 'character' ? '2px solid rgba(245,158,11,0.3)' :
                         line.type === 'dialog' ? '2px solid rgba(59,130,246,0.2)' :
                         'none',
              paddingLeft: line.type === 'scene_header' ? '8px' : undefined,
            }}
          >
            {line.content || '\u00A0'}
          </div>
        ))}
      </div>

      {/* Статусбар */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-2 border-t text-xs"
        style={{ background: isDark ? '#1a1a2e' : '#f8f9fc', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}>
        <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {lines.filter(l => l.type === 'scene_header').length} сцен
        </span>
        <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {(lines.filter(l => l.type === 'action').reduce((s, l) => s + l.content.length, 0) / 2500).toFixed(1)} стр.
        </span>
      </div>

      {/* Tutorial */}
      {showTutorial && (
        <div className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="max-w-lg p-8 rounded-2xl"
            style={{ background: isDark ? '#1a1a35' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: textPrimary }}>Как пользоваться редактором</h3>
            <ul className="space-y-3 text-sm mb-6" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
              <li><strong>Enter</strong> — новая строка</li>
              <li><strong>Пишите как в Word</strong> — программа автоматически форматирует</li>
              <li><strong>ИНТ.</strong> или <strong>НАТ.</strong> — начало шапки сцены</li>
              <li><strong>ПЕТРОВ</strong> — имя персонажа (капслок)</li>
              <li><strong>(шепотом)</strong> — ремарка в скобках</li>
              <li><strong>Ctrl+S</strong> — сохранить</li>
            </ul>
            <button
              onClick={() => setShowTutorial(false)}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#ffffff' }}
            >
              Понятно, начинаю писать
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
