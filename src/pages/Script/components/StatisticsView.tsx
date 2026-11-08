import { memo, useState, useEffect, Fragment, useRef } from 'react'
import {
  Film, FileText, Clock, Users, MapPin, AlertTriangle,
  MessageSquare, AlignLeft, Info, ChevronDown, ChevronRight,
  Move, Download,
} from 'lucide-react'
import { useScriptStats, type ScriptStatsAlert } from '../../../hooks/useScriptStats'
import { useScriptStore } from '../../../store/scriptStore'
import type { Scene } from '../../../types/scene'

interface StatisticsViewProps {
  isDark: boolean
  scenes: Scene[]
  blocks: Array<{ type: string; content: string }>
  precisePages: number
  onSceneClick?: (sceneId: string) => void
  isSerial?: boolean
  episodesCount?: number
  /** целевой хронометраж серии, минут */
  episodeDuration?: number
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type LayoutEntry = { dx: number; dy: number; w?: number; h?: number }

// Структурные маркеры: ориентир по проценту объёма или привязка к сцене (actMarkers)
const ACT_MARKERS = [
  { key: 'act2',   label: 'АКТ 2',       frac: 0.25 },
  { key: 'mid',    label: 'Поворот',     frac: 0.5  },
  { key: 'climax', label: 'Кульминация', frac: 0.8  },
] as const

// Раскладка пользователя из режима «Расстановка» (экспортированный JSON)
const APPLIED_LAYOUT: Record<string, LayoutEntry> = {
  's-timings': { dx: 13.6, dy: -425.6, w: 348.8, h: 332.8 },
  's-heatmap': { dx: 12.8, dy: -571.2, w: 1426, h: 142.8 },
  's-chars': { dx: -119.2, dy: -360.8, w: 357.6, h: 267.8 },
  's-locs': { dx: -239.2, dy: -361.6, w: 390, h: 267 },
  's-intext': { dx: 1144.8, dy: -526.4, w: 289.6, h: 123.6 },
  's-tod': { dx: 396.8, dy: -526.4, w: 242.2, h: 100.8 },
  's-dialog': { dx: -964, dy: -411.2, w: 348.6, h: 100 },
  's-tempo': { dx: 372.8, dy: -870.4, w: 759.6, h: 167.2 },
  'm-scenes': { dx: 16.8, dy: 5.6, w: 200, h: 100 },
  'm-pages': { dx: -132, dy: 5.6, w: 200, h: 100 },
  'm-time': { dx: -282.4, dy: 5.6, w: 200, h: 100 },
  'm-chars': { dx: -429.6, dy: 4, w: 200, h: 101.2 },
  'm-series': { dx: 1145.6, dy: 24, w: 286.2, h: 407.8 },
}

function StatisticsView({ isDark, scenes, blocks, precisePages, onSceneClick, isSerial, episodesCount, episodeDuration }: StatisticsViewProps) {
  const [activeSeries, setActiveSeries] = useState<number | 'all'>('all')

  // Фильтр по серии: номер сцены «1-2» → серия 1; без тире — вне фильтра
  const filteredScenes = activeSeries === 'all' || !isSerial
    ? scenes
    : scenes.filter((sc) => parseInt(sc.number.split('-')[0]) === activeSeries)
  // Серия выбрана, но сцен в ней нет — фильтр и шапка остаются видны
  const emptySeries = isSerial && activeSeries !== 'all' && filteredScenes.length === 0
  const stats = useScriptStats(filteredScenes, blocks, precisePages, activeSeries !== 'all')
  const [expandedLocs, setExpandedLocs] = useState<Set<string>>(new Set())

  // Структурные маркеры: сохранённые привязки (ключ → sceneId) из scriptStore
  const currentScriptId = useScriptStore((s) => s.currentScriptId)
  const actMarkers = useScriptStore((s) => s.scripts.find((x) => x.id === s.currentScriptId)?.actMarkers)
  const updateScript = useScriptStore((s) => s.updateScript)
  const timingsRef = useRef<HTMLDivElement>(null)
  const [dragMarker, setDragMarker] = useState<{ key: string; index: number } | null>(null)

  // Позиция маркера = индекс сцены, ПЕРЕД которой стоит граница
  const markerIndex = new Map<string, number>()
  const n = stats.sceneTimings.length
  for (const m of ACT_MARKERS) {
    const sceneId = actMarkers?.[m.key]
    const i = sceneId ? stats.sceneTimings.findIndex((s) => s.id === sceneId) : -1
    markerIndex.set(m.key, i >= 0 ? i : Math.min(n - 1, Math.max(1, Math.round(m.frac * n))))
  }

  // Драг маркера: потянул чип → линия следует за курсором между строками →
  // отпустил → привязка к ближайшей сцене. Работает и для ориентира, и для
  // уже привязанного маркера — повторный драг ничем не отличается.
  const startMarkerDrag = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const indexAt = (clientY: number): number => {
      const rows = timingsRef.current?.querySelectorAll('[data-scene-row]')
      if (!rows || rows.length === 0) return markerIndex.get(key) ?? 1
      for (const row of rows) {
        const r = (row as HTMLElement).getBoundingClientRect()
        if (clientY < r.top + r.height / 2) {
          return Number((row as HTMLElement).dataset.sceneRow)
        }
      }
      return stats.sceneTimings.length - 1
    }

    const onMove = (ev: PointerEvent) => setDragMarker({ key, index: indexAt(ev.clientY) })
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      const idx = indexAt(ev.clientY)
      setDragMarker(null)
      const sceneId = stats.sceneTimings[idx]?.id
      if (sceneId && currentScriptId) {
        updateScript(currentScriptId, { actMarkers: { ...actMarkers, [key]: sceneId } })
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    onMove(e.nativeEvent)
  }

  // Двойной клик — сброс ручной привязки, маркер возвращается к ориентиру
  const resetMarker = (key: string) => {
    if (!currentScriptId || !actMarkers?.[key]) return
    const next = { ...actMarkers }
    delete next[key]
    updateScript(currentScriptId, { actMarkers: next })
  }
  // Режим расстановки: драг/ресайз блоков + экспорт JSON макета
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
  const [charSort, setCharSort] = useState<'scenes' | 'duration'>('scenes')

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

  // Обёртка блока — pointerdown на самой обёртке (паттерн HomePage)
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

  const Section = ({ title, icon, right, fill, children }: { title: string; icon: React.ReactNode; right?: React.ReactNode; fill?: boolean; children: React.ReactNode }) => (
    <div className={`rounded-xl p-5 transition-all ${fill ? 'h-full flex flex-col' : ''}`}
      style={{ background: cardBg, border: `1px solid ${border}` }}
      onMouseEnter={cardHoverStyle} onMouseLeave={cardLeaveStyle}>
      <div className="flex items-center gap-2 mb-3">
        <div style={{ color: textSecondary }}>{icon}</div>
        <span className="text-xs font-semibold flex-1" style={{ color: textPrimary }}>{title}</span>
        {right}
      </div>
      {fill ? <div className="flex-1 min-h-0">{children}</div> : children}
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

  // Готовность серий: хронометраж сцен каждой серии vs целевой (episodeDuration, мин)
  const seriesReadiness = isSerial
    ? Array.from({ length: episodesCount || 8 }, (_, i) => {
        const n = i + 1
        const sec = scenes
          .filter((sc) => parseInt(sc.number.split('-')[0]) === n)
          .reduce((s, sc) => s + (sc.manualDuration ?? sc.duration ?? 0), 0)
        const target = (episodeDuration ?? 0) * 60
        return { n, sec, pct: target > 0 ? Math.min(100, (sec / target) * 100) : null }
      })
    : []
  const todColors = ['#f59e0b', '#3b82f6', '#a78bfa', '#34d399', '#f87171', '#94a3b8']

  // Полностью пустой сценарий — только для несериального или «Все»
  if (stats.totalScenes === 0 && !emptySeries) {
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

        {emptySeries ? (
          <div className="rounded-xl p-10 flex flex-col items-center justify-center text-center"
            style={{
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.35)',
              boxShadow: '0 0 30px rgba(249,115,22,0.12)',
            }}>
            <Film size={36} style={{ color: '#fb923c', marginBottom: 12 }} />
            <p className="text-base font-bold" style={{ color: '#fb923c' }}>
              Серия {activeSeries} не написана
            </p>
            <p className="text-xs mt-1" style={{ color: textSecondary }}>
              В этой серии пока нет сцен — статистика появится после написания
            </p>
          </div>
        ) : (
        <>
        {/* Карточки метрик */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <LayoutBox k="m-scenes"><MetricCard icon={<Film size={16} />} label="Сцен" value={stats.totalScenes} sub={`${stats.locations.length} локаций`} /></LayoutBox>
          <LayoutBox k="m-pages"><MetricCard icon={<FileText size={16} />} label="Страниц" value={stats.totalPages.toFixed(1)} sub={`${stats.totalWords.toLocaleString('ru-RU')} слов`} /></LayoutBox>
          <LayoutBox k="m-time"><MetricCard icon={<Clock size={16} />} label="Хронометраж" value={fmtDuration(stats.totalDurationSec)} sub={`~${fmtDuration(stats.avgDurationSec)} на сцену`} /></LayoutBox>
          <LayoutBox k="m-chars"><MetricCard icon={<Users size={16} />} label="Персонажей" value={stats.totalCharacters} sub={`${stats.speakingCharacters} с репликами`} /></LayoutBox>
          {isSerial && (
            <LayoutBox k="m-series">
              <div className="rounded-xl p-5 transition-all h-full flex flex-col"
                style={{ background: cardBg, border: `1px solid ${border}` }}
                onMouseEnter={cardHoverStyle} onMouseLeave={cardLeaveStyle}>
                <div className="flex items-center gap-2 mb-1.5" style={{ color: '#fb923c' }}><Film size={16} /></div>
                <div className="text-[11px]" style={{ color: textSecondary }}>Готовность серий</div>
                <div className="space-y-1 mt-2 flex-1 overflow-y-auto pr-1">
                  {seriesReadiness.map((r) => (
                    <div key={r.n} className="flex items-center gap-1.5" title={`Серия ${r.n}: ${fmtDuration(r.sec)}${episodeDuration ? ` из ${fmtDuration(episodeDuration * 60)}` : ' написано'}`}>
                      <span className="w-5 text-[10px] shrink-0" style={{ color: textSecondary }}>С{r.n}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                        <div className="h-full rounded-full" style={{ width: `${r.pct ?? 0}%`, background: r.sec > 0 ? '#fb923c' : 'transparent' }} />
                      </div>
                      <span className="w-14 text-right text-[9px] whitespace-nowrap shrink-0" style={{ color: textPrimary }}>
                        {fmtDuration(r.sec)}{episodeDuration ? `/${fmtDuration(episodeDuration * 60)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </LayoutBox>
          )}
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

          <LayoutBox k="s-dialog"><Section title={activeSeries !== 'all' ? 'Диалог / Действие · весь сценарий' : 'Диалог / Действие'} icon={<MessageSquare size={14} />}>
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
            <div ref={timingsRef} className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {stats.sceneTimings.map((s, i) => (
                <div key={s.id}>
                  {ACT_MARKERS.filter((m) => (dragMarker?.key === m.key ? dragMarker.index : markerIndex.get(m.key)) === i).map((m) => {
                    const manual = !!actMarkers?.[m.key]
                    const isDragging = dragMarker?.key === m.key
                    return (
                      <div key={`mk-${m.key}`} className="flex items-center gap-2 py-0.5 select-none">
                        <div className="h-px flex-1" style={{ background: isDragging ? '#fb923c' : 'rgba(249,115,22,0.35)' }} />
                        <span
                          onPointerDown={startMarkerDrag(m.key)}
                          onDoubleClick={() => resetMarker(m.key)}
                          className="px-2 py-0.5 rounded-full text-[9px] font-bold cursor-grab active:cursor-grabbing"
                          style={{
                            background: manual ? 'rgba(249,115,22,0.28)' : 'rgba(249,115,22,0.12)',
                            color: '#fb923c',
                            border: `1px ${manual ? 'solid' : 'dashed'} rgba(249,115,22,0.6)`,
                          }}
                          title={manual ? 'Привязан к сцене — потяни чтобы перенести · двойной клик — сбросить' : 'Ориентир по объёму — потяни чтобы привязать к сцене'}
                        >
                          {m.label}{manual ? '' : ' ~'}
                        </span>
                        <div className="h-px flex-1" style={{ background: isDragging ? '#fb923c' : 'rgba(249,115,22,0.35)' }} />
                      </div>
                    )
                  })}
                <div
                  data-scene-row={i}
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
                </div>
              ))}
            </div>
          </Section></LayoutBox>

          <LayoutBox k="s-chars"><Section title="Топ персонажей" icon={<Users size={14} />} right={
            <div className="flex gap-0.5">
              {([['scenes', 'сцены'], ['duration', 'хроно']] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setCharSort(v)}
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium transition-all"
                  style={{
                    background: charSort === v ? 'rgba(249,115,22,0.2)' : 'transparent',
                    color: charSort === v ? '#fb923c' : textSecondary,
                  }}
                >{l}</button>
              ))}
            </div>
          }>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {[...stats.characters]
                .sort((a, b) => charSort === 'duration' ? b.durationSec - a.durationSec : b.scenes - a.scenes)
                .slice(0, 12).map((ch) => (
                <div key={ch.name} className="flex items-center gap-2">
                  <span className="w-24 text-[11px] truncate" style={{ color: textSecondary }}>{ch.name}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                    <div className="h-full rounded-full" style={{ width: `${(ch.scenes / Math.max(1, stats.characters[0]?.scenes || 1)) * 100}%`, background: '#a78bfa' }} />
                  </div>
                  <span className="w-20 text-right text-[10px] whitespace-nowrap" style={{ color: textPrimary }} title={`${ch.dialogScenes} сцен с репликами`}>{ch.scenes}с · {fmtDuration(ch.durationSec)}</span>
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
                      <span className="w-20 text-right text-[11px] font-medium whitespace-nowrap" style={{ color: textPrimary }}>{l.count} · {fmtDuration(l.durationSec)}</span>
                    </div>
                    {expanded && l.sublocations.map((s) => (
                      <div key={s.name} className="flex items-center gap-2 mt-1 ml-7">
                        <span className="w-16 text-[10px] truncate" style={{ color: textSecondary }}>{s.name}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                          <div className="h-full rounded-full" style={{ width: `${(s.count / maxLoc) * 100}%`, background: '#93c5fd' }} />
                        </div>
                        <span className="w-20 text-right text-[10px] whitespace-nowrap" style={{ color: textSecondary }}>{s.count} · {fmtDuration(s.durationSec ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </Section></LayoutBox>
        </div>

        {/* Темп по сценам — доля диалога vs действия (только «Все серии») */}
        {stats.tempo.length > 0 && (
          <LayoutBox k="s-tempo"><Section fill title="Темп по сценам" icon={<MessageSquare size={14} />} right={
            <span className="text-[9px]" style={{ color: textSecondary }}>
              <span style={{ color: '#f97316' }}>■</span> диалог&nbsp;&nbsp;<span style={{ color: '#818cf8' }}>■</span> действие
            </span>
          }>
            <div className="grid gap-x-4 gap-y-1.5 h-full overflow-y-auto pr-1"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gridAutoRows: '1fr' }}>
              {stats.tempo.map((t) => (
                <div
                  key={t.id}
                  onClick={onSceneClick ? () => onSceneClick(t.id) : undefined}
                  className="flex items-center gap-2 transition-all"
                  style={{ cursor: onSceneClick ? 'pointer' : 'default' }}
                  title={`Сцена ${t.number}: ${Math.round(t.ratio * 100)}% диалог`}
                >
                  <span className="w-9 text-[10px] truncate" style={{ color: textSecondary }}>{t.number}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                    <div className="h-full" style={{ width: `${t.ratio * 100}%`, background: '#f97316' }} />
                    <div className="h-full" style={{ width: `${(1 - t.ratio) * 100}%`, background: '#818cf8' }} />
                  </div>
                  <span className="w-8 text-right text-[9px]" style={{ color: textPrimary }}>{Math.round(t.ratio * 100)}%</span>
                </div>
              ))}
            </div>
          </Section></LayoutBox>
        )}

        {/* Тепловая карта персонажей — кто в каких сценах */}
        <LayoutBox k="s-heatmap"><Section title="Активность персонажей по сценам" icon={<Users size={14} />}>
          <div className="overflow-x-auto pb-1">
            <div className="inline-grid gap-x-[3px] gap-y-[3px]" style={{ gridTemplateColumns: `110px repeat(${filteredScenes.length}, minmax(14px, 1fr))` }}>
              {/* Шапка — номера сцен */}
              <div />
              {filteredScenes.map((sc) => (
                <div key={`h-${sc.id}`}
                  onClick={onSceneClick ? () => onSceneClick(sc.id) : undefined}
                  className="text-[8px] text-center font-medium transition-all"
                  style={{ color: textSecondary, writingMode: 'vertical-rl', height: 34, cursor: onSceneClick ? 'pointer' : 'default' }}
                  title={`Сцена ${sc.number}`}>
                  {sc.number}
                </div>
              ))}
              {/* Строки персонажей */}
              {stats.characters.slice(0, 12).map((ch) => (
                <Fragment key={ch.name}>
                  <div key={`n-${ch.name}`} className="text-[10px] truncate flex items-center" style={{ color: textPrimary }} title={ch.name}>
                    {ch.name}
                  </div>
                  {filteredScenes.map((sc) => {
                    const inScene = (sc.cast || []).some((c) => c.toUpperCase().trim() === ch.name)
                    const speaks = inScene && (sc.dialogCharacters || []).some((c) => c.toUpperCase().trim() === ch.name)
                    return (
                      <div
                        key={`${ch.name}-${sc.id}`}
                        onClick={inScene && onSceneClick ? () => onSceneClick(sc.id) : undefined}
                        className="rounded-[2px] transition-all"
                        style={{
                          height: 14,
                          background: speaks ? '#f97316' : inScene ? 'rgba(249,115,22,0.35)' : isDark ? 'rgba(255,255,255,0.05)' : '#e5e7eb',
                          cursor: inScene && onSceneClick ? 'pointer' : 'default',
                        }}
                        title={`${ch.name} — сцена ${sc.number}${speaks ? ' (реплики)' : inScene ? ' (в составе)' : ''}`}
                      />
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px]" style={{ color: textSecondary }}>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: '#f97316' }} /> с репликами</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(249,115,22,0.35)' }} /> в составе</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#e5e7eb' }} /> нет</span>
          </div>
        </Section></LayoutBox>

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
        </>
        )}
      </div>
    </div>
  )
}

export default memo(StatisticsView)
