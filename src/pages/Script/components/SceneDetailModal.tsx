import { memo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight, Bold, Italic, Underline, Strikethrough, Wand2, Save, Undo2 } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { SceneHeader, SceneCast, SceneAction, SceneCharacter, SceneDialog, SceneTransition, SceneNode, SceneParenthetical } from '../../../components/tiptap'
import { SCENE_NUMBER } from '../../../utils/sceneNumber'
import type { Scene } from '../../../types/scene'

interface SceneDetailModalProps {
  scene: Scene & { _episode?: number }
  synopsis: string // авто-синопсис (или сохранённый)
  isDark: boolean
  onClose: () => void
  onGoToScene?: (sceneId: string) => void
  /** «Перейти к сцене» — открывает одиночный редактор сцены */
  onEditScene?: (scene: Scene & { _episode?: number }) => void
  onUpdate?: (sceneId: string, patch: Partial<Scene>) => void
  /** HTML-фрагмент текста сцены — встроенный редактор */
  sceneHtml?: string
  /** формат сценария — для стилистики блоков */
  scriptFormat?: 'russian' | 'hollywood' | 'custom'
  /** сохранение отредактированного HTML-фрагмента сцены */
  onSaveSceneHtml?: (html: string) => void
}

const STATUSES: Record<string, { l: string; c: string }> = {
  not_planned: { l: 'Не запланирована', c: '#9ca3af' },
  planned: { l: 'Запланирована', c: '#3b82f6' },
  shot: { l: 'Снята', c: '#22c55e' },
}
const PRIORITIES: Array<{ v: Scene['priority']; l: string }> = [
  { v: 'high', l: 'Высокий' },
  { v: 'medium', l: 'Средний' },
  { v: 'low', l: 'Низкий' },
]
export const PRIORITY_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Клавиши как в основном редакторе: Enter создаёт блок следующего типа
const EnterFlow = Extension.create({
  name: 'sceneEnterFlow',
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const type = editor.state.selection.$anchor.parent.type.name
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

// Синонимы типа локации → каноническое НАТ (как в валидации)
const LOCATION_SYNONYMS: Record<string, string> = {
  'ЭКСТ': 'НАТ', 'ЭКСТ.': 'НАТ.', 'ЭКСТЕРЬЕР': 'НАТ',
  'ИНТ/ЭКСТ': 'ИНТ/НАТ', 'ИНТ-ЭКСТ': 'ИНТ-НАТ', 'INT/EXT': 'ИНТ/НАТ', 'I/E': 'ИНТ/НАТ',
}

interface SceneTextEditorProps {
  initialHtml: string
  sceneNumber: string
  scriptFormat?: 'russian' | 'hollywood' | 'custom'
  isDark: boolean
  onSaveHtml?: (html: string) => void
}

/* Встроенный редактор текста сцены с тулбаром форматирования */
export function SceneTextEditor({ initialHtml, sceneNumber, scriptFormat, isDark, onSaveHtml }: SceneTextEditorProps) {
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

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
  })

  // Трансформация регистра выделения (или всего документа, если выделения нет)
  const transformCase = (mode: 'cap' | 'upper' | 'lower') => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    const apply = (t: string) =>
      mode === 'upper' ? t.toUpperCase()
      : mode === 'lower' ? t.toLowerCase()
      : t.replace(/(^|[\s\p{P}])(\p{L})/gu, (_m, p1, p2) => p1 + p2.toUpperCase())
    const tr = editor.state.tr
    const rangeFrom = empty ? 0 : from
    const rangeTo = empty ? editor.state.doc.content.size : to
    editor.state.doc.nodesBetween(rangeFrom, rangeTo, (node, pos) => {
      if (!node.isText || !node.text) return
      const s = Math.max(rangeFrom, pos)
      const e = Math.min(rangeTo, pos + node.text.length)
      if (e <= s) return
      tr.insertText(apply(node.text.slice(s - pos, e - pos)), s, e)
    })
    editor.view.dispatch(tr)
  }

  // Авто-исправление форматирования сцены — те же правила, что в валидации
  const autoFix = () => {
    if (!editor) return
    const doc = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
    doc.querySelectorAll('[data-type]').forEach((el) => {
      const t = el.getAttribute('data-type') || ''
      const c = (el.textContent || '').trim()
      if (t === 'scene-header' || t === 'sceneHeader') {
        if (!new RegExp(`^${SCENE_NUMBER}\\.`).test(c)) {
          el.textContent = `${sceneNumber}. ${c}`
        } else {
          const m = c.match(new RegExp(`^(${SCENE_NUMBER})\\.\\s*(\\S+)(.*)$`))
          const canon = m ? LOCATION_SYNONYMS[m[2]] ?? LOCATION_SYNONYMS[m[2].toUpperCase()] : undefined
          if (canon && m) el.textContent = `${m[1]}. ${canon}${m[3]}`
        }
      }
      if ((t === 'scene-character' || t === 'sceneCharacter') && /[а-яa-zё]/.test(c)) {
        el.textContent = c.toUpperCase()
      }
      if ((t === 'scene-parenthetical' || t === 'sceneParenthetical') && !/^\(.*\)$/.test(c)) {
        el.textContent = `(${c.replace(/[()]/g, '')})`
      }
      if ((t === 'scene-transition' || t === 'sceneTransition') && !/:$/.test(c)) {
        el.textContent = `${c}:`
      }
    })
    editor.commands.setContent(doc.body.innerHTML)
  }

  const save = () => { if (editor) onSaveHtml?.(editor.getHTML()) }

  const TBtn = ({ active, title, onClick, children }: { active?: boolean; title: string; onClick: () => void; children: React.ReactNode }) => (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded-md transition-all"
      style={{
        width: 26, height: 26,
        background: active ? 'rgba(251,146,60,0.25)' : 'transparent',
        color: active ? '#fb923c' : textSecondary,
        border: active ? '1px solid rgba(251,146,60,0.4)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-bold" style={{ color: textSecondary }}>ТЕКСТ СЦЕНЫ</div>
        <div className="flex items-center gap-0.5">
          <TBtn title="Жирный" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={12} /></TBtn>
          <TBtn title="Курсив" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={12} /></TBtn>
          <TBtn title="Подчёркнутый" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={12} /></TBtn>
          <TBtn title="Зачёркнутый" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={12} /></TBtn>
          <span style={{ width: 6 }} />
          <TBtn title="Первая заглавная" onClick={() => transformCase('cap')}><span className="text-[10px] font-bold">Аа</span></TBtn>
          <TBtn title="ВСЕ ЗАГЛАВНЫЕ" onClick={() => transformCase('upper')}><span className="text-[10px] font-bold">АА</span></TBtn>
          <TBtn title="все прописные" onClick={() => transformCase('lower')}><span className="text-[10px] font-bold">аа</span></TBtn>
          <span style={{ width: 6 }} />
          <TBtn title="Отменить" onClick={() => editor?.commands.undo()}><Undo2 size={12} /></TBtn>
          <TBtn title="Авто-исправить форматирование" onClick={autoFix}><Wand2 size={12} /></TBtn>
          <TBtn title="Сохранить сцену" onClick={save}><Save size={12} /></TBtn>
        </div>
      </div>
      <div
        className="rounded-lg overflow-y-auto"
        style={{ maxHeight: 300, border: `1px solid ${border}` }}
      >
        <div
          style={{
            background: '#ffffff', color: '#1a1a1a',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 12.5, padding: '16px 20px', minHeight: 80,
          }}
        >
          <EditorContent
            editor={editor}
            className={`tiptap-editor ${scriptFormat === 'hollywood' ? 'format-hollywood' : 'format-russian'} outline-none`}
          />
        </div>
      </div>
    </div>
  )
}

function SceneDetailModal({ scene, synopsis, isDark, onClose, onEditScene, onUpdate, sceneHtml, scriptFormat, onSaveSceneHtml }: SceneDetailModalProps) {
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const cardBg = isDark ? '#1a1a33' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  const [syn, setSyn] = useState(scene.synopsis || synopsis)
  const [notes, setNotes] = useState(scene.productionNotes ?? '')
  const [prio, setPrio] = useState<Scene['priority']>(scene.priority || 'low')
  useEffect(() => {
    setSyn(scene.synopsis || synopsis)
    setNotes(scene.productionNotes ?? '')
    setPrio(scene.priority || 'low')
  }, [scene.id])

  const save = (patch: Partial<Scene>) => onUpdate?.(scene.id, patch)
  const ep = scene._episode

  const info: Array<[string, string]> = [
    ['Серия', ep ? `С${ep}` : '—'],
    ['Локация', `${scene.location || '—'}${scene.sublocation ? `.${scene.sublocation}` : ''}`],
    ['Время', scene.time || '—'],
    ['Хронометраж', `${fmtDuration(scene.manualDuration ?? scene.duration ?? 0)} · ${scene.pages?.toFixed(1)} стр`],
    ['Символов', String(scene.charCount ?? 0)],
    ['В составе', (scene.cast || []).join(', ') || '—'],
    ['Говорят', (scene.dialogCharacters || []).join(', ') || '—'],
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: cardBg, border: `1px solid rgba(249,115,22,0.35)`, borderTop: `3px solid #fb923c`, width: 720, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: '#fb923c' }}>Сцена {scene.number}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
              {scene.type}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-all hover:bg-white/10">
            <X size={16} style={{ color: textSecondary }} />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-4">
          {/* Синопсис — редактируемый */}
          <div>
            <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>СИНОПСИС</div>
            <textarea
              value={syn}
              onChange={(e) => setSyn(e.target.value)}
              onBlur={() => save({ synopsis: syn.trim() || undefined })}
              rows={3}
              placeholder="Краткое описание сцены…"
              className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5', border: `1px solid ${border}`, color: textPrimary }}
            />
          </div>

          {/* Заметки */}
          <div>
            <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>ЗАМЕТКИ ДЛЯ СЪЁМОЧНОЙ ГРУППЫ</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => save({ productionNotes: notes })}
              rows={2}
              placeholder="Заметки для продакшена…"
              className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5', border: `1px solid ${border}`, color: textPrimary }}
            />
          </div>

          {/* Статус + приоритет */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>СТАТУС</div>
              {/* Только чтение — назначается вторым режиссёром в планировании */}
              <div className="w-full rounded-lg px-2 py-1.5 text-xs flex items-center gap-2"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5', border: `1px solid ${border}` }}>
                <span className="w-2 h-2 rounded-full" style={{ background: STATUSES[scene.status || 'not_planned'].c }} />
                <span style={{ color: textPrimary }}>{STATUSES[scene.status || 'not_planned'].l}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>ПРИОРИТЕТ</div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[prio ?? 'low'] }} />
                <select
                  value={prio}
                  onChange={(e) => {
                    const v = e.target.value as Scene['priority']
                    setPrio(v)
                    save({ priority: v })
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{
                    background: isDark ? '#1a1a33' : '#f5f5f5',
                    border: `1px solid ${border}`,
                    color: textPrimary,
                    colorScheme: isDark ? 'dark' : 'light',
                  }}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.v} value={p.v!} style={{ background: isDark ? '#1a1a33' : '#fff', color: textPrimary }}>{p.l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Инфо — читабельная таблица */}
          <div>
            <div className="text-[10px] font-bold mb-1.5" style={{ color: textSecondary }}>ИНФОРМАЦИЯ</div>
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${border}` }}>
              {info.map(([k, v], i) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2 text-[11px]"
                  style={{ background: i % 2 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.03)' : '#fafafa') }}>
                  <span className="font-medium" style={{ color: textSecondary }}>{k}</span>
                  <span className="text-right font-semibold" style={{ color: textPrimary }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Текст сцены — встроенный редактор с тулбаром */}
          {sceneHtml ? (
            <SceneTextEditor
              key={scene.id}
              initialHtml={sceneHtml}
              sceneNumber={scene.number}
              scriptFormat={scriptFormat}
              isDark={isDark}
              onSaveHtml={onSaveSceneHtml}
            />
          ) : (
            <button
              onClick={() => onEditScene?.(scene)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}
            >
              <ArrowRight size={12} /> Перейти к сцене
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default memo(SceneDetailModal)
