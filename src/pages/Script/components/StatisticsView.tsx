import { memo, useState, Fragment, useRef, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Film, FileText, Clock, Users, MapPin, AlertTriangle,
  MessageSquare, AlignLeft, Info, ChevronDown, ChevronRight,
  Move, Scaling, Settings2, RotateCcw, Check,
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
  's-heatmap': { dx: 12.8, dy: -571.2, w: 1420, h: 622 },
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

  // Фильтр по серии: метка _episode скрипта-владельца (надёжнее разбора номера)
  const sceneEpisode = (sc: Scene): number | undefined =>
    (sc as Scene & { _episode?: number })._episode
  const filteredScenes = activeSeries === 'all' || !isSerial
    ? scenes
    : scenes.filter((sc) => (sceneEpisode(sc) ?? parseInt(sc.number.split('-')[0])) === activeSeries)
  const stats = useScriptStats(filteredScenes, blocks, precisePages, activeSeries !== 'all', scenes)
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
  // Макет финализирован — позиции из APPLIED_LAYOUT + сохранённых правок
  const [layout, setLayout] = useState<Record<string, LayoutEntry>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('statsLayout') || '{}')
      // Помержим поключно: w/h из дефолта сохраняются, если в сохранённом их нет
      // (иначе блоки без h теряют высоту → контент выпадает без скролла)
      const merged = { ...APPLIED_LAYOUT }
      for (const k of Object.keys(saved)) merged[k] = { ...APPLIED_LAYOUT[k], ...saved[k] }
      return merged
    } catch { return { ...APPLIED_LAYOUT } }
  })
  const [editMode, setEditMode] = useState(false)
  // Автосохранение макета в localStorage
  useEffect(() => {
    try { localStorage.setItem('statsLayout', JSON.stringify(layout)) } catch { /* noop */ }
  }, [layout])
  const [charSort, setCharSort] = useState<'scenes' | 'duration'>('scenes')

  // Обёртка блока — применяет позицию из макета; в editMode — drag/resize
  const LayoutBox = ({ k, children }: { k: string; children: React.ReactNode }) => {
    const s = layout[k] ?? { dx: 0, dy: 0 }
    const boxRef = useRef<HTMLDivElement>(null)
    const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; orig: LayoutEntry } | null>(null)

    const onHandleDown = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()
      const el = boxRef.current
      const orig: LayoutEntry = {
        dx: s.dx, dy: s.dy,
        w: s.w ?? el?.offsetWidth,
        h: s.h ?? el?.offsetHeight,
      }
      dragRef.current = { mode, startX: e.clientX, startY: e.clientY, orig }
      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current
        if (!d) return
        const ddx = ev.clientX - d.startX
        const ddy = ev.clientY - d.startY
        setLayout((prev) => {
          const cur = prev[k] ?? { dx: 0, dy: 0 }
          if (d.mode === 'move') {
            return { ...prev, [k]: { ...cur, dx: d.orig.dx + ddx, dy: d.orig.dy + ddy } }
          }
          return {
            ...prev,
            [k]: {
              ...cur,
              w: Math.max(160, (d.orig.w ?? 200) + ddx),
              h: Math.max(56, (d.orig.h ?? 120) + ddy),
            },
          }
        })
      }
      const onUp = () => {
        dragRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

    return (
      <div
        ref={boxRef}
        style={{
          transform: `translate(${s.dx}px, ${s.dy}px)`,
          width: s.w,
          height: s.h,
          overflow: s.h ? 'hidden' : 'visible',
          position: 'relative',
          zIndex: editMode ? 20 : undefined,
          outline: editMode ? `1px dashed ${isDark ? 'rgba(251,146,60,0.5)' : 'rgba(234,88,12,0.45)'}` : undefined,
          borderRadius: 12,
        }}
      >
        {children}
        {editMode && (
          <>
            <button
              onPointerDown={onHandleDown('move')}
              title="Переместить блок"
              className="absolute flex items-center justify-center rounded-md transition-colors"
              style={{
                top: 6, right: 6, width: 22, height: 22, zIndex: 30,
                background: 'rgba(249,115,22,0.9)', color: '#fff', cursor: 'grab',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              }}
            >
              <Move size={12} />
            </button>
            <button
              onPointerDown={onHandleDown('resize')}
              title="Изменить размер"
              className="absolute flex items-center justify-center rounded-md transition-colors"
              style={{
                bottom: 6, right: 6, width: 22, height: 22, zIndex: 30,
                background: 'rgba(99,102,241,0.9)', color: '#fff', cursor: 'nwse-resize',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              }}
            >
              <Scaling size={12} />
            </button>
          </>
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

  // Пустой набор (серия не написана) — блоки остаются, контент = заглушка
  const empty = stats.totalScenes === 0
  const Empty = ({ text }: { text: string }) => (
    <div className="py-6 text-center text-[11px] rounded-lg" style={{ color: textSecondary, background: muted }}>
      {text}
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
          .filter((sc) => (sceneEpisode(sc) ?? parseInt(sc.number.split('-')[0])) === n)
          .reduce((s, sc) => s + (sc.manualDuration ?? sc.duration ?? 0), 0)
        const target = (episodeDuration ?? 0) * 60
        return { n, sec, pct: target > 0 ? Math.min(100, (sec / target) * 100) : null }
      })
    : []

  // Темп по сериям: группировка по метке _episode скрипта-владельца.
  // Темп считается по всем сценам — под фильтром показываем только свою серию
  const episodeBySceneId = new Map(scenes.map((sc) => [sc.id, sceneEpisode(sc)]))
  const tempoBySeries = new Map<string, typeof stats.tempo>()
  stats.tempo.forEach((t) => {
    const ep = episodeBySceneId.get(t.id) ?? (t.number.match(/^(\d+)-/)?.[1] ? Number(t.number.split('-')[0]) : undefined)
    if (activeSeries !== 'all' && ep !== activeSeries) return
    const key = ep !== undefined ? String(ep) : '—'
    const arr = tempoBySeries.get(key) || []
    arr.push(t)
    tempoBySeries.set(key, arr)
  })
  const todColors = ['#f59e0b', '#3b82f6', '#a78bfa', '#34d399', '#f87171', '#94a3b8']

  // Персонажи по локациям — для всплывашки при наведении (учитывает фильтр серии)
  const locCharStats = useMemo(() => {
    const map = new Map<string, Map<string, number>>() // "ЛОК" | "ЛОК.ПОД" -> персонаж -> сцен
    filteredScenes.forEach((sc) => {
      const loc = (sc.location || '').trim()
      if (!loc) return
      const sub = (sc.sublocation || '').trim()
      const keys = sub ? [loc, `${loc}.${sub}`] : [loc]
      ;(sc.cast || []).forEach((c) => {
        const k = c.toUpperCase().trim()
        if (!k) return
        keys.forEach((key) => {
          if (!map.has(key)) map.set(key, new Map())
          const m = map.get(key)!
          m.set(k, (m.get(k) || 0) + 1)
        })
      })
    })
    return map
  }, [filteredScenes])

  // Локации по персонажам — для всплывашки при наведении на персонажа
  const charLocStats = useMemo(() => {
    const map = new Map<string, Map<string, number>>() // персонаж -> локация -> сцен
    filteredScenes.forEach((sc) => {
      const loc = (sc.location || '').trim()
      if (!loc) return
      const sub = (sc.sublocation || '').trim()
      const key = sub ? `${loc}.${sub}` : loc
      ;(sc.cast || []).forEach((c) => {
        const k = c.toUpperCase().trim()
        if (!k) return
        if (!map.has(k)) map.set(k, new Map())
        const m = map.get(k)!
        m.set(key, (m.get(key) || 0) + 1)
      })
    })
    return map
  }, [filteredScenes])

  // Всплывашка: позиция + данные (общая для локаций и персонажей)
  const [locTip, setLocTip] = useState<{ x: number; y: number; title: string; items: [string, number][] } | null>(null)
  const showTip = (el: HTMLElement, title: string, m?: Map<string, number>) => {
    if (!m?.size) return setLocTip(null)
    const r = el.getBoundingClientRect()
    setLocTip({
      x: r.right + 8,
      y: Math.min(r.top, window.innerHeight - 260),
      title,
      items: [...m.entries()].sort((a, b) => b[1] - a[1]),
    })
  }
  const showLocTip = (el: HTMLElement, key: string) => showTip(el, key, locCharStats.get(key))

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
            {editMode && (
              <>
                <button
                  onClick={() => { setLayout({ ...APPLIED_LAYOUT }); try { localStorage.removeItem('statsLayout') } catch { /* noop */ } }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{ color: textSecondary, border: `1px solid ${border}` }}
                  title="Вернуть стандартную раскладку"
                >
                  <RotateCcw size={12} /> Сбросить
                </button>
                <span className="text-[10px] px-2 py-1 rounded-md" style={{ color: '#fb923c', background: 'rgba(251,146,60,0.12)' }}>
                  Тяните за оранжевую точку — перемещение, за синюю — размер
                </span>
              </>
            )}
            <button
              onClick={() => setEditMode(!editMode)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={
                editMode
                  ? { background: '#f97316', color: '#fff' }
                  : { color: textSecondary, border: `1px solid ${border}` }
              }
            >
              {editMode ? <Check size={12} /> : <Settings2 size={12} />}
              {editMode ? 'Готово' : 'Настроить'}
            </button>
          </div>
        </div>

        <>
        {/* Карточки метрик */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <LayoutBox k="m-scenes"><MetricCard icon={<Film size={16} />} label="Сцен" value={empty ? '—' : stats.totalScenes} sub={empty ? 'сцен пока нет' : `${stats.locations.length} локаций`} /></LayoutBox>
          <LayoutBox k="m-pages"><MetricCard icon={<FileText size={16} />} label="Страниц" value={empty ? '—' : stats.totalPages.toFixed(1)} sub={empty ? 'появится со сценами' : `${stats.totalWords.toLocaleString('ru-RU')} слов`} /></LayoutBox>
          <LayoutBox k="m-time"><MetricCard icon={<Clock size={16} />} label="Хронометраж" value={empty ? '—' : fmtDuration(stats.totalDurationSec)} sub={empty ? 'появится со сценами' : `~${fmtDuration(stats.avgDurationSec)} на сцену`} /></LayoutBox>
          <LayoutBox k="m-chars"><MetricCard icon={<Users size={16} />} label="Персонажей" value={empty ? '—' : stats.totalCharacters} sub={empty ? 'появятся со сценами' : `${stats.speakingCharacters} с репликами`} /></LayoutBox>
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
            {empty ? <Empty text="Здесь будет баланс интерьерных и натурных сцен" /> :
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
            </div>}
          </Section></LayoutBox>

          <LayoutBox k="s-tod"><Section title="Время суток" icon={<Clock size={14} />}>
            {empty ? <Empty text="Здесь будет распределение сцен по времени суток" /> :
            <div className="space-y-2">
              {stats.timeOfDay.map((t, i) => (
                <Bar key={t.name} label={t.name} value={t.count} max={maxTod} color={todColors[i % todColors.length]} />
              ))}
            </div>}
          </Section></LayoutBox>

          <LayoutBox k="s-dialog"><Section title={activeSeries !== 'all' ? `Диалог / Действие · серия ${activeSeries}` : 'Диалог / Действие'} icon={<MessageSquare size={14} />}>
            {empty ? <Empty text="Здесь будет баланс диалога и действия по объёму текста" /> :
            <div className="space-y-2">
              <div className="flex h-4 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                <div style={{ width: `${stats.dialogRatio * 100}%`, background: '#818cf8' }} />
                <div style={{ width: `${(1 - stats.dialogRatio) * 100}%`, background: '#34d399' }} />
              </div>
              <div className="flex justify-between text-[11px]">
                <span style={{ color: '#818cf8' }}>Диалог {Math.round(stats.dialogRatio * 100)}%{activeSeries === 'all' ? ` (${stats.dialogBlocks})` : ''}</span>
                <span style={{ color: '#34d399' }}>Действие {Math.round((1 - stats.dialogRatio) * 100)}%{activeSeries === 'all' ? ` (${stats.actionBlocks})` : ''}</span>
              </div>
              <p className="text-[10px]" style={{ color: textSecondary }}>
                Блоки персонажей и реплик vs блоки действия
              </p>
            </div>}
          </Section></LayoutBox>
        </div>

        {/* Хронометраж по сценам + топ персонажей + локации */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <LayoutBox k="s-timings"><Section fill title="Хронометраж по сценам" icon={<Clock size={14} />}>
            {empty ? <Empty text="Здесь будет хронометраж каждой сцены с маркерами актов" /> :
            <div ref={timingsRef} className="space-y-1.5 h-full overflow-y-auto pr-1">
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
            </div>}
          </Section></LayoutBox>

          <LayoutBox k="s-chars"><Section fill title="Топ персонажей" icon={<Users size={14} />} right={
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
            {empty ? <Empty text="Здесь будет рейтинг персонажей по сценам и экранному времени" /> :
            <div className="space-y-1.5 h-full overflow-y-auto pr-1">
              {[...stats.characters]
                .sort((a, b) => charSort === 'duration' ? b.durationSec - a.durationSec : b.scenes - a.scenes)
                .map((ch) => (
                <div key={ch.name} className="flex items-center gap-2"
                  onMouseEnter={(e) => showTip(e.currentTarget, ch.name, charLocStats.get(ch.name))}
                  onMouseLeave={() => setLocTip(null)}>
                  <span className="w-24 text-[11px] truncate" style={{ color: textSecondary }}>{ch.name}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                    <div className="h-full rounded-full" style={{ width: `${(ch.scenes / Math.max(1, stats.characters[0]?.scenes || 1)) * 100}%`, background: '#a78bfa' }} />
                  </div>
                  <span className="w-20 text-right text-[10px] whitespace-nowrap" style={{ color: textPrimary }} title={`${ch.dialogScenes} сцен с репликами`}>{ch.scenes}с · {fmtDuration(ch.durationSec)}</span>
                </div>
              ))}
            </div>}
          </Section></LayoutBox>

          <LayoutBox k="s-locs"><Section fill title="Локации" icon={<MapPin size={14} />}>
            {empty ? <Empty text="Здесь будут локации и подлокации с количеством сцен" /> :
            <div className="space-y-1.5 h-full overflow-y-auto pr-1">
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
                      onMouseEnter={(e) => showLocTip(e.currentTarget, l.name)}
                      onMouseLeave={() => setLocTip(null)}
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
                      <div key={s.name} className="flex items-center gap-2 mt-1 ml-7"
                        onMouseEnter={(e) => showLocTip(e.currentTarget, `${l.name}.${s.name}`)}
                        onMouseLeave={() => setLocTip(null)}>
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
            </div>}
          </Section></LayoutBox>
        </div>

        {/* Темп по сценам — доля диалога vs действия */}
        {(
          <LayoutBox k="s-tempo"><Section fill title="Темп по сценам" icon={<MessageSquare size={14} />} right={
            <span className="text-[9px]" style={{ color: textSecondary }}>
              <span style={{ color: '#f97316' }}>■</span> диалог&nbsp;&nbsp;<span style={{ color: '#818cf8' }}>■</span> действие
            </span>
          }>
            {tempoBySeries.size === 0 ? <Empty text="Здесь будет темп сцен — баланс диалога и действия" /> :
            <div className="h-full overflow-y-auto overscroll-contain pr-1">
              {[...tempoBySeries.entries()].map(([series, items]) => (
                <div key={series}>
                  {tempoBySeries.size > 1 && (
                    <div className="text-[10px] font-bold mt-2 mb-1 first:mt-0" style={{ color: '#fb923c' }}>
                      {series === '—' ? 'БЕЗ СЕРИИ' : `СЕРИЯ ${series}`}
                    </div>
                  )}
                  <div className="grid gap-x-5 gap-y-1.5 content-start"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                    {items.map((t) => (
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
                </div>
              ))}
            </div>}
          </Section></LayoutBox>
        )}

        {/* Тепловая карта персонажей — кто в каких сценах */}
        <LayoutBox k="s-heatmap"><Section fill title="Активность персонажей по сценам" icon={<Users size={14} />}>
          {empty ? <Empty text="Здесь будет тепловая карта персонажей по сценам — кто где появляется" /> : <>
          <div className="overflow-auto pb-1" style={{ maxHeight: '100%' }}>
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
              {stats.characters.map((ch) => (
                <Fragment key={ch.name}>
                  <div key={`n-${ch.name}`} className="text-[10px] truncate flex items-center" style={{ color: textPrimary }}
                    onMouseEnter={(e) => showTip(e.currentTarget, ch.name, charLocStats.get(ch.name))}
                    onMouseLeave={() => setLocTip(null)}>
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
          </>}
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

        {/* Всплывашка: персонажи в локации/подлокации */}
        {locTip && createPortal(
          <div
            className="rounded-lg p-2.5"
            style={{
              position: 'fixed',
              left: locTip.x,
              top: locTip.y,
              background: isDark ? '#1e1e3a' : '#ffffff',
              border: `1px solid ${border}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              zIndex: 9999,
              minWidth: 160,
              maxHeight: 240,
              overflowY: 'auto',
              pointerEvents: 'none',
            }}
          >
            <div className="text-[10px] font-bold mb-1.5" style={{ color: '#fb923c' }}>{locTip.title}</div>
            {locTip.items.map(([name, count]) => (
              <div key={name} className="flex justify-between gap-4 text-[10px]">
                <span style={{ color: textSecondary }}>{name}</span>
                <span style={{ color: textPrimary }}>{count} сц</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
        </>
      </div>
    </div>
  )
}

export default memo(StatisticsView)
