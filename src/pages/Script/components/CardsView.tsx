import { memo, useEffect, useMemo, useState } from 'react'
import { Film, Clock, Users, Search, X, Undo2, Folder } from 'lucide-react'
import type { Scene, SceneGroup } from '../../../types/scene'
import SceneDetailModal from './SceneDetailModal'

type SceneWithEp = Scene & { _episode?: number }

interface CardsViewProps {
  isDark: boolean
  scenes: SceneWithEp[]
  blocks: Array<{ type: string; content: string }>
  isSerial?: boolean
  episodesCount?: number
  onSceneClick?: (sceneId: string) => void
  onUpdateScene?: (sceneId: string, patch: Partial<Scene>) => void
  /** «Перейти к сцене» — открывает одиночный редактор сцены */
  onOpenSceneEditor?: (scene: SceneWithEp) => void
  /** перенос сцен: список id → серия, перед позицией в ней */
  onMoveScenes?: (sceneIds: string[], toEpisode: number, toIndex: number) => void
  /** маркеры актов по сериям: ep → {act2|mid|climax → sceneId} */
  actMarkers?: Record<number, Record<string, string | undefined>>
  /** переназначение маркера на другую сцену */
  onMarkerSet?: (key: string, sceneId: string, episode: number) => void
  /** группы карточек по сериям */
  groupsByEpisode?: Record<number, SceneGroup[]>
  /** запись изменённых групп обратно в скрипт серии */
  onGroupsChange?: (episode: number, groups: SceneGroup[]) => void
  /** откат последнего действия на доске */
  onUndo?: () => void
  undoCount?: number
}

const MARKER_META: Record<string, { label: string; color: string }> = {
  act2: { label: 'АКТ 2', color: '#3b82f6' },
  mid: { label: 'МИДПОИНТ', color: '#a78bfa' },
  climax: { label: 'КУЛЬМИНАЦИЯ', color: '#ef4444' },
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const TYPE_COLOR: Record<string, string> = {
  'ИНТ': '#818cf8', 'ЭКСТ': '#f59e0b', 'ИНТ-ЭКСТ': '#a78bfa', 'ИНТ/ЭКСТ': '#a78bfa', 'ПАВ': '#94a3b8',
}
const TAG_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a78bfa'] as const
const PRIORITY_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }
const PRIORITY_LABEL: Record<string, string> = { high: 'ВЫСОКИЙ', medium: 'СРЕДНИЙ' }
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  planned: { label: 'Запланирована', color: '#3b82f6' },
  shot: { label: 'Снята', color: '#22c55e' },
}

function CardsView({ isDark, scenes, blocks, isSerial, episodesCount = 8, onSceneClick, onUpdateScene, onOpenSceneEditor, onMoveScenes, actMarkers, onMarkerSet, groupsByEpisode = {}, onGroupsChange, onUndo, undoCount = 0 }: CardsViewProps) {
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'ИНТ' | 'ЭКСТ' | 'ПАВ'>('all')
  const [series, setSeries] = useState<number | 'all'>('all')
  const [detail, setDetail] = useState<SceneWithEp | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string; ep: number } | null>(null)
  // Драг и мультивыбор
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragIds, setDragIds] = useState<string[]>([])
  const [dropKey, setDropKey] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  // Драг маркера акта (не сцены!)
  const [dragMarker, setDragMarker] = useState<string | null>(null)
  // Окно-доска открытой группы и модал имени новой группы
  const [groupModal, setGroupModal] = useState<{ ep: number; gid: string } | null>(null)
  const [nameModal, setNameModal] = useState<{ ep: number; sceneIds: string[]; editGid?: string } | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [groupCtx, setGroupCtx] = useState<{ x: number; y: number; ep: number; gid: string } | null>(null)
  // Страховка: dragend на window — гасит «зависшую» тусклость, если источник драга размонтировался
  useEffect(() => {
    const clear = () => { setDragIds([]); setDropKey(null) }
    window.addEventListener('dragend', clear)
    return () => window.removeEventListener('dragend', clear)
  }, [])
  // Макет в исходном состоянии — все зоны без смещений
  const [layout] = useState<Record<string, { dx: number; dy: number; w?: number; h?: number }>>(() => ({}))
  const LayoutBox = ({ k, children, style }: { k: string; children: React.ReactNode; style?: React.CSSProperties }) => {
    const s = layout[k] ?? { dx: 0, dy: 0 }
    return (
      <div
        style={{
          ...style,
          transform: `translate(${s.dx}px, ${s.dy}px)`,
          width: s.w ?? style?.width,
          height: s.h ?? style?.height,
          overflow: s.h ? 'auto' : style?.overflow ?? 'visible',
        }}
      >
        {children}
      </div>
    )
  }
  const createGroup = (ep: number, name: string, sceneIds: string[]) => {
    if (!name.trim()) return
    const colors = ['#fb923c', '#3b82f6', '#22c55e', '#a78bfa', '#ef4444']
    updateGroups(ep, (gs) => [...gs, {
      id: `g-${Date.now()}`, name: name.trim(),
      color: colors[gs.length % colors.length], sceneIds,
    }])
  }
  // Группы: карточка → id группы (по сериям)
  const groupOf = (ep: number, sceneId: string) =>
    (groupsByEpisode[ep] || []).find((g) => g.sceneIds.includes(sceneId))
  const updateGroups = (ep: number, fn: (gs: SceneGroup[]) => SceneGroup[]) =>
    onGroupsChange?.(ep, fn(groupsByEpisode[ep] || []))

  // Синопсис: первая ремарка сцены (диалог в начале сцены пропускаем —
  // берём первый action-блок после шапки что бы ни шло первым)
  const autoSynopsis = useMemo(() => {
    const map = new Map<string, string>()
    const fallback = new Map<string, string>() // первый текстовый блок любого типа
    let idx = -1
    for (const b of blocks) {
      if (b.type === 'scene_header') { idx++; continue }
      const scene = scenes[idx]
      if (!scene || !b.content.trim()) continue
      // Предпочитаем первую ремарку (action) — в т.ч. если сцена открылась диалогом
      if (b.type === 'action' && !map.has(scene.id)) {
        map.set(scene.id, b.content.trim())
      } else if (!fallback.has(scene.id)) {
        fallback.set(scene.id, b.content.trim())
      }
    }
    // сцены без action — берём первый текст (диалог/параграф)
    fallback.forEach((v, k) => { if (!map.has(k)) map.set(k, v) })
    return map
  }, [blocks, scenes])

  const syn = (sc: SceneWithEp) => sc.synopsis || autoSynopsis.get(sc.id) || ''

  // Фильтрация: серия → тип → поиск
  const visible = useMemo(() => {
    let list = scenes
    if (series !== 'all') list = list.filter((sc) => (sc._episode ?? 1) === series)
    if (typeFilter !== 'all') {
      list = list.filter((sc) =>
        typeFilter === 'ПАВ' ? sc.type === 'ПАВ'
          : typeFilter === 'ИНТ' ? (sc.type === 'ИНТ' || sc.type === 'ИНТ-ЭКСТ' || sc.type === 'ИНТ/ЭКСТ')
          : (sc.type === 'ЭКСТ' || sc.type === 'ИНТ-ЭКСТ' || sc.type === 'ИНТ/ЭКСТ'))
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((sc) =>
        sc.number.toLowerCase().includes(q) ||
        (sc.location || '').toLowerCase().includes(q) ||
        (sc.sublocation || '').toLowerCase().includes(q) ||
        (sc.cast || []).some((c) => c.toLowerCase().includes(q)) ||
        syn(sc).toLowerCase().includes(q))
    }
    return list
  }, [scenes, series, typeFilter, query, autoSynopsis])

  const groups = useMemo(() => {
    const g = new Map<number, SceneWithEp[]>()
    visible.forEach((sc) => {
      const ep = sc._episode ?? 1
      if (!g.has(ep)) g.set(ep, [])
      g.get(ep)!.push(sc)
    })
    return [...g.entries()].sort((a, b) => a[0] - b[0])
  }, [visible])

  const seriesPills = isSerial ? [0, ...Array.from({ length: episodesCount }, (_, i) => i + 1)] : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}
      onClick={() => { setCtxMenu(null); setGroupCtx(null); if (selected.size) setSelected(new Set()) }}>

      {/* Шапка: поиск + фильтры */}
      <LayoutBox k="toolbar" style={{ padding: '16px 40px 12px' }}>
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap rounded-xl"
        style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 min-w-[200px] max-w-[340px]"
          style={{ background: cardBg, border: `1px solid ${border}` }}>
          <Search size={13} style={{ color: textSecondary }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Сцена, локация, персонаж, текст…"
            className="bg-transparent outline-none text-xs flex-1"
            style={{ color: textPrimary }}
          />
          {query && <X size={12} style={{ color: textSecondary, cursor: 'pointer' }} onClick={() => setQuery('')} />}
        </div>
        <div className="flex gap-1">
          {(['Все', 'ИНТ', 'ЭКСТ', 'ПАВ'] as const).map((t) => (
            <button key={t}
              onClick={() => setTypeFilter(t === 'Все' ? 'all' : t)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: (t === 'Все' ? typeFilter === 'all' : typeFilter === t) ? 'rgba(249,115,22,0.2)' : 'transparent',
                color: (t === 'Все' ? typeFilter === 'all' : typeFilter === t) ? '#fb923c' : textSecondary,
              }}>{t}</button>
          ))}
        </div>
        {seriesPills && (
          <div className="flex gap-1 ml-auto">
            {seriesPills.map((s) => (
              <button key={s}
                onClick={() => setSeries(s === 0 ? 'all' : s)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                style={{
                  background: series === (s === 0 ? 'all' : s) ? 'rgba(249,115,22,0.2)' : 'transparent',
                  color: series === (s === 0 ? 'all' : s) ? '#fb923c' : textSecondary,
                }}>{s === 0 ? 'Все' : `С${s}`}</button>
            ))}
          </div>
        )}
        <span className="text-[10px] ml-1" style={{ color: textSecondary }}>{visible.length} сц</span>
        {/* Откат последнего действия (драг/группы/маркеры) */}
        <button
          onClick={onUndo}
          disabled={undoCount === 0}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
          style={{
            background: undoCount ? 'rgba(249,115,22,0.15)' : 'transparent',
            color: undoCount ? '#fb923c' : textSecondary,
            opacity: undoCount ? 1 : 0.4,
            cursor: undoCount ? 'pointer' : 'default',
          }}
          title={undoCount ? `Отменить действие (в истории ${undoCount})` : 'Нет действий для отмены'}
        >
          <Undo2 size={12} /> Отменить
        </button>
      </div>
      </LayoutBox>

      {/* Доска + сайдбар папок */}
      <div className="flex-1 flex overflow-hidden">
      <LayoutBox k="board" style={{ flex: 1, overflowY: 'auto', padding: '0 40px 24px' }}>
        <div onScroll={() => setCtxMenu(null)}
          onDrop={(e) => { if (dragIds.length) { e.preventDefault(); setDragIds([]); setDropKey(null); setSelected(new Set()) } }}>
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Film size={44} style={{ color: textSecondary, margin: '0 auto 14px' }} />
              <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>Сцены не найдены</p>
              <p className="text-xs" style={{ color: textSecondary }}>
                {query || typeFilter !== 'all' || series !== 'all' ? 'Измените фильтр или поиск' : 'Напишите сцены — карточки появятся здесь'}
              </p>
            </div>
          </div>
        ) : (
          groups.map(([episode, items]) => (
            <div key={episode} className="mb-7">
              {isSerial && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-bold tracking-wider" style={{ color: '#fb923c' }}>СЕРИЯ {episode}</span>
                  <span className="text-[10px]" style={{ color: textSecondary }}>
                    {items.length} сц · {fmtDuration(items.reduce((s, sc) => s + (sc.manualDuration ?? sc.duration ?? 0), 0))}
                  </span>
                </div>
              )}
              {(() => {
                const cardEl = (sc: SceneWithEp, i: number) => {
                  const tagColor = sc.colorTag || TYPE_COLOR[sc.type] || '#94a3b8'
                  const dur = sc.manualDuration ?? sc.duration ?? 0
                  const synopsis = syn(sc)
                  const st = sc.status && sc.status !== 'not_planned' ? STATUS_LABEL[sc.status] : null
                  const isSel = selected.has(sc.id)
                  const isDrop = dropKey === `${episode}:${i}`
                  const isHover = hoverId === sc.id
                  const grp = groupOf(episode, sc.id)
                  // Маркеры актов этой сцены (могут быть несколько)
                  const epMarkers = actMarkers?.[episode] ?? {}
                  const scMarkers = Object.entries(epMarkers).filter(([, sid]) => sid === sc.id)
                  return (
                    <div key={sc.id}>
                      {scMarkers.map(([key]) => {
                        const m = MARKER_META[key]
                        return m ? (
                          <div
                            key={key}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); setDragMarker(key) }}
                            onDragEnd={() => setDragMarker(null)}
                            className="flex items-center gap-2 mb-1.5 cursor-grab"
                            title={`${m.label} — перетащи на другую сцену`}
                          >
                            <div className="h-px flex-1" style={{ background: m.color, opacity: 0.6 }} />
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: m.color + '22', color: m.color, border: `1px solid ${m.color}55` }}>
                              {m.label}
                            </span>
                            <div className="h-px flex-1" style={{ background: m.color, opacity: 0.6 }} />
                          </div>
                        ) : null
                      })}
                    <div
                      draggable
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          e.stopPropagation()
                          setSelected((prev) => {
                            const n = new Set(prev)
                            n.has(sc.id) ? n.delete(sc.id) : n.add(sc.id)
                            return n
                          })
                        } else {
                          setDetail(sc)
                        }
                      }}
                      onDragStart={() => {
                        // тянем все выбранные (порядок в группе) или только эту карточку
                        setDragIds(
                          isSel && selected.size > 1
                            ? items.filter((s) => selected.has(s.id)).map((s) => s.id)
                            : [sc.id],
                        )
                      }}
                      onDragOver={(e) => { e.preventDefault(); setDropKey(`${episode}:${i}`) }}
                      onDragLeave={() => setDropKey((k) => (k === `${episode}:${i}` ? null : k))}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragMarker) {
                          onMarkerSet?.(dragMarker, sc.id, episode)
                          setDragMarker(null)
                        } else if (dragIds.length) {
                          onMoveScenes?.(dragIds, episode, i)
                        }
                        setDragIds([]); setDropKey(null); setSelected(new Set())
                      }}
                      onDragEnd={() => { setDragIds([]); setDropKey(null) }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setCtxMenu({ x: e.clientX, y: e.clientY, id: sc.id, ep: episode })
                      }}
                      onMouseEnter={() => setHoverId(sc.id)}
                      onMouseLeave={() => setHoverId((h) => (h === sc.id ? null : h))}
                      className="rounded-xl p-2.5 transition-all hover:-translate-y-0.5 flex flex-col"
                      style={{
                        position: 'relative',
                        background: cardBg,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: isDrop ? '#fb923c' : isSel ? 'rgba(249,115,22,0.7)' : isHover ? 'rgba(249,115,22,0.55)' : border,
                        borderLeftWidth: 3,
                        borderLeftColor: isDrop ? '#fb923c' : tagColor,
                        cursor: 'grab',
                        opacity: sc.isOmitted ? 0.55 : dragIds.includes(sc.id) ? 0.4 : 1,
                        boxShadow: isDrop
                          ? '0 0 0 2px rgba(249,115,22,0.3)'
                          : isSel ? '0 0 0 1.5px rgba(249,115,22,0.35)'
                          : isHover ? '0 4px 20px rgba(249,115,22,0.18)' : undefined,
                        transform: isHover && !isDrop ? 'translateY(-2px)' : undefined,
                      }}
                      title="Клик — детали · Ctrl+клик — выбрать · правый клик — цвет · перетащи для перестановки"
                    >
                      {isDrop && (
                        <div
                          style={{
                            position: 'absolute',
                            left: -8,
                            top: -6,
                            bottom: -6,
                            width: 2,
                            borderRadius: 3,
                            background: 'linear-gradient(180deg, #fdba74 0%, #fb923c 50%, #f97316 100%)',
                            boxShadow: '0 0 12px 3px rgba(249,115,22,0.7), 0 0 26px 6px rgba(249,115,22,0.3)',
                            pointerEvents: 'none',
                            zIndex: 5,
                          }}
                        />
                      )}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold" style={{ color: TYPE_COLOR[sc.type] || '#94a3b8' }}>{sc.number}</span>
                          {(sc.priority === 'high' || sc.priority === 'medium') && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{
                                background: PRIORITY_COLOR[sc.priority] + '26',
                                color: PRIORITY_COLOR[sc.priority],
                                border: `1px solid ${PRIORITY_COLOR[sc.priority]}55`,
                              }}>
                              {PRIORITY_LABEL[sc.priority]}
                            </span>
                          )}
                          {st && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: st.color + '26', color: st.color }}>{st.label}</span>}
                        </div>
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: textSecondary }}>
                          <Clock size={10} /> {fmtDuration(dur)} · {sc.pages?.toFixed(1)} стр
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold mb-1 truncate" style={{ color: textPrimary }}>
                        {sc.type}. {sc.location}{sc.sublocation ? `.${sc.sublocation}` : ''} — {sc.time}
                      </div>
                      {synopsis && (
                        <div className="text-[10px] leading-snug mb-2" style={{
                          color: textSecondary,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {synopsis}
                        </div>
                      )}
                      {sc.cast && sc.cast.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <Users size={10} style={{ color: textSecondary, flexShrink: 0 }} />
                          {sc.cast.slice(0, 3).map((c) => (
                            <span key={c} className="text-[9px] px-1.5 py-0.5 rounded-full"
                              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#eef0f3', color: textSecondary }}>
                              {c}
                            </span>
                          ))}
                          {sc.cast.length > 3 && <span className="text-[9px]" style={{ color: textSecondary }}>+{sc.cast.length - 3}</span>}
                        </div>
                      )}
                      {/* Метка сюжетной линии — цвет группы */}
                      {grp && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: grp.color }} />
                          <span className="text-[8px] font-semibold uppercase tracking-wide truncate" style={{ color: grp.color }}>
                            {grp.name}
                          </span>
                        </div>
                      )}
                    </div>
                    </div>
                  )
                }
                return (
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))' }}>
                    {items.map((sc, i) => cardEl(sc, i))}
                  </div>
                )
              })()}
              {/* Дроп-зона — перенос в конец серии */}
              {dragIds.length > 0 && (
                <div
                  className="mt-2 rounded-lg text-center text-[10px] py-2 transition-all"
                  style={{
                    border: dropKey === `${episode}:end`
                      ? '1px solid rgba(249,115,22,0.6)'
                      : `1.5px dashed ${border}`,
                    background: dropKey === `${episode}:end`
                      ? 'linear-gradient(90deg, transparent, rgba(249,115,22,0.28), transparent)'
                      : 'transparent',
                    boxShadow: dropKey === `${episode}:end` ? '0 0 14px rgba(249,115,22,0.4), inset 0 0 14px rgba(249,115,22,0.15)' : 'none',
                    color: dropKey === `${episode}:end` ? '#fb923c' : textSecondary,
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDropKey(`${episode}:end`) }}
                  onDragLeave={() => setDropKey((k) => (k === `${episode}:end` ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault()
                    onMoveScenes?.(dragIds, episode, items.length)
                    setDragIds([]); setDropKey(null); setSelected(new Set())
                  }}
                >
                  Перенести в конец серии {episode}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </LayoutBox>

      {/* ── САЙДБАР «ПАПКИ» — контейнеры групп ── */}
      <LayoutBox k="sidebar" style={{
        width: 268, overflowY: 'auto',
        borderLeft: `1px solid ${border}`,
        background: isDark ? 'rgba(249,115,22,0.05)' : 'rgba(249,115,22,0.04)',
        boxShadow: isDark ? 'inset 6px 0 20px -8px rgba(0,0,0,0.6)' : 'inset 6px 0 20px -8px rgba(249,115,22,0.12)',
      }}>
      <div className="px-3 py-4 space-y-3"
        onDragOver={(e) => { e.preventDefault(); setDropKey('sidebar') }}
        onDragLeave={() => setDropKey((k) => (k === 'sidebar' ? null : k))}
        onDrop={(e) => {
          e.preventDefault()
          if (dragIds.length) {
            const ep = series === 'all' ? (scenes.find((s) => s.id === dragIds[0])?._episode ?? 1) : (series as number)
            setNameModal({ ep, sceneIds: [...dragIds] })
            setNameInput(`Группа ${(groupsByEpisode[ep] || []).length + 1}`)
          }
          setDragIds([]); setDropKey(null)
        }}
        style={{
          borderLeft: dropKey === 'sidebar' ? '2px solid #fb923c' : 'none',
          background: isDark
            ? 'linear-gradient(180deg, rgba(249,115,22,0.10) 0%, rgba(20,20,42,0.6) 60px, #0d0d1c 100%)'
            : 'linear-gradient(180deg, rgba(249,115,22,0.10) 0%, #fdfaf5 60px, #fafafa 100%)',
        }}>
        <div className="flex items-center gap-2 mb-2 px-1 py-1.5 rounded-lg"
          style={{ background: 'rgba(249,115,22,0.12)' }}>
          <Folder size={13} style={{ color: '#fb923c' }} />
          <span className="text-[11px] font-bold tracking-wider" style={{ color: '#fb923c' }}>ПАПКИ</span>
        </div>
        {dragIds.length > 0 && (
          <p className="text-[10px] text-center rounded-lg py-2"
            style={{ color: '#fb923c', border: '1px dashed rgba(249,115,22,0.5)' }}>
            Отпустите — создадим новую папку
          </p>
        )}
        {groups.filter(([ep]) => series === 'all' || series === ep).length === 0 && dragIds.length === 0 && (
          <p className="text-[10px]" style={{ color: textSecondary }}>
            Нет групп. Правый клик по карточке → «В группу»<br />или перетащите карточку сюда
          </p>
        )}
        {groups.filter(([ep]) => series === 'all' || series === ep).flatMap(([ep, items]) =>
          (groupsByEpisode[ep] || []).map((g) => {
            const gScenes = items.filter((s) => g.sceneIds.includes(s.id))
            const gDur = gScenes.reduce((s, sc) => s + (sc.manualDuration ?? sc.duration ?? 0), 0)
            const key = `${ep}:${g.id}`
            return (
              <div
                key={key}
                className="rounded-xl overflow-hidden transition-all"
                style={{
                  border: `1.5px solid ${dropKey === `grp:${key}` ? '#fb923c' : g.color + '55'}`,
                  background: dropKey === `grp:${key}` ? 'rgba(249,115,22,0.15)' : cardBg,
                  boxShadow: dropKey === `grp:${key}` ? '0 0 0 2px rgba(249,115,22,0.4), 0 4px 12px rgba(249,115,22,0.25)' : 'none',
                  transform: dropKey === `grp:${key}` ? 'scale(1.02)' : 'none',
                }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropKey(`grp:${key}`) }}
                onDragLeave={() => setDropKey((k) => (k === `grp:${key}` ? null : k))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIds.length) {
                    updateGroups(ep, (gs) => gs.map((x) => x.id === g.id
                      ? { ...x, sceneIds: [...new Set([...x.sceneIds, ...dragIds])] } : x))
                  }
                  e.stopPropagation()
                  setDragIds([]); setDropKey(null)
                }}
                onContextMenu={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  setGroupCtx({ x: e.clientX, y: e.clientY, ep, gid: g.id })
                }}
              >
                {/* Контейнер группы — клик открывает доску группы */}
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left transition-all hover:brightness-110"
                  onClick={() => setGroupModal({ ep, gid: g.id })}
                  title="Открыть доску группы"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: g.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate" style={{ color: textPrimary }}>{g.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                      {gScenes.length} сц · {fmtDuration(gDur)}
                    </div>
                  </div>
                  <span
                    onClick={(e) => { e.stopPropagation(); updateGroups(ep, (gs) => gs.filter((x) => x.id !== g.id)) }}
                    className="text-[11px] px-1.5 transition-all hover:scale-110 cursor-pointer"
                    style={{ color: textSecondary }}
                    title="Удалить группу (сцены останутся)">✕</span>
                </button>
                {/* Первые сцены — компактный превью */}
                {gScenes.length > 0 && (
                  <div className="px-3.5 pb-3 flex flex-wrap gap-1">
                    {gScenes.slice(0, 6).map((sc) => (
                      <span key={sc.id} className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f2', color: textSecondary }}>
                        {sc.number}
                      </span>
                    ))}
                    {gScenes.length > 6 && <span className="text-[9px]" style={{ color: textSecondary }}>+{gScenes.length - 6}</span>}
                  </div>
                )}
              </div>
            )
          }),
        )}
      </div>
      </LayoutBox>
      </div>

      {/* Контекстное меню — цвет карточки */}
      {ctxMenu && (
        <div className="fixed rounded-xl p-2 z-50"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth - 190),
            top: Math.min(ctxMenu.y, window.innerHeight - 140),
            background: isDark ? '#1e1e3a' : '#ffffff',
            border: `1px solid ${border}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
          onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] mb-1.5 px-1" style={{ color: textSecondary }}>Цвет карточки</div>
          <div className="flex gap-1.5 px-1 pb-1">
            {TAG_COLORS.map((c) => (
              <button key={c} className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                style={{ background: c, border: `2px solid ${border}` }}
                onClick={() => { onUpdateScene?.(ctxMenu.id, { colorTag: c }); setCtxMenu(null) }} />
            ))}
            <button className="w-5 h-5 rounded-full text-[9px] transition-transform hover:scale-110"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: textSecondary }}
              title="Сбросить цвет"
              onClick={() => { onUpdateScene?.(ctxMenu.id, { colorTag: undefined }); setCtxMenu(null) }}>✕</button>
          </div>
          {/* Группы */}
          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${border}` }}>
            <div className="text-[10px] mb-1.5 px-1" style={{ color: textSecondary }}>В группу</div>
            <div className="px-1 pb-1 space-y-0.5">
              {(groupsByEpisode[ctxMenu.ep] || []).map((g) => (
                <button key={g.id}
                  className="w-full flex items-center gap-2 text-left px-1.5 py-1 rounded text-[11px] transition-all"
                  style={{ color: textPrimary, background: isDark ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                  onClick={() => {
                    updateGroups(ctxMenu.ep, (gs) => gs.map((x) => x.id === g.id ? { ...x, sceneIds: [...new Set([...x.sceneIds, ctxMenu.id])] } : x))
                    setCtxMenu(null)
                  }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />{g.name}
                </button>
              ))}
              <button
                className="w-full text-left px-1.5 py-1 rounded text-[11px]"
                style={{ color: '#fb923c' }}
                onClick={() => {
                  setNameModal({ ep: ctxMenu.ep, sceneIds: [ctxMenu.id] })
                  setNameInput(`Группа ${(groupsByEpisode[ctxMenu.ep] || []).length + 1}`)
                  setCtxMenu(null)
                }}>
                ＋ Новая группа
              </button>
              {groupOf(ctxMenu.ep, ctxMenu.id) && (
                <button
                  className="w-full text-left px-1.5 py-1 rounded text-[11px]"
                  style={{ color: textSecondary }}
                  onClick={() => {
                    updateGroups(ctxMenu.ep, (gs) => gs.map((x) => ({ ...x, sceneIds: x.sceneIds.filter((id) => id !== ctxMenu.id) })).filter((x) => x.sceneIds.length > 0))
                    setCtxMenu(null)
                  }}>
                  Убрать из группы
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Контекстное меню группы — переименовать / цвет / удалить */}
      {groupCtx && (
        <div className="fixed rounded-xl p-2 z-50"
          style={{
            left: Math.min(groupCtx.x, window.innerWidth - 200),
            top: Math.min(groupCtx.y, window.innerHeight - 160),
            background: isDark ? '#1e1e3a' : '#ffffff',
            border: `1px solid ${border}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
          onClick={(e) => e.stopPropagation()}>
          <button className="w-full text-left px-2 py-1.5 rounded text-[11px]"
            style={{ color: textPrimary }}
            onClick={() => {
              const g = (groupsByEpisode[groupCtx.ep] || []).find((x) => x.id === groupCtx.gid)
              setNameModal({ ep: groupCtx.ep, sceneIds: [], editGid: groupCtx.gid })
              setNameInput(g?.name || '')
              setGroupCtx(null)
            }}>
            Переименовать
          </button>
          <div className="text-[10px] mt-1 mb-1.5 px-1" style={{ color: textSecondary }}>Цвет группы</div>
          <div className="flex gap-1.5 px-1 pb-1">
            {['#fb923c', '#3b82f6', '#22c55e', '#a78bfa', '#ef4444'].map((c) => (
              <button key={c} className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                style={{ background: c, border: `2px solid ${border}` }}
                onClick={() => {
                  updateGroups(groupCtx.ep, (gs) => gs.map((x) => x.id === groupCtx.gid ? { ...x, color: c } : x))
                  setGroupCtx(null)
                }} />
            ))}
          </div>
          <button className="w-full text-left px-2 py-1.5 rounded text-[11px]"
            style={{ color: '#ef4444' }}
            onClick={() => {
              updateGroups(groupCtx.ep, (gs) => gs.filter((x) => x.id !== groupCtx.gid))
              setGroupCtx(null)
            }}>
            Удалить группу
          </button>
        </div>
      )}

      {/* Доска группы — окно со сценами группы, драг наружу убирает из группы */}
      {groupModal && (() => {
        const g = (groupsByEpisode[groupModal.ep] || []).find((x) => x.id === groupModal.gid)
        if (!g) return null
        const gScenes = scenes.filter((s) => g.sceneIds.includes(s.id) && (s._episode ?? 1) === groupModal.ep)
        const gDur = gScenes.reduce((s, sc) => s + (sc.manualDuration ?? sc.duration ?? 0), 0)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setGroupModal(null)}
            // Дроп на оверлей (за пределами окна) — убрать сцену из группы
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragIds.length) {
                updateGroups(groupModal.ep, (gs) => gs
                  .map((x) => x.id === g.id
                    ? { ...x, sceneIds: x.sceneIds.filter((id) => !dragIds.includes(id)) } : x)
                  .filter((x) => x.sceneIds.length > 0)) // пустая группа самоудаляется
              }
              setDragIds([])
            }}>
            <div className="rounded-2xl p-5 w-full max-w-5xl h-[78vh] overflow-y-auto"
              style={{ background: isDark ? '#13132a' : '#ffffff', border: `2px solid ${g.color}` }}
              onClick={(e) => e.stopPropagation()}
              onDragOver={(e) => e.stopPropagation()}
              onDrop={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `1px solid ${border}` }}>
                <input
                  value={g.name}
                  onChange={(e) => updateGroups(groupModal.ep, (gs) => gs.map((x) => x.id === g.id ? { ...x, name: e.target.value } : x))}
                  className="text-lg font-bold bg-transparent outline-none border-b border-transparent focus:border-orange-400 max-w-xs"
                  style={{ color: textPrimary }}
                />
                {/* Палитра цвета группы */}
                <div className="flex gap-1.5 ml-2">
                  {['#fb923c', '#3b82f6', '#22c55e', '#a78bfa', '#ef4444'].map((c) => (
                    <button key={c} className="w-4 h-4 rounded-full transition-transform hover:scale-125"
                      style={{ background: c, outline: c === g.color ? '2px solid #fff' : 'none', outlineOffset: 1 }}
                      onClick={() => updateGroups(groupModal.ep, (gs) => gs.map((x) => x.id === g.id ? { ...x, color: c } : x))} />
                  ))}
                </div>
                <span className="text-sm ml-2" style={{ color: textSecondary }}>{gScenes.length} сцен · {fmtDuration(gDur)}</span>
                <button onClick={() => setGroupModal(null)} className="ml-auto" style={{ color: textSecondary }}><X size={18} /></button>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {gScenes.map((sc) => (
                  <div
                    key={sc.id}
                    draggable
                    onDragStart={() => setDragIds([sc.id])}
                    onDragEnd={() => setDragIds([])}
                    onClick={() => setDetail(sc)}
                    onContextMenu={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      setCtxMenu({ x: e.clientX, y: e.clientY, id: sc.id, ep: groupModal.ep })
                    }}
                    className="rounded-xl p-3 cursor-grab transition-all hover:scale-[1.02]"
                    style={{ background: cardBg, border: `1px solid ${border}`, borderLeft: `3px solid ${g.color}` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-bold" style={{ color: TYPE_COLOR[sc.type] || '#94a3b8' }}>{sc.number}</span>
                      <span className="text-[10px]" style={{ color: textSecondary }}>{fmtDuration(sc.manualDuration ?? sc.duration ?? 0)}</span>
                    </div>
                    <div className="text-[11px] font-semibold truncate" style={{ color: textPrimary }}>
                      {sc.type}. {sc.location}{sc.sublocation ? `.${sc.sublocation}` : ''}
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: textSecondary }}>Перетащи на фон — убрать из группы</div>
                  </div>
                ))}
                {gScenes.length === 0 && (
                  <div className="col-span-full text-center py-8 text-sm" style={{ color: textSecondary }}>
                    Группа пуста — перетащи карточки с доски на этот контейнер в сайдбаре
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Модал имени новой группы */}
      {nameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setNameModal(null)}>
          <div className="rounded-2xl p-5 w-full max-w-sm"
            style={{ background: isDark ? '#1e1e3a' : '#ffffff', border: `1px solid ${border}` }}
            onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold mb-3" style={{ color: textPrimary }}>
              {nameModal.editGid ? 'Переименовать группу' : 'Новая группа'}
            </div>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (nameModal.editGid) {
                    updateGroups(nameModal.ep, (gs) => gs.map((x) => x.id === nameModal.editGid ? { ...x, name: nameInput.trim() } : x))
                  } else {
                    createGroup(nameModal.ep, nameInput, nameModal.sceneIds)
                  }
                  setNameModal(null)
                }
                if (e.key === 'Escape') setNameModal(null)
              }}
              className="w-full px-3 py-2 rounded-lg text-sm mb-4 outline-none"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0', color: textPrimary, border: `1px solid ${border}` }}
              placeholder="Название группы"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNameModal(null)}
                className="px-4 py-1.5 rounded-lg text-xs"
                style={{ color: textSecondary }}>Отмена</button>
              <button
                onClick={() => {
                  if (nameModal.editGid) {
                    updateGroups(nameModal.ep, (gs) => gs.map((x) => x.id === nameModal.editGid ? { ...x, name: nameInput.trim() } : x))
                  } else {
                    createGroup(nameModal.ep, nameInput, nameModal.sceneIds)
                  }
                  setNameModal(null)
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: '#fb923c', color: '#fff' }}>{nameModal.editGid ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Модал деталя сцены */}
      {detail && (
        <SceneDetailModal
          scene={detail}
          synopsis={syn(detail)}
          isDark={isDark}
          onClose={() => setDetail(null)}
          onGoToScene={(id) => { setDetail(null); onSceneClick?.(id) }}
          onEditScene={(sc) => { setDetail(null); onOpenSceneEditor?.(sc) }}
          onUpdate={onUpdateScene}
        />
      )}
    </div>
  )
}

export default memo(CardsView)
