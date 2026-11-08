import { memo, useState, useEffect } from 'react'
import {
  Film, FileText, Clock, Users, MapPin, AlertTriangle,
  MessageSquare, AlignLeft, Info, ChevronDown, ChevronRight,
  Move, Download,
} from 'lucide-react'
import { useScriptStats, type ScriptStatsAlert } from '../../../hooks/useScriptStats'
import type { Scene } from '../../../types/scene'

interface StatisticsViewProps {
  isDark: boolean
  scenes: Scene[]
  blocks: Array<{ type: string; content: string }>
  precisePages: number
  onSceneClick?: (sceneId: string) => void
  isSerial?: boolean
  episodesCount?: number
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type LayoutEntry = { dx: number; dy: number; w?: number; h?: number }

// Раскладка пользователя из режима «Расстановка» (экспортированный JSON)
const APPLIED_LAYOUT: Record<string, LayoutEntry> = {
  's-timings': { dx: 8, dy: 119.2, w: 352.8, h: 228 },
  's-chars': { dx: -8, dy: 118.4, w: 368.6, h: 231.6 },
  's-locs': { dx: -4.8, dy: 116.8, w: 355.6, h: 234.6 },
  's-intext': { dx: 6.4, dy: 55.2, w: 351.4, h: 124 },
  's-tod': { dx: -8.8, dy: 54.4 },
  's-dialog': { dx: -12, dy: 53.6 },
  'm-scenes': { dx: 16.8, dy: 5.6, w: 200, h: 100 },
  'm-pages': { dx: -49.6, dy: 4.8, w: 212.8, h: 100 },
  'm-time': { dx: -108, dy: 5.6, w: 224.8, h: 100 },
  'm-chars': { dx: -150.4, dy: 4.8, w: 220.8, h: 100 },
}

function StatisticsView({ isDark, scenes, blocks, precisePages, onSceneClick, isSerial, episodesCount }: StatisticsViewProps) {
  const [activeSeries, setActiveSeries] = useState<number | 'all'>('all')

  // Фильтр по серии: номер сцены «1-2» → серия 1; без тире — вне фильтра
  const filteredScenes = activeSeries === 'all' || !isSerial
    ? scenes
    : scenes.filter((sc) => parseInt(sc.number.split('-')[0]) === activeSeries)
  const stats = useScriptStats(filteredScenes, blocks, precisePages)
  const [expandedLocs, setExpandedLocs] = useState<Set<string>>(new Set())
  const [layoutMode, setLayoutMode] = useState(false)
  const [layout, setLayout] = useState<Record<string, LayoutEntry>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('statsLayout') || '{}')
      return { ...APPLIED_LAYOUT, ...saved } // свои правки поверх дефолта
    } catch { return { ...APPLIED_LAYOUT } }
  })
  useEffect(() => {
    localStorage.setItem('statsLayout', JSON.stringify(layout))
  }, [layout])

  // Точная копия паттерна HomePage — drag/resize блоков
  const startBlockDrag = (id: string) => (e: React.PointerEvent) => {
    if (!layoutMode) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const s = layout[id] ?? { dx: 0, dy: 0 }
    const onMove = (ev: PointerEvent) =>
      setLayout((l) => ({ ...l, [id]: { ...(l[id] ?? s), dx: s.dx + ev.clientX - startX, dy: s.dy + ev.clientY - startY } }))
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const startBlockResize = (id: string) => (e: React.PointerEvent) => {
    if (!layoutMode) return
    e.preventDefault()
    e.stopPropagation()
    const el = (e.currentTarget as HTMLElement).parentElement
    const startW = el?.offsetWidth ?? 0, startH = el?.offsetHeight ?? 0
    const startX = e.clientX, startY = e.clientY
    const onMove = (ev: PointerEvent) =>
      setLayout((l) => ({
        ...l,
        [id]: { ...(l[id] ?? { dx: 0, dy: 0 }), w: Math.max(200, startW + ev.clientX - startX), h: Math.max(100, startH + ev.clientY - startY) },
      }))
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // Обёртка блока — как HomePage LB: pointerdown на самой обёртке
  const LayoutBox = ({ k, children }: { k: string; children: React.ReactNode }) => {
    const s = layout[k] ?? { dx: 0, dy: 0 }
    return (
      <div
        className={layoutMode ? 'relative outline-2 outline-dashed outline-orange-500/60 rounded-xl' : undefined}
        style={{
          transform: `translate(${s.dx}px, ${s.dy}px)`,
          width: s.w,
          height: s.h,
          zIndex: layoutMode ? 30 : undefined,
          overflow: 'visible',
          cursor: layoutMode ? 'grab' : undefined,
          touchAction: layoutMode ? 'none' : undefined,
        }}
        onPointerDown={startBlockDrag(k)}
      >
        {children}
        {layoutMode && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-orange-500/80 rounded-tl"
            style={{ zIndex: 40 }}
            onPointerDown={startBlockResize(k)}
          />
        )}
      </div>
    )
  }

  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const muted = isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'

  // Donut для ИНТ/ЭКСТ
  const intExtTotal = stats.intCount + stats.extCount + stats.intExtCount + stats.pavCount
  const intExtParts = [
    { label: 'ИНТ', count: stats.intCount, color: '#60a5fa' },
    { label: 'ЭКСТ', count: stats.extCount, color: '#f59e0b' },
    { label: 'ИНТ/ЭКСТ', count: stats.intExtCount, color: '#a78bfa' },
    { label: 'ПАВ', count: stats.pavCount, color: '#34d399' },
  ].filter((p) => p.count > 0)

  // SVG donut
  const Donut = ({ parts, total }: { parts: { label: string; count: number; color: string }[]; total: number }) => {
    const R = 40, C = 2 * Math.PI * R
    let offset = 0
    return (
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={R} fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'} strokeWidth="14" />
        {parts.map((p) => {
          const frac = p.count / total
          const len = frac * C
          const el = (
            <circle key={p.label} cx="55" cy="55" r={R} fill="none"
              stroke={p.color} strokeWidth="14"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 55 55)" />
          )
          offset += len
          return el
        })}
        <text x="55" y="59" textAnchor="middle" fontSize="16" fontWeight="700" fill={textPrimary}>
          {total}
        </text>
      </svg>
    )
  }

  const Bar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[11px] truncate" style={{ color: textSecondary }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
        <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-[11px] font-medium" style={{ color: textPrimary }}>{value}</span>
    </div>
  )

  // Фирменная подсветка при наведении
  const cardHoverStyle = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'
    e.currentTarget.style.boxShadow = '0 0 0 1px rgba(249,115,22,0.2), 0 4px 16px rgba(249,115,22,0.08)'
  }
  const cardLeaveStyle = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = border
    e.currentTarget.style.boxShadow = 'none'
  }

  const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="rounded-xl p-5 transition-all"
      style={{ background: cardBg, border: `1px solid ${border}` }}
      onMouseEnter={cardHoverStyle} onMouseLeave={cardLeaveStyle}>
      <div className="flex items-center gap-2 mb-3">
        <div style={{ color: textSecondary }}>{icon}</div>
        <span className="text-xs font-semibold" style={{ color: textPrimary }}>{title}</span>
      </div>
      {children}
    </div>
  )

  const MetricCard = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) => (
    <div className="rounded-xl p-5 transition-all"
      style={{ background: cardBg, border: `1px solid ${border}` }}
      onMouseEnter={cardHoverStyle} onMouseLeave={cardLeaveStyle}>
      <div className="flex items-center gap-2 mb-1.5" style={{ color: '#fb923c' }}>{icon}</div>
      <div className="text-xl font-bold" style={{ color: textPrimary }}>{value}</div>
      <div className="text-[11px]" style={{ color: textSecondary }}>{label}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: textSecondary }}>{sub}</div>}
    </div>
  )

  const AlertRow = ({ alert }: { alert: ScriptStatsAlert }) => (
    <div
      onClick={alert.sceneId && onSceneClick ? () => onSceneClick(alert.sceneId!) : undefined}
      className="flex items-start gap-2 p-2.5 rounded-lg transition-all"
      style={{
        background: muted,
        border: `1px solid ${border}`,
        cursor: alert.sceneId && onSceneClick ? 'pointer' : 'default',
      }}
      title={alert.sceneId ? 'Перейти к сцене' : undefined}
    >
      {alert.severity === 'warning'
        ? <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
        : <Info size={13} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 1 }} />}
      <span className="text-[11px] leading-tight" style={{ color: textPrimary }}>{alert.message}</span>
    </div>
  )

  const maxTod = Math.max(1, ...stats.timeOfDay.map((t) => t.count))
  const maxSceneDur = Math.max(1, ...stats.sceneTimings.map((s) => s.durationSec))
  const maxLoc = Math.max(1, ...stats.locations.map((l) => l.count))
  const todColors = ['#f59e0b', '#3b82f6', '#a78bfa', '#34d399', '#f87171', '#94a3b8']

  if (stats.totalScenes === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
        <div className="text-center">
          <Film size={48} style={{ color: textSecondary, margin: '0 auto 16px' }} />
          <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>Пока нет сцен</p>
          <p className="text-xs" style={{ color: textSecondary }}>Напишите сценарий — статистика появится автоматически</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      <div className="w-full space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold" style={{ color: textPrimary }}>Статистика сценария</h2>
            {isSerial && (
              <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0' }}>
                {(['all', ...Array.from({ length: episodesCount || 8 }, (_, i) => i + 1)] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveSeries(s as number | 'all')}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                    style={{
                      background: activeSeries === s ? 'rgba(249,115,22,0.2)' : 'transparent',
                      color: activeSeries === s ? '#fb923c' : textSecondary,
                    }}
                  >
                    {s === 'all' ? 'Все' : `С${s}`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {layoutMode && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(layout, null, 2))
                  alert('Макет скопирован в буфер обмена — отправь мне')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}
              >
                <Download size={12} /> Экспорт макета
              </button>
            )}
            <button
              onClick={() => setLayoutMode(!layoutMode)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: layoutMode ? 'rgba(249,115,22,0.2)' : (isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'),
                color: layoutMode ? '#fb923c' : textSecondary,
                border: `1px solid ${layoutMode ? 'rgba(249,115,22,0.4)' : 'transparent'}`,
              }}
              title="Режим расстановки блоков"
            >
              <Move size={12} /> {layoutMode ? 'Готово' : 'Расстановка'}
            </button>
          </div>
        </div>

        {/* Карточки метрик */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <LayoutBox k="m-scenes"><MetricCard icon={<Film size={16} />} label="Сцен" value={stats.totalScenes} sub={`${stats.locations.length} локаций`} /></LayoutBox>
          <LayoutBox k="m-pages"><MetricCard icon={<FileText size={16} />} label="Страниц" value={stats.totalPages.toFixed(1)} sub={`${stats.totalWords.toLocaleString('ru-RU')} слов`} /></LayoutBox>
          <LayoutBox k="m-time"><MetricCard icon={<Clock size={16} />} label="Хронометраж" value={fmtDuration(stats.totalDurationSec)} sub={`~${fmtDuration(stats.avgDurationSec)} на сцену`} /></LayoutBox>
          <LayoutBox k="m-chars"><MetricCard icon={<Users size={16} />} label="Персонажей" value={stats.totalCharacters} sub={`${stats.speakingCharacters} с репликами`} /></LayoutBox>
        </div>

        {/* Распределения */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <LayoutBox k="s-intext"><Section title="ИНТ / ЭКСТ" icon={<Film size={14} />}>
            <div className="flex items-center gap-4">
              <Donut parts={intExtParts} total={intExtTotal} />
              <div className="space-y-1.5 flex-1">
                {intExtParts.map((p) => (
                  <div key={p.label} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                    <span className="text-[11px] flex-1" style={{ color: textSecondary }}>{p.label}</span>
                    <span className="text-[11px] font-medium" style={{ color: textPrimary }}>
                      {p.count} ({Math.round((p.count / intExtTotal) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section></LayoutBox>

          <LayoutBox k="s-tod"><Section title="Время суток" icon={<Clock size={14} />}>
            <div className="space-y-2">
              {stats.timeOfDay.map((t, i) => (
                <Bar key={t.name} label={t.name} value={t.count} max={maxTod} color={todColors[i % todColors.length]} />
              ))}
            </div>
          </Section></LayoutBox>

          <LayoutBox k="s-dialog"><Section title="Диалог / Действие" icon={<MessageSquare size={14} />}>
            <div className="space-y-2">
              <div className="flex h-4 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                <div style={{ width: `${stats.dialogRatio * 100}%`, background: '#818cf8' }} />
                <div style={{ width: `${(1 - stats.dialogRatio) * 100}%`, background: '#34d399' }} />
              </div>
              <div className="flex justify-between text-[11px]">
                <span style={{ color: '#818cf8' }}>Диалог {Math.round(stats.dialogRatio * 100)}% ({stats.dialogBlocks})</span>
                <span style={{ color: '#34d399' }}>Действие {Math.round((1 - stats.dialogRatio) * 100)}% ({stats.actionBlocks})</span>
              </div>
              <p className="text-[10px]" style={{ color: textSecondary }}>
                Блоки персонажей и реплик vs блоки действия
              </p>
            </div>
          </Section></LayoutBox>
        </div>

        {/* Хронометраж по сценам + топ персонажей + локации */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <LayoutBox k="s-timings"><Section title="Хронометраж по сценам" icon={<Clock size={14} />}>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {stats.sceneTimings.map((s) => (
                <div
                  key={s.id}
                  onClick={onSceneClick ? () => onSceneClick(s.id) : undefined}
                  className="flex items-center gap-3 transition-all"
                  style={{ cursor: onSceneClick ? 'pointer' : 'default' }}
                  title="Перейти к сцене"
                >
                  <span className="w-10 text-[11px] truncate" style={{ color: textSecondary }}>{s.number}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                    <div className="h-full rounded-full" style={{ width: `${(s.durationSec / maxSceneDur) * 100}%`, background: s.durationSec > 180 ? '#f59e0b' : '#818cf8' }} />
                  </div>
                  <span className="w-10 text-right text-[11px] font-medium" style={{ color: textPrimary }}>{fmtDuration(s.durationSec)}</span>
                </div>
              ))}
            </div>
          </Section></LayoutBox>

          <LayoutBox k="s-chars"><Section title="Топ персонажей (сцен)" icon={<Users size={14} />}>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {stats.characters.slice(0, 12).map((ch) => (
                <div key={ch.name} className="flex items-center gap-2">
                  <span className="w-24 text-[11px] truncate" style={{ color: textSecondary }}>{ch.name}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                    <div className="h-full rounded-full" style={{ width: `${(ch.scenes / Math.max(1, stats.characters[0]?.scenes || 1)) * 100}%`, background: '#a78bfa' }} />
                  </div>
                  <span className="w-12 text-right text-[10px]" style={{ color: textPrimary }}>{ch.scenes} / {ch.dialogScenes}р</span>
                </div>
              ))}
            </div>
          </Section></LayoutBox>

          <LayoutBox k="s-locs"><Section title="Локации" icon={<MapPin size={14} />}>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {stats.locations.map((l) => {
                const hasSub = l.sublocations.length > 0
                const expanded = expandedLocs.has(l.name)
                return (
                  <div key={l.name}>
                    <div
                      onClick={hasSub ? () => {
                        const next = new Set(expandedLocs)
                        expanded ? next.delete(l.name) : next.add(l.name)
                        setExpandedLocs(next)
                      } : undefined}
                      className="flex items-center gap-2 transition-all"
                      style={{ cursor: hasSub ? 'pointer' : 'default' }}
                    >
                      <span className="w-3.5 shrink-0">
                        {hasSub && (expanded
                          ? <ChevronDown size={11} style={{ color: textSecondary }} />
                          : <ChevronRight size={11} style={{ color: textSecondary }} />)}
                      </span>
                      <span className="w-20 text-[11px] truncate" style={{ color: hasSub ? textPrimary : textSecondary }}>{l.name}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                        <div className="h-full rounded-full" style={{ width: `${(l.count / maxLoc) * 100}%`, background: '#60a5fa' }} />
                      </div>
                      <span className="w-8 text-right text-[11px] font-medium" style={{ color: textPrimary }}>{l.count}</span>
                    </div>
                    {expanded && l.sublocations.map((s) => (
                      <div key={s.name} className="flex items-center gap-2 mt-1 ml-7">
                        <span className="w-16 text-[10px] truncate" style={{ color: textSecondary }}>{s.name}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                          <div className="h-full rounded-full" style={{ width: `${(s.count / maxLoc) * 100}%`, background: '#93c5fd' }} />
                        </div>
                        <span className="w-8 text-right text-[10px]" style={{ color: textSecondary }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </Section></LayoutBox>
        </div>

        {/* Алерты */}
        {stats.alerts.length > 0 && (
          <LayoutBox k="s-alerts"><Section title={`Инсайты и алерты (${stats.alerts.length})`} icon={<AlertTriangle size={14} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {stats.alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
            </div>
          </Section></LayoutBox>
        )}

        <div className="flex items-center gap-2 px-1" style={{ color: textSecondary }}>
          <AlignLeft size={12} />
          <span className="text-[10px]">Статистика обновляется автоматически при наборе текста</span>
        </div>
      </div>
    </div>
  )
}

export default memo(StatisticsView)
