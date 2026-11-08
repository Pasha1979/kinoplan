import { memo, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

// Клавиши как в основном редакторе: Enter создаёт блок следующего типа
const EnterFlow = Extension.create({
  name: 'sceneEnterFlow',
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const type = editor.state.selection.$anchor.parent.type.name
        // шапка → действие; персонаж/реплика → диалог; диалог → действие; переход → действие
        const next: Record<string, string> = {
          sceneHeader: 'sceneAction',
          sceneCast: 'sceneAction',
          sceneCharacter: 'sceneDialog',
          sceneParenthetical: 'sceneDialog',
          sceneDialog: 'sceneAction',
          sceneTransition: 'sceneHeader',
        }
        const nxt = next[type]
        if (!nxt) return false
        return editor.chain().focus().splitBlock().setNode(nxt as never).run()
      },
    }
  },
})
import { X, Save, Undo2, ArrowLeft } from 'lucide-react'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneNode, SceneParenthetical } from '../../../components/tiptap'
import type { Scene } from '../../../types/scene'
import type { Script } from '../../../store/scriptStore'

interface SceneEditModalProps {
  scene: Scene & { _episode?: number }
  /** скрипт-владелец сцены */
  script: Script
  /** индекс сцены в массиве script.scenes */
  sceneIndex: number
  isDark: boolean
  onClose: () => void
  /** save → (newContent html) обновляет владельца + живой редактор при совпадении */
  onSave: (newContent: string) => void
}

const isHeader = (el: Element) => {
  const t = el.getAttribute('data-type')
  return t === 'scene-header' || t === 'sceneHeader'
}

// Ищет элементы-границы сцены по НОМЕРУ в тексте шапки
// (порядок в массиве scenes может расходиться с документом)
function findSceneEls(blocks: Element[], sceneNumber: string, fallbackIndex: number): { startEl: Element | null; endEl: Element | null } {
  const headers = blocks.filter((el) => isHeader(el))
  const num = sceneNumber.replace(/\./g, '').toLowerCase()
  let startEl: Element | null = null
  for (const el of headers) {
    const headNum = (el.textContent || '').trim().split(/\s/)[0]?.replace(/\./g, '').toLowerCase()
    if (headNum === num) { startEl = el; break }
  }
  if (!startEl && headers[fallbackIndex]) startEl = headers[fallbackIndex]
  if (!startEl) return { startEl: null, endEl: null }
  let endEl: Element | null = null
  const startIdx = blocks.indexOf(startEl)
  for (let i = startIdx + 1; i < blocks.length; i++) {
    if (isHeader(blocks[i])) { endEl = blocks[i]; break }
  }
  return { startEl, endEl }
}

// DOM-узлы сцены: все соседи от шапки до следующей шапки (включая <p> без data-type)
function sceneNodes(startEl: Element, endEl: Element | null): Node[] {
  const nodes: Node[] = []
  let cur: Node | null = startEl
  while (cur && cur !== endEl) {
    nodes.push(cur)
    cur = cur.nextSibling
  }
  return nodes
}

// Извлекает HTML-фрагмент сцены: от её шапки (включительно) до следующей
function extractSceneHtml(content: string, sceneNumber: string, fallbackIndex: number): string {
  const doc = new DOMParser().parseFromString(content || '', 'text/html')
  const blocks = [...doc.body.querySelectorAll('[data-type]')]
  const { startEl, endEl } = findSceneEls(blocks, sceneNumber, fallbackIndex)
  if (!startEl) return ''
  return sceneNodes(startEl, endEl)
    .map((n) => (n.nodeType === 1 ? (n as Element).outerHTML : n.textContent || ''))
    .join('')
}

// Вставляет фрагмент обратно: заменяет блоки сцены на новые из html
export function spliceSceneHtml(content: string, sceneNumber: string, fallbackIndex: number, newHtml: string): string {
  const doc = new DOMParser().parseFromString(content || '', 'text/html')
  const frag = new DOMParser().parseFromString(newHtml, 'text/html')
  const newBlocks = [...frag.body.children]
  const blocks = [...doc.body.querySelectorAll('[data-type]')]
  const { startEl, endEl } = findSceneEls(blocks, sceneNumber, fallbackIndex)
  if (!startEl) return content
  const parent = startEl.parentNode ?? doc.body
  sceneNodes(startEl, endEl).forEach((n) => n.parentNode?.removeChild(n))
  newBlocks.forEach((nb) => parent.insertBefore(doc.importNode(nb, true) as Node, endEl))
  return `<!DOCTYPE html><html><body>${doc.body.innerHTML}</body></html>`
    .replace(/^<!DOCTYPE html><html><body>/, '')
    .replace(/<\/body><\/html>$/, '')
}

function SceneEditModal({ scene, script, sceneIndex, isDark, onClose, onSave }: SceneEditModalProps) {
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const cardBg = isDark ? '#1a1a33' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  const initialHtml = useMemo(
    () => extractSceneHtml(script.content || '', scene.number, sceneIndex),
    [script.id, scene.id],
  )

  const editor = useEditor({
    enableInputRules: false,
    enablePasteRules: false,
    extensions: [
      StarterKit.configure({
        orderedList: false, bulletList: false, listItem: false,
        codeBlock: false, blockquote: false, horizontalRule: false, hardBreak: false,
      }),
      SceneNode, SceneHeader, SceneCast, SceneAction,
      SceneCharacter, SceneDialog, SceneParenthetical, SceneTransition,
      EnterFlow,
    ],
    content: initialHtml,
    autofocus: 'start',
  })

  const handleSave = () => {
    if (!editor) return
    const newContent = spliceSceneHtml(script.content || '', scene.number, sceneIndex, editor.getHTML())
    onSave(newContent)
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: cardBg, border: `1px solid rgba(249,115,22,0.35)`, borderTop: `3px solid #fb923c`,
          width: 'min(780px, 92vw)', height: 'min(600px, 85vh)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold" style={{ color: '#fb923c' }}>Сцена {scene.number}</span>
            {scene._episode !== undefined && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
                Серия {scene._episode}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all hover:bg-white/10" title="Закрыть без сохранения">
            <X size={16} style={{ color: textSecondary }} />
          </button>
        </div>

        {/* Редактор — только эта сцена, вид «лист А4» по центру */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex items-center justify-center" style={{ background: isDark ? '#151528' : '#e8e8ec' }}>
          <div
            className="mx-auto"
            style={{
              maxWidth: 620,
              width: '100%',
              background: '#ffffff',
              color: '#1a1a1a',
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: 13,
              padding: '32px 40px',
              borderRadius: 6,
              boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            }}
          >
            <EditorContent editor={editor} className="tiptap-editor format-russian h-full outline-none" />
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${border}` }}>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: '#fb923c', color: '#fff' }}
          >
            <Save size={13} /> Сохранить
          </button>
          <button
            onClick={() => editor?.commands.undo()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0', color: textPrimary }}
            title="Отменить последнее действие в редакторе"
          >
            <Undo2 size={13} /> Вернуться
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ml-auto"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0', color: textSecondary }}
          >
            <ArrowLeft size={13} /> Отменить
          </button>
          <span className="text-[10px] ml-2" style={{ color: textSecondary }}>Ctrl+Z — тоже откатывает действие</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default memo(SceneEditModal)
