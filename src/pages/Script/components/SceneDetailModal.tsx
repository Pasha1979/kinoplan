import { memo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight } from 'lucide-react'
import type { Scene } from '../../../types/scene'

interface SceneDetailModalProps {
  scene: Scene & { _episode?: number }
  synopsis: string // авто-синопсис (или сохранённый)
  isDark: boolean
  onClose: () => void
  onGoToScene?: (sceneId: string) => void
  onUpdate?: (sceneId: string, patch: Partial<Scene>) => void
}

const STATUSES: Array<{ v: Scene['status']; l: string }> = [
  { v: 'not_planned', l: 'Не запланирована' },
  { v: 'planned', l: 'Запланирована' },
  { v: 'shot', l: 'Снята' },
]
const PRIORITIES: Array<{ v: Scene['priority']; l: string }> = [
  { v: 'high', l: 'Высокий' },
  { v: 'medium', l: 'Средний' },
  { v: 'low', l: 'Низкий' },
]

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function SceneDetailModal({ scene, synopsis, isDark, onClose, onGoToScene, onUpdate }: SceneDetailModalProps) {
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const cardBg = isDark ? '#1a1a33' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  const [syn, setSyn] = useState(scene.synopsis ?? synopsis)
  const [notes, setNotes] = useState(scene.productionNotes ?? '')
  useEffect(() => {
    setSyn(scene.synopsis ?? synopsis)
    setNotes(scene.productionNotes ?? '')
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
        style={{ background: cardBg, border: `1px solid ${border}`, width: 340, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
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
              onBlur={() => save({ synopsis: syn })}
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
              <select
                value={scene.status || 'not_planned'}
                onChange={(e) => save({ status: e.target.value as Scene['status'] })}
                className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5', border: `1px solid ${border}`, color: textPrimary }}
              >
                {STATUSES.map((s) => <option key={s.v} value={s.v!}>{s.l}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>ПРИОРИТЕТ</div>
              <select
                value={scene.priority || 'medium'}
                onChange={(e) => save({ priority: e.target.value as Scene['priority'] })}
                className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5', border: `1px solid ${border}`, color: textPrimary }}
              >
                {PRIORITIES.map((p) => <option key={p.v} value={p.v!}>{p.l}</option>)}
              </select>
            </div>
          </div>

          {/* Инфо */}
          <div className="rounded-lg p-3 space-y-1.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa', border: `1px solid ${border}` }}>
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-[10px]">
                <span style={{ color: textSecondary }}>{k}</span>
                <span className="text-right" style={{ color: textPrimary }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Переход к сцене */}
          <button
            onClick={() => onGoToScene?.(scene.id)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}
          >
            <ArrowRight size={12} /> Перейти к сцене в редакторе
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default memo(SceneDetailModal)
