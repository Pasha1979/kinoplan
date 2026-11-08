import { memo, useMemo, useState } from 'react'
import { Film, Clock, Users } from 'lucide-react'
import type { Scene } from '../../../types/scene'

type SceneWithEp = Scene & { _episode?: number }

interface CardsViewProps {
  isDark: boolean
  /** сцены всех серий (с меткой _episode) */
  scenes: SceneWithEp[]
  /** блоки всех скриптов — для синопсиса сцены */
  blocks: Array<{ type: string; content: string }>
  /** серия текущего открытого скрипта — драг разрешён только в ней */
  currentEpisode: number
  isSerial?: boolean
  onSceneClick?: (sceneId: string) => void
  /** reorder внутри текущего скрипта (индексы его сцен) */
  onReorder?: (fromIndex: number, toIndex: number) => void
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const TYPE_COLOR: Record<string, string> = {
  'ИНТ': '#818cf8',
  'ЭКСТ': '#f59e0b',
  'ИНТ-ЭКСТ': '#a78bfa',
  'ИНТ/ЭКСТ': '#a78bfa',
  'ПАВ': '#94a3b8',
}

function CardsView({
  isDark, scenes, blocks, currentEpisode, isSerial, onSceneClick, onReorder,
}: CardsViewProps) {
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  // Синопсис сцены: первый action-блок после её шапки (обход блоков ↔ порядок сцен)
  const synopsisById = useMemo(() => {
    const map = new Map<string, string>()
    let idx = -1
    for (const b of blocks) {
      if (b.type === 'scene_header') { idx++; continue }
      const scene = scenes[idx]
      if (!scene) continue
      if (b.type === 'action' && !map.has(scene.id) && b.content.trim()) {
        map.set(scene.id, b.content.trim())
      }
    }
    return map
  }, [blocks, scenes])

  // Группы по сериям (по порядку появления)
  const groups = useMemo(() => {
    const g = new Map<number, SceneWithEp[]>()
    scenes.forEach((sc) => {
      const ep = sc._episode ?? 1
      if (!g.has(ep)) g.set(ep, [])
      g.get(ep)!.push(sc)
    })
    return [...g.entries()].sort((a, b) => a[0] - b[0])
  }, [scenes])

  // HTML5 DnD — перенос карточек внутри серии текущего скрипта
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const empty = scenes.length === 0

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      {empty ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Film size={44} style={{ color: textSecondary, margin: '0 auto 14px' }} />
            <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>Пока нет сцен</p>
            <p className="text-xs" style={{ color: textSecondary }}>Напишите сцены — карточки появятся здесь</p>
          </div>
        </div>
      ) : (
        groups.map(([episode, items]) => {
          const draggable = episode === currentEpisode && !!onReorder
          return (
            <div key={episode} className="mb-8">
              {isSerial && groups.length > 0 && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-bold tracking-wider" style={{ color: '#fb923c' }}>
                    СЕРИЯ {episode}
                  </span>
                  <span className="text-[10px]" style={{ color: textSecondary }}>
                    {items.length} сц ·{' '}
                    {fmtDuration(items.reduce((s, sc) => s + (sc.manualDuration ?? sc.duration ?? 0), 0))}
                  </span>
                </div>
              )}
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
                {items.map((sc, i) => {
                  const typeColor = TYPE_COLOR[sc.type] || '#94a3b8'
                  const dur = sc.manualDuration ?? sc.duration ?? 0
                  const synopsis = synopsisById.get(sc.id)
                  return (
                    <div
                      key={sc.id}
                      draggable={draggable}
                      onDragStart={draggable ? () => setDragIdx(i) : undefined}
                      onDragOver={draggable ? (e) => { e.preventDefault(); setOverIdx(i) } : undefined}
                      onDragLeave={draggable ? () => setOverIdx((o) => (o === i ? null : o)) : undefined}
                      onDrop={draggable ? (e) => {
                        e.preventDefault()
                        if (dragIdx !== null && dragIdx !== i) onReorder?.(dragIdx, i)
                        setDragIdx(null); setOverIdx(null)
                      } : undefined}
                      onDragEnd={draggable ? () => { setDragIdx(null); setOverIdx(null) } : undefined}
                      onClick={() => onSceneClick?.(sc.id)}
                      className="rounded-xl p-3.5 transition-all hover:-translate-y-0.5"
                      style={{
                        background: cardBg,
                        border: `1px solid ${overIdx === i && dragIdx !== null ? 'rgba(249,115,22,0.6)' : border}`,
                        borderLeft: `3px solid ${typeColor}`,
                        cursor: onSceneClick ? 'pointer' : 'default',
                        opacity: dragIdx === i ? 0.5 : 1,
                        boxShadow: overIdx === i && dragIdx !== null ? '0 0 0 2px rgba(249,115,22,0.25)' : undefined,
                      }}
                      title={draggable ? 'Перетащи для перестановки · клик — к сцене' : 'Клик — к сцене'}
                    >
                      {/* Номер + хронометраж */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-bold" style={{ color: typeColor }}>{sc.number}</span>
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: textSecondary }}>
                          <Clock size={10} /> {fmtDuration(dur)} · {sc.pages?.toFixed(1)} стр
                        </span>
                      </div>
                      {/* Локация + время */}
                      <div className="text-[11px] font-semibold mb-1 truncate" style={{ color: textPrimary }}>
                        {sc.type}. {sc.location}{sc.sublocation ? `.${sc.sublocation}` : ''} — {sc.time}
                      </div>
                      {/* Синопсис */}
                      {synopsis && (
                        <div className="text-[10px] leading-snug mb-2" style={{
                          color: textSecondary,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {synopsis}
                        </div>
                      )}
                      {/* Состав */}
                      {sc.cast && sc.cast.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <Users size={10} style={{ color: textSecondary, flexShrink: 0 }} />
                          {sc.cast.slice(0, 3).map((c) => (
                            <span key={c} className="text-[9px] px-1.5 py-0.5 rounded-full"
                              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#eef0f3', color: textSecondary }}>
                              {c}
                            </span>
                          ))}
                          {sc.cast.length > 3 && (
                            <span className="text-[9px]" style={{ color: textSecondary }}>+{sc.cast.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default memo(CardsView)
