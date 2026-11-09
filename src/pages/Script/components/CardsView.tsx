import { memo, useMemo, useState } from 'react'
import { Film, Clock, Users, Search, X } from 'lucide-react'
import type { Scene } from '../../../types/scene'
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

function CardsView({ isDark, scenes, blocks, isSerial, episodesCount = 8, onSceneClick, onUpdateScene, onOpenSceneEditor, onMoveScenes }: CardsViewProps) {
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'ИНТ' | 'ЭКСТ' | 'ПАВ'>('all')
  const [series, setSeries] = useState<number | 'all'>('all')
  const [detail, setDetail] = useState<SceneWithEp | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  // Драг и мультивыбор
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragIds, setDragIds] = useState<string[]>([])
  const [dropKey, setDropKey] = useState<string | null>(null)

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
      onClick={() => { setCtxMenu(null); if (selected.size) setSelected(new Set()) }}>

      {/* Шапка: поиск + фильтры */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-3 flex-wrap">
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
      </div>

      {/* Доска */}
      <div className="flex-1 overflow-y-auto px-6 pb-6" onScroll={() => setCtxMenu(null)}>
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
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
                {items.map((sc, i) => {
                  const tagColor = sc.colorTag || TYPE_COLOR[sc.type] || '#94a3b8'
                  const dur = sc.manualDuration ?? sc.duration ?? 0
                  const synopsis = syn(sc)
                  const st = sc.status && sc.status !== 'not_planned' ? STATUS_LABEL[sc.status] : null
                  const isSel = selected.has(sc.id)
                  const isDrop = dropKey === `${episode}:${i}`
                  return (
                    <div
                      key={sc.id}
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
                        if (dragIds.length) onMoveScenes?.(dragIds, episode, i)
                        setDragIds([]); setDropKey(null); setSelected(new Set())
                      }}
                      onDragEnd={() => { setDragIds([]); setDropKey(null) }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setCtxMenu({ x: e.clientX, y: e.clientY, id: sc.id })
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.55)'
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(249,115,22,0.15)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSel && !isDrop) { e.currentTarget.style.borderColor = border; e.currentTarget.style.boxShadow = 'none' }
                      }}
                      className="rounded-xl p-3.5 transition-all hover:-translate-y-0.5"
                      style={{
                        background: cardBg,
                        border: `1px solid ${isDrop ? '#fb923c' : isSel ? 'rgba(249,115,22,0.7)' : border}`,
                        borderLeft: `3px solid ${tagColor}`,
                        cursor: 'grab',
                        opacity: sc.isOmitted ? 0.55 : dragIds.includes(sc.id) ? 0.4 : 1,
                        boxShadow: isDrop ? '0 0 0 2px rgba(249,115,22,0.35)' : isSel ? '0 0 0 1.5px rgba(249,115,22,0.35)' : undefined,
                      }}
                      title="Клик — детали · Ctrl+клик — выбрать · правый клик — цвет · перетащи для перестановки"
                    >
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
                    </div>
                  )
                })}
              </div>
              {/* Дроп-зона — перенос в конец серии */}
              {dragIds.length > 0 && (
                <div
                  className="mt-2 rounded-lg text-center text-[10px] py-2 transition-all"
                  style={{
                    border: `1.5px dashed ${dropKey === `${episode}:end` ? '#fb923c' : border}`,
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
