import { CalendarDays, ArrowRight } from 'lucide-react'
import type { Scene } from '../../../types/scene'
import type { MoveAnalysis, RenumberRow } from '../../../utils/storyDay'

/* T-227 ЧАСТЬ 4: диалоги сценарных дней — конфликт переноса + превью пересчёта. */

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 90,
  background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function Shell({ isDark, children, width }: { isDark: boolean; children: React.ReactNode; width: number }) {
  return (
    <div style={overlay}>
      <div className="rounded-2xl p-5 shadow-2xl" style={{
        width, maxHeight: '80vh', overflowY: 'auto',
        background: isDark ? '#1e1e3a' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
      }}>{children}</div>
    </div>
  )
}

export function MoveConflictDialog({
  isDark, scene, analysis, onPickVariant, onKeep, onManual, onCancel,
}: {
  isDark: boolean
  scene: Scene
  analysis: MoveAnalysis
  onPickVariant: (v: { mode: string; day: number }) => void
  onKeep: () => void
  onManual: () => void
  onCancel: () => void
}) {
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const now = `${scene.mode || ''} ${scene.storyDay?.raw || ''}`.trim() || 'без дня'
  return (
    <Shell isDark={isDark} width={420}>
      <div className="flex items-center gap-2 mb-2" style={{ color: '#fb923c' }}>
        <CalendarDays size={16} />
        <span className="text-sm font-semibold">Конфликт сценарных дней</span>
      </div>
      <p className="text-xs mb-3" style={{ color: textSecondary }}>
        Сцена {scene.number} (<b style={{ color: textPrimary }}>{now}</b>) не вписывается
        в контекст нового места. Выберите вариант:
      </p>
      <div className="space-y-1.5 mb-3">
        {analysis.variants.map((v) => (
          <button
            key={`${v.mode}-${v.day}`}
            data-testid="move-variant"
            onClick={() => onPickVariant(v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
            style={{
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399',
            }}
          >
            <span>Привести к контексту</span>
            <span>{v.mode} {v.day}</span>
          </button>
        ))}
        <button
          data-testid="move-keep"
          onClick={onKeep}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
          style={{
            background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa',
          }}
        >
          <span>Оставить как есть</span>
          <span>{now} → скачок</span>
        </button>
        <button
          data-testid="move-manual"
          onClick={onManual}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all hover:brightness-110"
          style={{
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            color: textSecondary,
          }}
        >
          <span>Перенести и править вручную</span>
          <ArrowRight size={12} />
        </button>
      </div>
      <button
        onClick={onCancel}
        className="w-full px-3 py-1.5 rounded-xl text-xs transition-all hover:brightness-110"
        style={{ color: textSecondary }}
      >Отмена</button>
    </Shell>
  )
}

export function RenumberDialog({
  isDark, rows, scenesById, onApply, onCancel,
}: {
  isDark: boolean
  rows: RenumberRow[]
  scenesById: Map<string, Scene>
  onApply: () => void
  onCancel: () => void
}) {
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const changed = rows.filter((r) => r.to != null && String(r.to) !== r.from)
  return (
    <Shell isDark={isDark} width={460}>
      <div className="flex items-center gap-2 mb-2" style={{ color: '#34d399' }}>
        <CalendarDays size={16} />
        <span className="text-sm font-semibold">Пересчёт сценарных дней</span>
      </div>
      <p className="text-xs mb-3" style={{ color: textSecondary }}>
        Обычные дни перенумеруются подряд 1..N, границы и спец-дни сохраняются.
        Изменений: <b style={{ color: textPrimary }}>{changed.length}</b>.
      </p>
      <div className="space-y-0.5 mb-4 max-h-64 overflow-y-auto pr-1">
        {rows.map((r) => {
          const sc = scenesById.get(r.sceneId)
          const isSpecial = r.to == null && r.from != null
          const willChange = r.to != null && String(r.to) !== r.from
          return (
            <div key={r.sceneId} className="flex items-center gap-2 text-[11px] px-1.5 py-1 rounded"
              style={{ background: willChange ? 'rgba(52,211,153,0.07)' : 'transparent' }}>
              <span className="w-12 shrink-0 font-bold" style={{ color: '#a5b4fc' }}>{r.number}</span>
              <span className="flex-1 truncate" style={{ color: textSecondary }}>
                {sc ? `${sc.type}. ${sc.location}` : ''}
              </span>
              <span className="w-16 text-right shrink-0" style={{ color: textSecondary }}>
                {r.from ?? (r.missing ? '—' : '')}
              </span>
              <ArrowRight size={10} style={{ color: textSecondary }} />
              <span className="w-16 shrink-0 font-semibold" style={{
                color: isSpecial ? '#a78bfa' : willChange ? '#34d399' : textSecondary,
              }}>
                {isSpecial ? r.from : r.missing ? `Д${r.to}?` : r.to != null ? `День ${r.to}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button
          data-testid="renumber-apply"
          onClick={onApply}
          className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}
        >Применить — переписать шапки</button>
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-xl text-xs transition-all hover:brightness-110"
          style={{
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            color: textSecondary,
          }}
        >Отмена</button>
      </div>
    </Shell>
  )
}
