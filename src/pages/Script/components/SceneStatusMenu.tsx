import { useState } from 'react'
import type { DraftStatus } from '../../../types/scene'
import { allDraftStatuses } from '../../../utils/draftStatus'

export const TAG_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a78bfa'] as const

export interface SceneStatusMenuProps {
  x: number
  y: number
  sceneId: string
  isDark: boolean
  border: string
  textPrimary: string
  textSecondary: string
  draftStatuses?: DraftStatus[]
  /** Выбор статуса (undefined — «Без статуса»); компонент после вызова закрывается родителем */
  onSelectStatus: (sceneId: string, statusId: string | undefined) => void
  /** Создание своего статуса и назначение его сцене */
  onCreateStatus: (sceneId: string, status: DraftStatus) => void
  /** Открыть модалку «Управление статусами» (меню при этом закрывается) */
  onOpenManager?: () => void
}

/** Выпадашка редакционного статуса (клик по бейджу на карточке) */
export default function SceneStatusMenu({
  x, y, sceneId, isDark, border, textPrimary, textSecondary,
  draftStatuses, onSelectStatus, onCreateStatus, onOpenManager,
}: SceneStatusMenuProps) {
  // Форма создания своего статуса (внутри выпадашки)
  const [newStatus, setNewStatus] = useState<{ name: string; color: string; weight: number } | null>(null)

  return (
    <div className="fixed rounded-xl p-2 z-50"
      style={{
        left: Math.min(x, window.innerWidth - 200),
        top: Math.min(y, window.innerHeight - 280),
        background: isDark ? '#1e1e3a' : '#ffffff',
        border: `1px solid ${border}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        minWidth: 170,
      }}
      onClick={(e) => e.stopPropagation()}>
      <div className="text-[10px] mb-1.5 px-1" style={{ color: textSecondary }}>Редакционный статус</div>
      <div className="px-1 pb-1 space-y-0.5">
        {allDraftStatuses(draftStatuses).map((s) => (
          <button key={s.id}
            className="w-full flex items-center gap-2 text-left px-1.5 py-1 rounded text-[11px] transition-all hover:opacity-80"
            style={{ color: textPrimary }}
            onClick={() => onSelectStatus(sceneId, s.id)}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="ml-auto text-[9px]" style={{ color: textSecondary }}>{s.weight}%</span>
          </button>
        ))}
        <button
          className="w-full text-left px-1.5 py-1 rounded text-[11px]"
          style={{ color: textSecondary }}
          onClick={() => onSelectStatus(sceneId, undefined)}>
          ✕ Без статуса
        </button>
      </div>
      {/* Свой статус */}
      <div className="mt-1 pt-1.5 px-1 pb-1" style={{ borderTop: `1px solid ${border}` }}>
        {!newStatus ? (
          <>
            <button
              className="w-full text-left px-1.5 py-1 rounded text-[11px]"
              style={{ color: '#fb923c' }}
              onClick={() => setNewStatus({ name: '', color: '#0ea5e9', weight: 70 })}>
              ＋ Свой статус…
            </button>
            {(draftStatuses?.length ?? 0) > 0 && (
              <button
                className="w-full text-left px-1.5 py-1 rounded text-[11px]"
                style={{ color: textSecondary }}
                onClick={() => onOpenManager?.()}>
                ⚙ Управление статусами
              </button>
            )}
          </>
        ) : (
          <div className="space-y-1.5">
            <input
              autoFocus
              value={newStatus.name}
              onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
              placeholder="Название статуса…"
              className="w-full rounded px-1.5 py-1 text-[11px] outline-none"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5', border: `1px solid ${border}`, color: textPrimary }}
            />
            <div className="flex gap-1 px-0.5">
              {TAG_COLORS.map((c) => (
                <button key={c} className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                  style={{ background: c, border: newStatus.color === c ? `2px solid ${textPrimary}` : `2px solid transparent` }}
                  onClick={() => setNewStatus({ ...newStatus, color: c })} />
              ))}
            </div>
            <select
              value={newStatus.weight}
              onChange={(e) => setNewStatus({ ...newStatus, weight: Number(e.target.value) })}
              className="w-full rounded px-1.5 py-1 text-[11px] outline-none"
              style={{ background: isDark ? '#1e1e3a' : '#f5f5f5', border: `1px solid ${border}`, color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }}>
              <option value={30}>Черновая работа · 30%</option>
              <option value={70}>Почти готово · 70%</option>
              <option value={100}>Готово · 100%</option>
            </select>
            <div className="flex gap-1">
              <button
                className="flex-1 rounded px-1.5 py-1 text-[11px] font-bold"
                style={{ background: '#fb923c', color: '#1a1a33', opacity: newStatus.name.trim() ? 1 : 0.4 }}
                onClick={() => {
                  const name = newStatus.name.trim()
                  if (!name) return
                  const st: DraftStatus = { id: `custom-${Date.now().toString(36)}`, label: name, color: newStatus.color, weight: newStatus.weight }
                  onCreateStatus(sceneId, st)
                }}>
                Создать
              </button>
              <button
                className="rounded px-1.5 py-1 text-[11px]"
                style={{ color: textSecondary }}
                onClick={() => setNewStatus(null)}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
