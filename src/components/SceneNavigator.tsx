import { useState, useMemo, useEffect, memo, useCallback } from 'react'
import { Film, MapPin, Clock, ChevronDown, ChevronRight, ChevronUp, Search, X, SlidersHorizontal } from 'lucide-react'
import {
  DndContext,
  closestCorners,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TimingSystem, Scene, DraftStatus } from '../types/scene'
import {
  countByField, presentColorTags, toggleInList, applyNavigatorFilters,
  nextSceneIndex, scenesOfSeries,
} from '../utils/sceneFilters'
import { calculateSceneTiming, formatDuration } from '../utils/sceneTiming'
import { draftStatusById, allDraftStatuses } from '../utils/draftStatus'

function getTimeIcon(time: string) {
  const t = (time || '').toUpperCase()
  if (t === 'ДЕНЬ') return <span className="text-yellow-500">☀</span>
  if (t === 'НОЧЬ') return <span className="text-blue-400">🌙</span>
  if (t === 'УТРО') return <span className="text-orange-400">🌅</span>
  if (t === 'ВЕЧЕР') return <span className="text-purple-400">🌆</span>
  if (t === 'РАССВЕТ') return <span className="text-orange-400">🌅</span>
  if (t === 'ЗАКАТ') return <span className="text-purple-400">🌆</span>
  return <Clock size={12} />
}

function getTypeBadge(type: string) {
  if (type.includes('ИНТ-ЭКСТ')) return { bg: 'rgba(251,146,60,0.2)', color: '#fb923c', label: 'ИНТ-ЭКСТ' }
  if (type.includes('ЭКСТ')) return { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', label: 'ЭКСТ' }
  return { bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6', label: 'ИНТ' }
}

function getColorTagColor(colorTag: string | undefined, isDark: boolean): string {
  const colors: Record<string, string> = {
    white: isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db',
    blue: '#60a5fa',
    pink: '#f472b6',
    yellow: '#facc15',
    green: '#4ade80',
    orange: '#fb923c',
  }
  return colors[colorTag || 'white'] || (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb')
}

interface SceneNavigatorProps {
  scenes: Scene[]
  isDark: boolean
  onSceneClick?: (sceneId: string) => void
  activeSceneId?: string
  onSceneReorder?: (fromIndex: number, toIndex: number) => void
  timingSystem?: TimingSystem
  genreCoefficient?: number
  currentSeries?: number
  episodeDuration?: number
  isSerial?: boolean
  episodesCount?: number
  onSeriesChange?: (series: number) => void
  onSeriesDurationChange?: (durationSeconds: number) => void
  onSeriesPagesChange?: (pages: number) => void
  /** Общее кол-во страниц из PageCounter — единый источник правды */
  totalPages?: number
  /** редакционные статусы проекта (свои поверх встроенных) */
  draftStatuses?: DraftStatus[]
  /** обновление сцены — выбор редакционного статуса */
  onUpdateScene?: (sceneId: string, patch: Partial<Scene>) => void
  /** Блок B: правый клик по карточке сцены — операции со сценой */
  onSceneContextMenu?: (sceneId: string, x: number, y: number) => void
}

function SceneNavigator({
  scenes,
  isDark,
  onSceneClick,
  activeSceneId,
  onSceneReorder,
  timingSystem = 'page',
  genreCoefficient = 1.0,
  currentSeries = 1,
  episodeDuration,
  isSerial,
  episodesCount = 8,
  onSeriesChange,
  onSeriesDurationChange,
  onSeriesPagesChange,
  totalPages,
  draftStatuses,
  onUpdateScene,
  onSceneContextMenu,
}: SceneNavigatorProps) {
  const [filter, setFilter] = useState<'all' | 'ИНТ' | 'ЭКСТ' | 'ПАВ'>('all')
  const [search, setSearch] = useState('')
  const [locFilter, setLocFilter] = useState<string[]>([])
  const [charFilter, setCharFilter] = useState<string[]>([])
  const [colorFilter, setColorFilter] = useState<string[]>([])
  const [filtersPos, setFiltersPos] = useState<{ left: number; top: number } | null>(null)
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())
  const [seriesDropdownOpen, setSeriesDropdownOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Расчёт текущего хронометража серии (только сцены текущей серии)
  const currentSeriesDuration = useMemo(() => {
    const seriesScenes = isSerial && currentSeries > 0 ? scenesOfSeries(scenes, currentSeries) : scenes
    return seriesScenes.reduce((total, scene) => {
      if (scene.pages !== undefined) {
        return total + calculateSceneTiming({ pages: scene.pages, charCount: scene.charCount }, timingSystem, genreCoefficient).duration
      }
      return total
    }, 0)
  }, [scenes, timingSystem, genreCoefficient, isSerial, currentSeries])

  // Расчёт общего кол-ва страниц.
  // Если передан totalPages из PageCounter — используем его как единый источник правды.
  // Иначе fallback на сумму pages сцен текущей серии (для обратной совместимости).
  const currentSeriesPages = useMemo(() => {
    if (totalPages !== undefined) return totalPages
    const seriesScenes = isSerial && currentSeries > 0 ? scenesOfSeries(scenes, currentSeries) : scenes
    return seriesScenes.reduce((total, scene) => total + (scene.pages || 0), 0)
  }, [scenes, totalPages, isSerial, currentSeries])

  // Уведомляем родителя о хронометраже и страницах выбранной серии
  useEffect(() => {
    onSeriesDurationChange?.(currentSeriesDuration)
  }, [currentSeriesDuration, onSeriesDurationChange])

  useEffect(() => {
    onSeriesPagesChange?.(currentSeriesPages)
  }, [currentSeriesPages, onSeriesPagesChange])

  // Расчёт прогресса серии
  const seriesProgress = useMemo(() => {
    if (!episodeDuration) return null
    const targetSeconds = episodeDuration * 60
    const progress = Math.min(100, (currentSeriesDuration / targetSeconds) * 100)
    return {
      current: currentSeriesDuration,
      target: targetSeconds,
      progress: progress,
      isOver: currentSeriesDuration > targetSeconds
    }
  }, [currentSeriesDuration, episodeDuration])

  // Списки для фильтров: уникальные локации/персонажи с кол-вом сцен
  const locationOptions = useMemo(() => countByField(scenes, 'location'), [scenes])
  const characterOptions = useMemo(() => countByField(scenes, 'character'), [scenes])
  const colorOptions = useMemo(() => presentColorTags(scenes), [scenes])

  // Мультивыбор: несколько значений внутри фильтра работают как «ИЛИ»
  const toggleIn = toggleInList

  const extraFiltersCount = (filter !== 'all' ? 1 : 0) + locFilter.length + charFilter.length + colorFilter.length

  const filteredScenes = useMemo(() => applyNavigatorFilters(scenes, {
    type: filter, locations: locFilter, characters: charFilter,
    colors: colorFilter, query: search,
  }), [scenes, filter, locFilter, charFilter, colorFilter, search])

  // Стрелки ↑↓ — листаем отображаемый (отфильтрованный) список
  const goScene = useCallback((dir: 1 | -1) => {
    const next = nextSceneIndex(filteredScenes, activeSceneId, dir)
    if (next !== null) onSceneClick?.(filteredScenes[next].id)
  }, [filteredScenes, activeSceneId, onSceneClick])

  // ↑/↓ на клавиатуре — то же листание, но только когда фокус НЕ в тексте:
  // в редакторе и полях ввода стрелки остаются перемещением курсора
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      goScene(e.key === 'ArrowUp' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goScene])

  // Единый расчёт timing для всех отфильтрованных сцен (без дублирования)
  const filteredScenesWithTiming = useMemo(() => {
    return filteredScenes.map(scene => ({
      scene,
      timing: calculateSceneTiming(
        { pages: scene.pages, charCount: scene.charCount },
        timingSystem,
        genreCoefficient
      ),
    }))
  }, [filteredScenes, timingSystem, genreCoefficient])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const activeScene = useMemo(() => {
    return filteredScenes.find(s => s.id === activeId) || null
  }, [filteredScenes, activeId])

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event

    if (over && active.id !== over.id) {
      const filteredOldIndex = filteredScenes.findIndex((scene) => scene.id === active.id)
      const filteredNewIndex = filteredScenes.findIndex((scene) => scene.id === over.id)

      if (filteredOldIndex !== -1 && filteredNewIndex !== -1) {
        // Конвертируем индексы из filtered в полный массив scenes
        const fullOldIndex = scenes.findIndex((scene) => scene.id === active.id)
        const fullNewIndex = scenes.findIndex((scene) => scene.id === over.id)
        if (fullOldIndex !== -1 && fullNewIndex !== -1) {
          onSceneReorder?.(fullOldIndex, fullNewIndex)
        }
      }
    }
  }

  const toggleExpanded = useCallback((sceneId: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev)
      if (next.has(sceneId)) {
        next.delete(sceneId)
      } else {
        next.add(sceneId)
      }
      return next
    })
  }, [])

// Общий интерфейс для plain и sortable карточки
interface SceneCardProps {
  scene: Scene
  isActive: boolean
  isExpanded: boolean
  stripColor: string
  badge: { bg: string; color: string; label: string }
  isDark: boolean
  textPrimary: string
  textSecondary: string
  onSceneClick?: (id: string) => void
  onToggleExpand?: (id: string) => void
  pages: number
  duration: number
  dragStyle?: React.CSSProperties
  dragRef?: React.Ref<HTMLDivElement>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttrs?: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners?: Record<string, any>
  draftStatuses?: DraftStatus[]
  onUpdateScene?: (sceneId: string, patch: Partial<Scene>) => void
  onSceneContextMenu?: (sceneId: string, x: number, y: number) => void
}

// Plain карточка сцены (без drag-and-drop)
function SceneCard({
  scene,
  isActive,
  isExpanded,
  stripColor,
  badge,
  isDark,
  textPrimary,
  textSecondary,
  onSceneClick,
  onToggleExpand,
  pages,
  duration,
  dragStyle,
  dragRef,
  dragAttrs,
  dragListeners,
  draftStatuses,
  onUpdateScene,
  onSceneContextMenu,
}: SceneCardProps) {
  const [stMenu, setStMenu] = useState<{ x: number; y: number } | null>(null)
  const ds = draftStatusById(scene.draftStatus, draftStatuses)
  return (
    <div
      ref={dragRef}
      {...dragAttrs}
      {...dragListeners}
      className={`group rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer ${isActive ? 'ring-2 ring-indigo-500 ring-offset-1' : ''} ${isDark ? 'hover:bg-white/5' : 'hover:bg-white'}`}
      style={{
        background: isActive
          ? (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)')
          : (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff'),
        borderColor: isActive ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
        boxShadow: isActive
          ? (isDark ? '0 4px 20px rgba(99,102,241,0.25)' : '0 4px 20px rgba(99,102,241,0.2)')
          : (isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)'),
        transform: isActive ? 'translateX(4px)' : undefined,
        ...dragStyle,
      }}
      onClick={() => onSceneClick?.(scene.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        onSceneContextMenu?.(scene.id, e.clientX, e.clientY)
      }}
    >
      {/* Основная строка сцены */}
      <div className="p-3 flex items-start gap-2">
        {/* Цветная метка */}
        <div className="w-1 shrink-0 self-stretch rounded-full" style={{ background: stripColor, minHeight: 40 }} />

        <div className="flex-1 min-w-0">
          {/* Номер и тип */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold" style={{ color: textPrimary }}>
              {scene.number}.
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
            {scene.isOmitted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                ВЫЧ
              </span>
            )}
            {/* Редакционный статус — точка, клик открывает выпадашку */}
            <button
              className="flex items-center gap-1 px-1 py-0.5 rounded ml-auto shrink-0 transition-all hover:bg-white/10"
              style={{ color: ds ? ds.color : textSecondary }}
              title={ds ? `Статус: ${ds.label}` : 'Выбрать редакционный статус'}
              onClick={(e) => { e.stopPropagation(); setStMenu({ x: e.clientX, y: e.clientY }) }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="w-2 h-2 rounded-full shrink-0"
                style={ds
                  ? { background: ds.color }
                  : { border: `1px dashed ${textSecondary}` }} />
              {ds && <span className="text-[9px] font-bold">{ds.label.toUpperCase()}</span>}
            </button>
          </div>

          {/* Локация */}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: textPrimary }}>
            <MapPin size={12} style={{ color: textSecondary }} />
            <span className="truncate">{scene.sublocation ? `${scene.location}.${scene.sublocation}.` : `${scene.location}.`}</span>
          </div>

          {/* Персонажи (cast) */}
          {scene.cast && scene.cast.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {scene.cast.slice(0, 3).map((c, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{ background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                  {c}
                </span>
              ))}
              {scene.cast.length > 3 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: textSecondary }}>
                  +{scene.cast.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Время и страницы */}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px]" style={{ color: textSecondary }}>
              {getTimeIcon(scene.time)}
              {scene.time}
            </span>
            {scene.pages !== undefined && (
              <>
                <span className="text-[10px]" style={{ color: textSecondary }}>
                  {pages.toFixed(1)} стр
                </span>
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: isDark ? '#10b981' : '#059669' }}>
                  <Clock size={11} />
                  {formatDuration(duration)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Кнопка развернуть (если есть синопсис) */}
        {scene.synopsis && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand?.(scene.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
          >
            {isExpanded ? (
              <ChevronDown size={14} style={{ color: textSecondary }} />
            ) : (
              <ChevronRight size={14} style={{ color: textSecondary }} />
            )}
          </button>
        )}
      </div>

      {/* Выпадашка редакционного статуса */}
      {stMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setStMenu(null) }} />
          <div className="fixed rounded-xl p-2 z-50"
            style={{
              left: Math.min(stMenu.x, window.innerWidth - 200),
              top: Math.min(stMenu.y, window.innerHeight - 280),
              background: isDark ? '#1e1e3a' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
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
                  onClick={() => { onUpdateScene?.(scene.id, { draftStatus: s.id }); setStMenu(null) }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                  <span className="ml-auto text-[9px]" style={{ color: textSecondary }}>{s.weight}%</span>
                </button>
              ))}
              <button
                className="w-full text-left px-1.5 py-1 rounded text-[11px]"
                style={{ color: textSecondary }}
                onClick={() => { onUpdateScene?.(scene.id, { draftStatus: undefined }); setStMenu(null) }}>
                ✕ Без статуса
              </button>
            </div>
          </div>
        </>
      )}

      {/* Синопсис (раскрывается) */}
      {isExpanded && scene.synopsis && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-xs leading-relaxed" style={{ color: textSecondary }}>
            {scene.synopsis}
          </p>
        </div>
      )}
    </div>
  )
}

const MemoizedSceneCard = memo(SceneCard)

// Обёртка с drag-and-drop (только когда filter === 'all')
function SortableSceneCard(props: Omit<SceneCardProps, 'dragStyle' | 'dragRef' | 'dragAttrs' | 'dragListeners'>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.scene.id })

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return <SceneCard {...props} dragStyle={dragStyle} dragRef={setNodeRef} dragAttrs={attributes} dragListeners={listeners} />
}

  const cardBg = isDark ? '#0f0f1a' : '#f8fafc'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#64748b'
  const accentColor = isDark ? '#6366f1' : '#4f46e5'

  return (
    <div className="w-72 flex flex-col h-full relative"
      style={{ 
        background: cardBg,
        borderRight: `1px solid ${border}`,
        boxShadow: isDark 
          ? '4px 0 24px rgba(0,0,0,0.4)' 
          : '4px 0 24px rgba(0,0,0,0.08)'
      }}>
      
      {/* Шапка с градиентом */}
      <div className="p-4 border-b relative" 
        style={{ 
          borderColor: border,
          background: isDark 
            ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)' 
            : 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.02) 100%)'
        }}>
        {/* Декоративный элемент */}
        <div className="absolute top-0 left-0 w-1 h-full" style={{ background: accentColor }} />
        
        <div className="flex items-center justify-between mb-3 pl-2 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)' }}>
              <Film size={16} style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: textPrimary }}>Навигатор сцен</h2>
            </div>
          </div>
          
          {/* Выбор серии (только для сериалов) — в одну строку с заголовком */}
          {isSerial && (
            <div className="relative z-50" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSeriesDropdownOpen(false) }}>
              <button
                onClick={() => setSeriesDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 cursor-pointer transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)',
                  color: isDark ? '#e5e7eb' : '#374151',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                <span style={{ color: accentColor }}>●</span>
                {currentSeries === 0 ? 'Все серии' : `Серия ${currentSeries}`}
                <ChevronDown size={11} className={`transition-transform ${seriesDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {seriesDropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-50"
                  style={{
                    background: isDark ? '#1e1e3a' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    minWidth: 130,
                    zIndex: 9999,
                  }}
                >
                  {[0, ...Array.from({ length: episodesCount }, (_, i) => i + 1)].map(n => (
                    <button
                      key={n}
                      onClick={() => { 
                        onSeriesChange?.(n)
                        setSeriesDropdownOpen(false) 
                      }}
                      className="w-full text-left px-3 py-2 text-xs transition-all"
                      style={{
                        background: currentSeries === n
                          ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)')
                          : 'transparent',
                        color: currentSeries === n
                          ? accentColor
                          : (isDark ? '#e5e7eb' : '#374151'),
                        fontWeight: currentSeries === n ? 600 : 400,
                      }}
                      onMouseEnter={e => {
                        if (currentSeries !== n)
                          (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'
                      }}
                      onMouseLeave={e => {
                        if (currentSeries !== n)
                          (e.currentTarget as HTMLElement).style.background = 'transparent'
                      }}
                    >
                      {n === 0 ? 'Все серии' : `Серия ${n}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <span className="text-xs px-2 py-1 rounded-full font-medium shrink-0"
            style={{ background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)', color: accentColor }}>
            {filteredScenes.length}
          </span>
        </div>

        {/* Фильтры — одна кнопка «Фильтры ▾» + стрелки листания */}
        <div className="flex items-center gap-1 pl-2 pr-2">
          {/* Стрелки ↑↓ — предыдущая/следующая сцена по отображаемому списку */}
          <div className="flex items-center">
            <button
              onClick={() => goScene(-1)}
              disabled={!filteredScenes.length}
              title="Предыдущая сцена"
              className="p-1.5 rounded-lg transition-all disabled:opacity-30"
              style={{ color: textSecondary }}
            >
              <ChevronUp size={15} />
            </button>
            <button
              onClick={() => goScene(1)}
              disabled={!filteredScenes.length}
              title="Следующая сцена"
              className="p-1.5 rounded-lg transition-all disabled:opacity-30"
              style={{ color: textSecondary }}
            >
              <ChevronDown size={15} />
            </button>
          </div>

          {/* Расширенные фильтры: тип / локация / персонаж / цвет — fixed, не обрезается шапкой */}
          <div className="ml-auto">
            <button
              onClick={(e) => {
                if (filtersPos) { setFiltersPos(null); return }
                const r = e.currentTarget.getBoundingClientRect()
                setFiltersPos({
                  left: Math.max(8, Math.min(r.right - 160, window.innerWidth - 220)),
                  top: r.bottom + 4,
                })
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: extraFiltersCount > 0 || filtersPos
                  ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)')
                  : 'transparent',
                color: extraFiltersCount > 0 ? accentColor : textSecondary,
                border: `1px solid ${extraFiltersCount > 0 ? (isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)') : 'transparent'}`,
              }}
            >
              <SlidersHorizontal size={13} />
              Фильтры{extraFiltersCount > 0 ? ` ·${extraFiltersCount}` : ''}
            </button>
            {filtersPos && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltersPos(null)} />
                <div
                  className="fixed rounded-xl p-2 z-50 overflow-y-auto"
                  style={{
                    left: filtersPos.left,
                    top: filtersPos.top,
                    background: isDark ? '#1e1e3a' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    minWidth: 210, maxHeight: Math.min(340, window.innerHeight - filtersPos.top - 12),
                  }}
                >
                  {/* Тип сцены */}
                  <div className="text-[10px] mb-1 px-1" style={{ color: textSecondary }}>Тип сцены</div>
                  <div className="flex items-center gap-1 px-1.5 pb-1">
                    {(['Все', 'ИНТ', 'ЭКСТ', 'ПАВ'] as const).map((label) => {
                      const f = label === 'Все' ? 'all' : label as 'ИНТ' | 'ЭКСТ' | 'ПАВ'
                      const isActive = filter === f
                      return (
                        <button key={label}
                          onClick={() => setFilter(f)}
                          className="px-2 py-1 rounded-md text-[11px] font-medium transition-all"
                          style={{
                            background: isActive ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)') : 'transparent',
                            color: isActive ? accentColor : textSecondary,
                            border: `1px solid ${isActive ? (isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)') : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                          }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Локации */}
                  <div className="text-[10px] mb-1 mt-1.5 px-1 border-t pt-1.5" style={{ color: textSecondary, borderColor: border }}>Локация</div>
                  <div className="pb-1 space-y-0.5 max-h-28 overflow-y-auto">
                    {locationOptions.map(([loc, count]) => (
                      <button key={loc}
                        onClick={() => setLocFilter(toggleIn(locFilter, loc))}
                        className="w-full flex items-center gap-2 text-left px-1.5 py-1 rounded text-[11px]"
                        style={{
                          color: locFilter.includes(loc) ? accentColor : textPrimary,
                          background: locFilter.includes(loc) ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)') : 'transparent',
                        }}>
                        <MapPin size={10} style={{ color: textSecondary }} />
                        <span className="truncate">{loc}</span>
                        {locFilter.includes(loc) && <span style={{ color: accentColor }}>✓</span>}
                        <span className="ml-auto text-[9px] shrink-0" style={{ color: textSecondary }}>{count}</span>
                      </button>
                    ))}
                  </div>

                  {/* Персонажи */}
                  <div className="text-[10px] mb-1 mt-1.5 px-1 border-t pt-1.5" style={{ color: textSecondary, borderColor: border }}>Персонаж</div>
                  <div className="pb-1 space-y-0.5 max-h-28 overflow-y-auto">
                    {characterOptions.map(([ch, count]) => (
                      <button key={ch}
                        onClick={() => setCharFilter(toggleIn(charFilter, ch))}
                        className="w-full flex items-center gap-2 text-left px-1.5 py-1 rounded text-[11px]"
                        style={{
                          color: charFilter.includes(ch) ? accentColor : textPrimary,
                          background: charFilter.includes(ch) ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)') : 'transparent',
                        }}>
                        <span className="truncate">{ch}</span>
                        {charFilter.includes(ch) && <span style={{ color: accentColor }}>✓</span>}
                        <span className="ml-auto text-[9px] shrink-0" style={{ color: textSecondary }}>{count}</span>
                      </button>
                    ))}
                  </div>

                  {/* Цветовая метка */}
                  {colorOptions.length > 0 && (
                    <>
                      <div className="text-[10px] mb-1 mt-1.5 px-1 border-t pt-1.5" style={{ color: textSecondary, borderColor: border }}>Цвет метки</div>
                      <div className="flex items-center gap-1.5 px-1.5 pb-1">
                        {colorOptions.map(c => (
                          <button key={c}
                            onClick={() => setColorFilter(toggleIn(colorFilter, c))}
                            title={c}
                            className="w-5 h-5 rounded-full transition-all"
                            style={{
                              background: getColorTagColor(c, isDark),
                              outline: colorFilter.includes(c) ? `2px solid ${accentColor}` : 'none',
                              outlineOffset: 1,
                            }} />
                        ))}
                      </div>
                    </>
                  )}

                  {extraFiltersCount > 0 && (
                    <button
                      onClick={() => { setFilter('all'); setLocFilter([]); setCharFilter([]); setColorFilter([]) }}
                      className="w-full mt-1.5 pt-1.5 border-t text-left px-1.5 py-1 rounded text-[11px]"
                      style={{ color: textSecondary, borderColor: border }}>
                      ✕ Сбросить фильтры
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Поиск по навигатору */}
        <div className="relative pl-2 pr-2 mt-2">
          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск: локация, персонаж, синопсис…"
            className="w-full pl-7 pr-7 py-1.5 rounded-lg text-xs outline-none transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
              color: textPrimary,
              border: `1px solid ${search ? (isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)') : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')}`,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: textSecondary }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Прогресс-бар хронометража серии */}
      {seriesProgress && (
        <div className="px-3 py-2 border-b" style={{ borderColor: border }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: textSecondary }}>
              {currentSeries === 0 ? 'Все серии' : `Серия ${currentSeries}`}
            </span>
            <span className="text-[10px]" style={{ color: seriesProgress.isOver ? '#ef4444' : textPrimary }}>
              {formatDuration(seriesProgress.current)} / {episodeDuration} мин
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${seriesProgress.progress}%`,
                background: seriesProgress.isOver ? '#ef4444' : '#10b981'
              }}
            />
          </div>
        </div>
      )}

      {/* Список сцен с улучшенным стилем */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" 
        style={{ background: isDark ? 'transparent' : 'rgba(255,255,255,0.5)' }}>
        {filteredScenes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: textSecondary }}>
              {search || extraFiltersCount > 0 || filter !== 'all' ? 'Ничего не найдено по фильтрам' : 'Нет сцен'}
            </p>
          </div>
        ) : filter !== 'all' || extraFiltersCount > 0 || search.trim() !== '' ? (
          // При активном фильтре — plain список без drag-and-drop
          filteredScenesWithTiming.map(({ scene, timing }) => {
            const isActive = activeSceneId === scene.id
            const isExpanded = expandedScenes.has(scene.id)
            const stripColor = getColorTagColor(scene.colorTag, isDark)
            const badge = getTypeBadge(scene.type || '')

            return (
              <MemoizedSceneCard
                key={scene.id}
                scene={scene}
                isActive={isActive}
                isExpanded={isExpanded}
                stripColor={stripColor}
                badge={badge}
                isDark={isDark}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                onSceneClick={onSceneClick}
                onToggleExpand={toggleExpanded}
                pages={timing.pages}
                duration={timing.duration}
                draftStatuses={draftStatuses}
                onUpdateScene={onUpdateScene}
                onSceneContextMenu={onSceneContextMenu}
              />
            )
          })
        ) : (
          // Без фильтра — drag-and-drop reorder
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={({ active }) => setActiveId(active.id as string)}
            onDragEnd={handleDragEnd}
            autoScroll={{ threshold: { x: 0.2, y: 0.2 }, acceleration: 10 }}
          >
            <SortableContext
              items={filteredScenes.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredScenesWithTiming.map(({ scene, timing }) => {
                const isActive = activeSceneId === scene.id
                const isExpanded = expandedScenes.has(scene.id)
                const stripColor = getColorTagColor(scene.colorTag, isDark)
                const badge = getTypeBadge(scene.type || '')

                return (
                  <SortableSceneCard
                    key={scene.id}
                    scene={scene}
                    isActive={isActive}
                    isExpanded={isExpanded}
                    stripColor={stripColor}
                    badge={badge}
                    isDark={isDark}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    onSceneClick={onSceneClick}
                    onToggleExpand={toggleExpanded}
                    pages={timing.pages}
                    duration={timing.duration}
                    draftStatuses={draftStatuses}
                    onUpdateScene={onUpdateScene}
                onSceneContextMenu={onSceneContextMenu}
                  />
                )
              })}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId && activeScene ? (
                <MemoizedSceneCard
                  scene={activeScene}
                  isActive={activeSceneId === activeScene.id}
                  isExpanded={expandedScenes.has(activeScene.id)}
                  stripColor={getColorTagColor(activeScene.colorTag, isDark)}
                  badge={getTypeBadge(activeScene.type || '')}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  onSceneClick={onSceneClick}
                  onToggleExpand={toggleExpanded}
                  pages={filteredScenesWithTiming.find(t => t.scene.id === activeScene.id)?.timing.pages || 0}
                  duration={filteredScenesWithTiming.find(t => t.scene.id === activeScene.id)?.timing.duration || 0}
                  draftStatuses={draftStatuses}
                  onUpdateScene={onUpdateScene}
                onSceneContextMenu={onSceneContextMenu}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Нижняя панель */}
      <div className="p-3 border-t" 
        style={{ 
          borderColor: border,
          background: isDark 
            ? 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%)' 
            : 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.8) 100%)'
        }}>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
          <p className="text-[10px] font-medium" style={{ color: textSecondary }}>
            Кликните на сцену для перехода
          </p>
        </div>
      </div>
    </div>
  )
}

export default memo(SceneNavigator)
