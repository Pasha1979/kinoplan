import { memo, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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

// Извлекает HTML-фрагмент сцены: от её scene_header до следующего
function extractSceneHtml(content: string, sceneIndex: number): string {
  const doc = new DOMParser().parseFromString(content || '', 'text/html')
  const blocks = [...doc.body.querySelectorAll('[data-type]')]
  let start = -1
  blocks.forEach((el, i) => {
    if (el.getAttribute('data-type') === 'scene-header') {
      if (start === -1 && sceneIndex === 0) start = i
      else sceneIndex--
    }
  })
  if (start < 0) return ''
  let end = blocks.length
  for (let i = start + 1; i < blocks.length; i++) {
    if (blocks[i].getAttribute('data-type') === 'scene-header') { end = i; break }
  }
  return blocks.slice(start, end).map((el) => el.outerHTML).join('')
}

// Вставляет фрагмент обратно: заменяет блоки сцены на новые из html
export function spliceSceneHtml(content: string, sceneIndex: number, newHtml: string): string {
  const doc = new DOMParser().parseFromString(content || '', 'text/html')
  const frag = new DOMParser().parseFromString(newHtml, 'text/html')
  const newBlocks = [...frag.body.children]
  const blocks = [...doc.body.querySelectorAll('[data-type]')]
  let start = -1
  blocks.forEach((el, i) => {
    if (el.getAttribute('data-type') === 'scene-header') {
      if (start === -1 && sceneIndex === 0) start = i
      else sceneIndex--
    }
  })
  if (start < 0) return content
  let end = blocks.length
  for (let i = start + 1; i < blocks.length; i++) {
    if (blocks[i].getAttribute('data-type') === 'scene-header') { end = i; break }
  }
  // удалить старые блоки сцены
  for (let i = start; i < end; i++) blocks[i].remove()
  // вставить новые на место anchor (anchor уже удалён — вставляем перед блоком, который был end)
  const ref = blocks[end] ?? null
  newBlocks.forEach((nb) => doc.body.insertBefore(doc.importNode(nb, true) as Node, ref))
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
    () => extractSceneHtml(script.content || '', sceneIndex),
    [script.id, sceneIndex],
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
    ],
    content: initialHtml,
    autofocus: 'end',
  })

  const handleSave = () => {
    if (!editor) return
    const newContent = spliceSceneHtml(script.content || '', sceneIndex, editor.getHTML())
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
          background: cardBg, border: `1px solid ${border}`,
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

        {/* Редактор — только эта сцена */}
        <div className="flex-1 overflow-y-auto px-8 py-5" style={{ fontFamily: '"Courier New", monospace' }}>
          <EditorContent editor={editor} className="h-full" />
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
