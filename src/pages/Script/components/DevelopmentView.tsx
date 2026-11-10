import { memo, useMemo, useState } from 'react'
import {
  Users, MapPin, FileText, ListTree, Plus, Trash2, Sparkles, X,
  Search, FolderPlus, Folder, ArrowUpDown,
} from 'lucide-react'
import type { Scene } from '../../../types/scene'
import type {
  DevCharacter, DevCharacterType, DevLocation, DevSynopsis, ProjectDevelopment,
} from '../../../types/development'

const CHAR_TYPES: Record<DevCharacterType, { l: string; c: string }> = {
  main:      { l: 'Главный',        c: '#fb923c' },
  secondary: { l: 'Второстепенный', c: '#818cf8' },
  episodic:  { l: 'Эпизодный',      c: '#9ca3af' },
}
const FOLDER_COLORS = ['#fb923c', '#818cf8', '#34d399', '#f59e0b', '#a78bfa', '#ef4444'] as const

type SortBy = 'manual' | 'alpha' | 'appearance' | 'scenes' | 'duration'

interface DevelopmentViewProps {
  isDark: boolean
  scenes: Array<Scene & { _episode?: number }>
  isSerial?: boolean
  episodesCount?: number
  development: ProjectDevelopment | undefined
  onDevelopmentChange: (dev: ProjectDevelopment) => void
}

const uid = () => `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const emptyDev: ProjectDevelopment = { characters: [], locations: [], synopsis: {}, folders: [] }

function DevelopmentView({ isDark, scenes, isSerial, episodesCount, development, onDevelopmentChange }: DevelopmentViewProps) {
  const [tab, setTab] = useState<'chars' | 'locs' | 'synopsis' | 'episodes'>('chars')
  const [editChar, setEditChar] = useState<DevCharacter | 'new' | null>(null)
  const [editLoc, setEditLoc] = useState<DevLocation | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DevCharacterType | 'all'>('all')
  const [epFilter, setEpFilter] = useState<number | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortBy>('appearance')
  const [folderFilter, setFolderFilter] = useState<string | 'all' | 'none'>('all')
  const [folderCtx, setFolderCtx] = useState<{ x: number; y: number; kind: 'chars' | 'locs'; itemId: string } | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [dragItemId, setDragItemId] = useState<string | null>(null)

  const dev = development ?? emptyDev
  const folders = dev.folders ?? []
  const setDev = (patch: Partial<ProjectDevelopment>) => onDevelopmentChange({ ...dev, ...patch })

  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const fieldBg = isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'

  /* ── Карты из текста: имя → сцены ── */
  const charNamesInText = useMemo(() => {
    const map = new Map<string, string[]>()
    scenes.forEach((sc) => {
      const names = [...(sc.cast || []), ...(sc.dialogCharacters || [])]
      names.forEach((n) => {
        const key = n.trim().toUpperCase()
        if (!key) return
        const cur = map.get(key) ?? []
        if (!cur.includes(sc.id)) cur.push(sc.id)
        map.set(key, cur)
      })
    })
    return map
  }, [scenes])

  const locNamesInText = useMemo(() => {
    const map = new Map<string, string[]>()
    scenes.forEach((sc) => {
      const key = (sc.location || '').trim().toUpperCase()
      if (!key) return
      const cur = map.get(key) ?? []
      if (!cur.includes(sc.id)) cur.push(sc.id)
      map.set(key, cur)
    })
    return map
  }, [scenes])

  /* Экранное время: сумма длительности сцен */
  const sceneDur = useMemo(() => {
    const m = new Map<string, number>()
    scenes.forEach((s) => m.set(s.id, s.manualDuration ?? s.duration ?? 0))
    return m
  }, [scenes])
  const durOf = (ids: string[]) => ids.reduce((a, id) => a + (sceneDur.get(id) ?? 0), 0)

  const charSceneIds = (c: DevCharacter) => c.sceneIds ?? charNamesInText.get(c.name.toUpperCase()) ?? []
  const locSceneIds = (l: DevLocation) => l.sceneIds ?? locNamesInText.get(l.name.toUpperCase()) ?? []
  const charSceneCount = (c: DevCharacter) => charSceneIds(c).length
  const locSceneCount = (l: DevLocation) => locSceneIds(l).length

  /* Порядок появления = индекс первой сцены в массиве scenes */
  const sceneOrder = useMemo(() => {
    const m = new Map<string, number>()
    scenes.forEach((s, i) => m.set(s.id, i))
    return m
  }, [scenes])
  const firstAppearance = (ids: string[]) =>
    ids.reduce((min, id) => Math.min(min, sceneOrder.get(id) ?? Infinity), Infinity)

  /* ── Импорт ── */
  const importChars = () => {
    const existing = new Set(dev.characters.map((c) => c.name.toUpperCase()))
    const fresh: DevCharacter[] = [...dev.characters]
    charNamesInText.forEach((sceneIds, name) => {
      if (existing.has(name)) {
        const cur = fresh.find((c) => c.name.toUpperCase() === name)
        if (cur) cur.sceneIds = sceneIds
      } else {
        fresh.push({ id: uid(), name, type: 'secondary', sceneIds })
      }
    })
    setDev({ characters: fresh })
  }
  const importLocs = () => {
    const existing = new Set(dev.locations.map((l) => l.name.toUpperCase()))
    const fresh: DevLocation[] = [...dev.locations]
    locNamesInText.forEach((sceneIds, name) => {
      if (existing.has(name)) {
        const cur = fresh.find((l) => l.name.toUpperCase() === name)
        if (cur) cur.sceneIds = sceneIds
      } else {
        fresh.push({ id: uid(), name, sceneIds })
      }
    })
    setDev({ locations: fresh })
  }

  /* ── Фильтры + сортировка ── */
  const applySearch = (name: string) => !search || name.toLowerCase().includes(search.toLowerCase())
  const applyFolder = (id: string, kind: 'chars' | 'locs') => {
    if (folderFilter === 'all') return true
    if (folderFilter === 'none') return !folders.some((f) => f.kind === kind && f.itemIds.includes(id))
    const f = folders.find((x) => x.id === folderFilter)
    return f ? f.itemIds.includes(id) : true
  }

  const filteredChars = useMemo(() => {
    let list = dev.characters
      .filter((c) => applySearch(c.name))
      .filter((c) => typeFilter === 'all' || c.type === typeFilter)
      .filter((c) => epFilter === 'all' || c.episodeTag === epFilter)
      .filter((c) => applyFolder(c.id, 'chars'))
    const by = {
      manual: (a: DevCharacter, b: DevCharacter) => (a.order ?? 999) - (b.order ?? 999),
      alpha: (a: DevCharacter, b: DevCharacter) => a.name.localeCompare(b.name, 'ru'),
      appearance: (a: DevCharacter, b: DevCharacter) => firstAppearance(charSceneIds(a)) - firstAppearance(charSceneIds(b)),
      scenes: (a: DevCharacter, b: DevCharacter) => charSceneCount(b) - charSceneCount(a),
      duration: (a: DevCharacter, b: DevCharacter) => durOf(charSceneIds(b)) - durOf(charSceneIds(a)),
    }[sortBy]
    return [...list].sort(by)
  }, [dev.characters, search, typeFilter, epFilter, sortBy, folderFilter, charNamesInText, scenes, folders])

  const filteredLocs = useMemo(() => {
    let list = dev.locations
      .filter((l) => applySearch(l.name))
      .filter((l) => applyFolder(l.id, 'locs'))
    const by = {
      manual: (a: DevLocation, b: DevLocation) => (a.order ?? 999) - (b.order ?? 999),
      alpha: (a: DevLocation, b: DevLocation) => a.name.localeCompare(b.name, 'ru'),
      appearance: (a: DevLocation, b: DevLocation) => firstAppearance(locSceneIds(a)) - firstAppearance(locSceneIds(b)),
      scenes: (a: DevLocation, b: DevLocation) => locSceneCount(b) - locSceneCount(a),
      duration: (a: DevLocation, b: DevLocation) => durOf(locSceneIds(b)) - durOf(locSceneIds(a)),
    }[sortBy]
    return [...list].sort(by)
  }, [dev.locations, search, sortBy, folderFilter, locNamesInText, scenes, folders])

  /* ── Папки ── */
  const foldersOfKind = folders.filter((f) => f.kind === tab || (tab === 'chars' && f.kind === 'chars') || (tab === 'locs' && f.kind === 'locs'))
  const addFolder = (kind: 'chars' | 'locs', name: string) => {
    if (!name.trim()) return
    const color = FOLDER_COLORS[folders.filter((f) => f.kind === kind).length % FOLDER_COLORS.length]
    setDev({ folders: [...folders, { id: uid(), name: name.trim(), color, kind, itemIds: [] }] })
    setNewFolderName('')
    setShowNewFolder(false)
  }
  const removeFolder = (id: string) => setDev({ folders: folders.filter((f) => f.id !== id) })
  const toggleItemInFolder = (folderId: string, itemId: string) => {
    setDev({
      folders: folders.map((f) => f.id === folderId
        ? { ...f, itemIds: f.itemIds.includes(itemId) ? f.itemIds.filter((x) => x !== itemId) : [...f.itemIds, itemId] }
        : f),
    })
  }

  /* ── Драг-сортировка (manual) ── */
  const onCardDragStart = (id: string) => (e: React.DragEvent) => {
    if (sortBy !== 'manual') { e.preventDefault(); return }
    setDragItemId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onCardDrop = (targetId: string, kind: 'chars' | 'locs') => (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragItemId || dragItemId === targetId) return
    const items = kind === 'chars' ? filteredChars : filteredLocs
    const ordered = items.map((x) => x.id)
    const from = ordered.indexOf(dragItemId)
    const to = ordered.indexOf(targetId)
    if (from < 0 || to < 0) return
    ordered.splice(to, 0, ...ordered.splice(from, 1))
    const orderMap = new Map(ordered.map((id, i) => [id, i]))
    if (kind === 'chars') {
      setDev({ characters: dev.characters.map((c) => ({ ...c, order: orderMap.has(c.id) ? orderMap.get(c.id) : (c.order ?? 999) })) })
    } else {
      setDev({ locations: dev.locations.map((l) => ({ ...l, order: orderMap.has(l.id) ? orderMap.get(l.id) : (l.order ?? 999) })) })
    }
    setDragItemId(null)
  }

  const SubTab = ({ k, icon, label }: { k: typeof tab; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => { setTab(k); setFolderFilter('all') }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: tab === k ? 'rgba(249,115,22,0.15)' : 'transparent', color: tab === k ? '#fb923c' : textSecondary }}
    >
      {icon}{label}
    </button>
  )

  const isContentTab = tab === 'chars' || tab === 'locs'

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      {/* ── Основной контент ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold" style={{ color: textPrimary }}>Разработка</h2>
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ececf0' }}>
              <SubTab k="chars" icon={<Users size={13} />} label="Персонажи" />
              <SubTab k="locs" icon={<MapPin size={13} />} label="Локации" />
              <SubTab k="synopsis" icon={<FileText size={13} />} label="Синопсис" />
              <SubTab k="episodes" icon={<ListTree size={13} />} label="Посерийник" />
            </div>
          </div>

          {/* Панель: поиск + сортировка + тип + серия */}
          {isContentTab && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                <Search size={12} style={{ color: textSecondary }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tab === 'chars' ? 'Персонаж…' : 'Локация…'}
                  className="bg-transparent outline-none text-xs w-36"
                  style={{ color: textPrimary }}
                />
                {search && <button onClick={() => setSearch('')}><X size={11} style={{ color: textSecondary }} /></button>}
              </div>
              <div className="flex items-center gap-1 rounded-lg px-2 py-1" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                <ArrowUpDown size={11} style={{ color: textSecondary }} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="bg-transparent outline-none text-xs"
                  style={{ color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="appearance">По появлению</option>
                  <option value="alpha">По алфавиту</option>
                  <option value="scenes">Больше сцен</option>
                  <option value="duration">Больше времени</option>
                  <option value="manual">Вручную (драг)</option>
                </select>
              </div>
              {tab === 'chars' && (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as DevCharacterType | 'all')}
                  className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="all">Все типы</option>
                  {Object.entries(CHAR_TYPES).map(([v, t]) => <option key={v} value={v}>{t.l}</option>)}
                </select>
              )}
              {tab === 'chars' && isSerial && (
                <select
                  value={epFilter}
                  onChange={(e) => setEpFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="all">Все серии</option>
                  {Array.from({ length: episodesCount || 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Серия {n}</option>)}
                </select>
              )}
            </div>
          )}

          {/* ── Персонажи ── */}
          {tab === 'chars' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setEditChar('new')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}>
                  <Plus size={12} /> Персонаж
                </button>
                <button onClick={importChars}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ color: textSecondary, border: `1px solid ${border}` }}
                  title="Собрать персонажей из текста сценария">
                  <Sparkles size={12} /> Импорт из текста ({charNamesInText.size})
                </button>
                <span className="text-[10px]" style={{ color: textSecondary }}>{filteredChars.length} из {dev.characters.length}</span>
              </div>
              {filteredChars.length === 0 ? (
                <Empty text={dev.characters.length ? 'Никого не найдено по фильтрам' : 'Пусто — добавь или импортируй из текста'} isDark={isDark} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredChars.map((c) => {
                    const t = CHAR_TYPES[c.type]
                    return (
                      <div
                        key={c.id}
                        draggable={sortBy === 'manual'}
                        onDragStart={onCardDragStart(c.id)}
                        onDragOver={(e) => sortBy === 'manual' && e.preventDefault()}
                        onDrop={onCardDrop(c.id, 'chars')}
                        onContextMenu={(e) => { e.preventDefault(); setFolderCtx({ x: e.clientX, y: e.clientY, kind: 'chars', itemId: c.id }) }}
                        className="rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5"
                        style={{
                          background: cardBg, border: `1px solid ${border}`, borderTop: `2px solid ${t.c}`,
                          opacity: dragItemId === c.id ? 0.4 : 1,
                          cursor: sortBy === 'manual' ? 'grab' : 'pointer',
                        }}
                        onClick={() => setEditChar(c)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="text-sm font-bold" style={{ color: textPrimary }}>{c.name}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${t.c}22`, color: t.c }}>{t.l}</span>
                              {c.episodeTag != null && isSerial && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>С{c.episodeTag}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px]" style={{ color: textSecondary }}>{charSceneCount(c)} сцен</div>
                            <div className="text-[9px]" style={{ color: textSecondary }}>{Math.round(durOf(charSceneIds(c)) / 60)} мин</div>
                          </div>
                        </div>
                        {c.description && <p className="text-[11px] leading-snug mb-2 line-clamp-3" style={{ color: textSecondary }}>{c.description}</p>}
                        {c.arc && <p className="text-[10px] italic leading-snug line-clamp-2" style={{ color: '#fb923c' }}>↳ {c.arc}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Локации ── */}
          {tab === 'locs' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setEditLoc('new')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                  <Plus size={12} /> Локация
                </button>
                <button onClick={importLocs}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ color: textSecondary, border: `1px solid ${border}` }}
                  title="Собрать локации из шапок сцен">
                  <Sparkles size={12} /> Импорт из текста ({locNamesInText.size})
                </button>
                <span className="text-[10px]" style={{ color: textSecondary }}>{filteredLocs.length} из {dev.locations.length}</span>
              </div>
              {filteredLocs.length === 0 ? (
                <Empty text={dev.locations.length ? 'Ничего не найдено по фильтрам' : 'Пусто — добавь или импортируй из текста'} isDark={isDark} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredLocs.map((l) => (
                    <div
                      key={l.id}
                      draggable={sortBy === 'manual'}
                      onDragStart={onCardDragStart(l.id)}
                      onDragOver={(e) => sortBy === 'manual' && e.preventDefault()}
                      onDrop={onCardDrop(l.id, 'locs')}
                      onContextMenu={(e) => { e.preventDefault(); setFolderCtx({ x: e.clientX, y: e.clientY, kind: 'locs', itemId: l.id }) }}
                      className="rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5"
                      style={{
                        background: cardBg, border: `1px solid ${border}`, borderTop: '2px solid #34d399',
                        opacity: dragItemId === l.id ? 0.4 : 1,
                        cursor: sortBy === 'manual' ? 'grab' : 'pointer',
                      }}
                      onClick={() => setEditLoc(l)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="text-sm font-bold" style={{ color: textPrimary }}>{l.name}</div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px]" style={{ color: textSecondary }}>{locSceneCount(l)} сцен</div>
                          <div className="text-[9px]" style={{ color: textSecondary }}>{Math.round(durOf(locSceneIds(l)) / 60)} мин</div>
                        </div>
                      </div>
                      {l.description && <p className="text-[11px] leading-snug line-clamp-3" style={{ color: textSecondary }}>{l.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Синопсис ── */}
          {tab === 'synopsis' && (
            <SynopsisTab syn={dev.synopsis} onChange={(s) => setDev({ synopsis: s })}
              isDark={isDark} textPrimary={textPrimary} textSecondary={textSecondary} fieldBg={fieldBg} border={border} />
          )}

          {/* ── Посерийник ── */}
          {tab === 'episodes' && (
            <div className="rounded-xl p-8 text-center" style={{ background: cardBg, border: `1px solid ${border}` }}>
              <ListTree size={28} className="mx-auto mb-3" style={{ color: '#fb923c' }} />
              <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>Посерийник</p>
              <p className="text-xs" style={{ color: textSecondary }}>План по сериям — логлайн, статус, сцены. Отдельный заход.</p>
              {isSerial && <p className="text-[10px] mt-2" style={{ color: textSecondary }}>В проекте {episodesCount || 8} серий</p>}
            </div>
          )}
        </div>
      </div>

      {/* ── Папки — сайдбар как в «Карточках» ── */}
      {isContentTab && (
        <div
          className="shrink-0 border-l overflow-y-auto"
          style={{
            width: 200, padding: '16px 12px',
            background: isDark ? 'rgba(249,115,22,0.06)' : 'rgba(251,146,60,0.05)',
            borderColor: border,
            boxShadow: 'inset 2px 0 8px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#fb923c' }}>Папки</span>
            <button onClick={() => setShowNewFolder(!showNewFolder)} title="Новая папка"
              className="p-1 rounded-md transition-all hover:bg-white/10" style={{ color: '#fb923c' }}>
              <FolderPlus size={13} />
            </button>
          </div>
          {showNewFolder && (
            <div className="flex gap-1 mb-2">
              <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFolder(tab === 'chars' ? 'chars' : 'locs', newFolderName)}
                placeholder="Имя папки" autoFocus
                className="flex-1 min-w-0 rounded-md px-2 py-1 text-[11px] outline-none"
                style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
              <button onClick={() => addFolder(tab === 'chars' ? 'chars' : 'locs', newFolderName)}
                className="px-2 rounded-md text-[11px] font-bold" style={{ background: '#fb923c', color: '#fff' }}>+</button>
            </div>
          )}
          <button
            onClick={() => setFolderFilter('all')}
            className="w-full text-left px-2 py-1.5 rounded-md text-[11px] mb-0.5 transition-all"
            style={{ color: folderFilter === 'all' ? '#fb923c' : textSecondary, background: folderFilter === 'all' ? 'rgba(251,146,60,0.12)' : 'transparent' }}
          >
            Все {tab === 'chars' ? 'персонажи' : 'локации'}
          </button>
          <button
            onClick={() => setFolderFilter('none')}
            className="w-full text-left px-2 py-1.5 rounded-md text-[11px] mb-1 transition-all"
            style={{ color: folderFilter === 'none' ? '#fb923c' : textSecondary, background: folderFilter === 'none' ? 'rgba(251,146,60,0.12)' : 'transparent' }}
          >
            Без папки
          </button>
          {foldersOfKind.map((f) => (
            <div key={f.id} className="group flex items-center gap-1 mb-0.5">
              <button
                onClick={() => setFolderFilter(folderFilter === f.id ? 'all' : f.id)}
                className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-all text-left"
                style={{ color: folderFilter === f.id ? f.color : textSecondary, background: folderFilter === f.id ? `${f.color}20` : 'transparent' }}
              >
                <Folder size={11} style={{ color: f.color, fill: `${f.color}40` }} />
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-[9px]" style={{ color: textSecondary }}>{f.itemIds.length}</span>
              </button>
              <button onClick={() => removeFolder(f.id)} title="Удалить папку"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all" style={{ color: textSecondary }}>
                <X size={10} />
              </button>
            </div>
          ))}
          {foldersOfKind.length === 0 && !showNewFolder && (
            <p className="text-[10px] px-2 py-2" style={{ color: textSecondary }}>
              ПКМ по карточке → «В папку»
            </p>
          )}
        </div>
      )}

      {/* ── Контекстное меню «В папку» ── */}
      {folderCtx && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setFolderCtx(null)} onContextMenu={(e) => { e.preventDefault(); setFolderCtx(null) }} />
          <div
            className="fixed z-[85] rounded-xl py-1 min-w-[160px]"
            style={{
              left: Math.min(folderCtx.x, window.innerWidth - 200), top: Math.min(folderCtx.y, window.innerHeight - 200),
              background: isDark ? '#1b1b30' : '#fff', border: `1px solid ${border}`, boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase" style={{ color: textSecondary }}>В папку</div>
            {folders.filter((f) => f.kind === folderCtx.kind).map((f) => (
              <button
                key={f.id}
                onClick={() => { toggleItemInFolder(f.id, folderCtx.itemId); setFolderCtx(null) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-all hover:bg-white/5"
                style={{ color: textPrimary }}
              >
                <Folder size={11} style={{ color: f.color, fill: f.itemIds.includes(folderCtx.itemId) ? f.color : `${f.color}40` }} />
                <span className="flex-1">{f.name}</span>
                {f.itemIds.includes(folderCtx.itemId) && <span style={{ color: f.color }}>✓</span>}
              </button>
            ))}
            {folders.filter((f) => f.kind === folderCtx.kind).length === 0 && (
              <div className="px-3 py-1.5 text-[10px]" style={{ color: textSecondary }}>Нет папок — создайте в сайдбаре</div>
            )}
          </div>
        </>
      )}

      {/* ── Модал персонажа ── */}
      {editChar && (
        <CharModal
          char={editChar === 'new' ? { id: uid(), name: '', type: 'secondary' } : editChar}
          isNew={editChar === 'new'}
          isSerial={isSerial}
          episodesCount={episodesCount}
          isDark={isDark}
          scenes={scenes}
          charSceneIds={editChar === 'new' ? [] : charSceneIds(editChar)}
          onClose={() => setEditChar(null)}
          onDelete={editChar === 'new' ? undefined : () => {
            const cid = (editChar as DevCharacter).id
            setDev({ characters: dev.characters.filter((c) => c.id !== cid), folders: folders.map((f) => ({ ...f, itemIds: f.itemIds.filter((x) => x !== cid) })) })
            setEditChar(null)
          }}
          onSave={(c) => {
            const exists = dev.characters.some((x) => x.id === c.id)
            setDev({ characters: exists ? dev.characters.map((x) => (x.id === c.id ? c : x)) : [...dev.characters, c] })
            setEditChar(null)
          }}
        />
      )}

      {/* ── Модал локации ── */}
      {editLoc && (
        <LocModal
          loc={editLoc === 'new' ? { id: uid(), name: '' } : editLoc}
          isNew={editLoc === 'new'}
          isDark={isDark}
          scenes={scenes}
          locSceneIds={editLoc === 'new' ? [] : locSceneIds(editLoc)}
          onClose={() => setEditLoc(null)}
          onDelete={editLoc === 'new' ? undefined : () => {
            const lid = (editLoc as DevLocation).id
            setDev({ locations: dev.locations.filter((l) => l.id !== lid), folders: folders.map((f) => ({ ...f, itemIds: f.itemIds.filter((x) => x !== lid) })) })
            setEditLoc(null)
          }}
          onSave={(l) => {
            const exists = dev.locations.some((x) => x.id === l.id)
            setDev({ locations: exists ? dev.locations.map((x) => (x.id === l.id ? l : x)) : [...dev.locations, l] })
            setEditLoc(null)
          }}
        />
      )}
    </div>
  )
}

/* ── Пустое состояние ── */
function Empty({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: isDark ? '#13132a' : '#fff', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}` }}>
      <p className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{text}</p>
    </div>
  )
}

/* ── Вкладка Синопсис ── */
function SynopsisTab({ syn, onChange, isDark, textPrimary, textSecondary, fieldBg, border }: {
  syn: DevSynopsis; onChange: (s: DevSynopsis) => void;
  isDark: boolean; textPrimary: string; textSecondary: string; fieldBg: string; border: string
}) {
  const F = ({ label, hint, field, rows }: { label: string; hint?: string; field: keyof DevSynopsis; rows: number }) => (
    <div className="rounded-xl p-4" style={{ background: isDark ? '#13132a' : '#fff', border: `1px solid ${border}` }}>
      <div className="flex items-baseline gap-2 mb-1">
        <div className="text-[10px] font-bold" style={{ color: '#fb923c' }}>{label}</div>
        {hint && <div className="text-[9px]" style={{ color: textSecondary }}>{hint}</div>}
      </div>
      <textarea
        value={syn[field] ?? ''}
        onChange={(e) => onChange({ ...syn, [field]: e.target.value })}
        rows={rows}
        placeholder={hint}
        className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
        style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }}
      />
    </div>
  )
  return (
    <div className="space-y-4">
      <F label="ЛОГЛАЙН" hint="герой + желание + препятствие — одно предложение" field="logline" rows={2} />
      <F label="СИНОПСИС" hint="краткое содержание — 1 абзац" field="synopsis" rows={5} />
      <F label="ЗАМЕТКИ" hint="мир, темы, тон, референсы" field="notes" rows={6} />
    </div>
  )
}

/* ── Модал персонажа — расширенная ── */
function CharModal({ char, isNew, isSerial, episodesCount, isDark, scenes, charSceneIds, onClose, onSave, onDelete }: {
  char: DevCharacter; isNew: boolean; isSerial?: boolean; episodesCount?: number; isDark: boolean
  scenes: Array<Scene & { _episode?: number }>
  charSceneIds: string[]
  onClose: () => void; onSave: (c: DevCharacter) => void; onDelete?: () => void
}) {
  const [name, setName] = useState(char.name)
  const [type, setType] = useState<DevCharacterType>(char.type)
  const [desc, setDesc] = useState(char.description ?? '')
  const [arc, setArc] = useState(char.arc ?? '')
  const [ep, setEp] = useState<number | ''>(char.episodeTag ?? '')
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const fieldBg = isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'

  const charScenes = useMemo(
    () => charSceneIds.map((id) => scenes.find((s) => s.id === id)).filter(Boolean) as Array<Scene & { _episode?: number }>,
    [charSceneIds, scenes],
  )
  const durTotal = charScenes.reduce((a, s) => a + (s.manualDuration ?? s.duration ?? 0), 0)
  const firstScene = charScenes[0]

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>{label}</div>
      {children}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div
        className="rounded-2xl flex flex-col overflow-hidden"
        style={{ background: isDark ? '#1a1a33' : '#fff', border: `1px solid rgba(249,115,22,0.35)`, borderTop: '3px solid #fb923c', width: 'min(680px, 94vw)', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${border}` }}>
          <span className="text-sm font-bold" style={{ color: '#fb923c' }}>{isNew ? 'Новый персонаж' : `Персонаж — ${char.name || 'без имени'}`}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X size={15} style={{ color: textSecondary }} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Имя + тип + серия */}
          <div className="grid grid-cols-3 gap-3">
            <F label="ИМЯ">
              <input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="ИВАН"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none font-bold"
                style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
            </F>
            <F label="ТИП">
              <select value={type} onChange={(e) => setType(e.target.value as DevCharacterType)}
                className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }}>
                {Object.entries(CHAR_TYPES).map(([v, t]) => <option key={v} value={v}>{t.l}</option>)}
              </select>
            </F>
            {isSerial ? (
              <F label="СЕРИЯ">
                <select value={ep === '' ? '' : ep} onChange={(e) => setEp(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }}>
                  <option value="">Весь проект</option>
                  {Array.from({ length: episodesCount || 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Серия {n}</option>)}
                </select>
              </F>
            ) : <div />}
          </div>

          {/* Метрики */}
          {!isNew && charScenes.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-2.5 text-center" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                <div className="text-base font-bold" style={{ color: '#fb923c' }}>{charScenes.length}</div>
                <div className="text-[9px]" style={{ color: textSecondary }}>сцен</div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                <div className="text-base font-bold" style={{ color: '#fb923c' }}>{Math.round(durTotal / 60)}</div>
                <div className="text-[9px]" style={{ color: textSecondary }}>мин экранного</div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                <div className="text-base font-bold" style={{ color: '#fb923c' }}>{firstScene ? `С${firstScene._episode ?? 1}-${firstScene.number}` : '—'}</div>
                <div className="text-[9px]" style={{ color: textSecondary }}>первое появление</div>
              </div>
            </div>
          )}

          <F label="ОПИСАНИЕ">
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="Кто он, драматическая функция, характер…"
              className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none leading-relaxed"
              style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
          </F>

          <F label="АРКА (откуда → куда)">
            <textarea value={arc} onChange={(e) => setArc(e.target.value)} rows={3} placeholder="Из труса — в героя…"
              className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none leading-relaxed"
              style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
          </F>

          {/* Сцены, где появляется */}
          {!isNew && charScenes.length > 0 && (
            <F label={`СЦЕНЫ С УЧАСТИЕМ (${charScenes.length})`}>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-lg" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                {charScenes.map((s) => (
                  <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c' }}>
                    С{s._episode ?? 1}-{s.number}
                  </span>
                ))}
              </div>
            </F>
          )}
        </div>

        {/* Футер */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${border}` }}>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button onClick={onDelete} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: '#ef4444' }}>
                <Trash2 size={11} /> Удалить
              </button>
            )}
          </div>
          <button
            onClick={() => { if (!name.trim()) return; onSave({ ...char, name: name.trim(), type, description: desc, arc, episodeTag: ep === '' ? undefined : ep }) }}
            className="px-5 py-2 rounded-lg text-xs font-bold"
            style={{ background: '#fb923c', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}
            disabled={!name.trim()}
          >
            {isNew ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Модал локации — расширенная ── */
function LocModal({ loc, isNew, isDark, scenes, locSceneIds, onClose, onSave, onDelete }: {
  loc: DevLocation; isNew: boolean; isDark: boolean
  scenes: Array<Scene & { _episode?: number }>
  locSceneIds: string[]
  onClose: () => void; onSave: (l: DevLocation) => void; onDelete?: () => void
}) {
  const [name, setName] = useState(loc.name)
  const [desc, setDesc] = useState(loc.description ?? '')
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const fieldBg = isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'

  const locScenes = useMemo(
    () => locSceneIds.map((id) => scenes.find((s) => s.id === id)).filter(Boolean) as Array<Scene & { _episode?: number }>,
    [locSceneIds, scenes],
  )
  const durTotal = locScenes.reduce((a, s) => a + (s.manualDuration ?? s.duration ?? 0), 0)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div
        className="rounded-2xl flex flex-col overflow-hidden"
        style={{ background: isDark ? '#1a1a33' : '#fff', border: `1px solid rgba(52,211,153,0.35)`, borderTop: '3px solid #34d399', width: 'min(600px, 94vw)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${border}` }}>
          <span className="text-sm font-bold" style={{ color: '#34d399' }}>{isNew ? 'Новая локация' : `Локация — ${loc.name || 'без имени'}`}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X size={15} style={{ color: textSecondary }} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>НАЗВАНИЕ</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="КВАРТИРА ИВАНА"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none font-bold"
              style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
          </div>

          {!isNew && locScenes.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-2.5 text-center" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                <div className="text-base font-bold" style={{ color: '#34d399' }}>{locScenes.length}</div>
                <div className="text-[9px]" style={{ color: textSecondary }}>сцен</div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                <div className="text-base font-bold" style={{ color: '#34d399' }}>{Math.round(durTotal / 60)}</div>
                <div className="text-[9px]" style={{ color: textSecondary }}>мин экранного</div>
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>ОПИСАНИЕ</div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="Характер, особенности, реквизит…"
              className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none leading-relaxed"
              style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
          </div>

          {!isNew && locScenes.length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>СЦЕНЫ ({locScenes.length})</div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-lg" style={{ background: fieldBg, border: `1px solid ${border}` }}>
                {locScenes.map((s) => (
                  <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                    С{s._episode ?? 1}-{s.number}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${border}` }}>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button onClick={onDelete} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: '#ef4444' }}>
                <Trash2 size={11} /> Удалить
              </button>
            )}
          </div>
          <button
            onClick={() => { if (!name.trim()) return; onSave({ ...loc, name: name.trim(), description: desc }) }}
            className="px-5 py-2 rounded-lg text-xs font-bold"
            style={{ background: '#34d399', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}
            disabled={!name.trim()}
          >
            {isNew ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(DevelopmentView)
