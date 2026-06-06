import { useState, useMemo } from 'react'
import { Film, MapPin, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import {
  DndContext,
  closestCenter,
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
import type { TimingSystem } from '../store/scriptStore'

// Упрощенный тип для сцен из редактора
interface SimpleScene {
  id: string
  number: string
  type: string
  location: string
  time: string
  synopsis?: string
  colorTag?: string
  isOmitted?: boolean
  pages?: number
  charCount?: number
  cast?: string[]
}

interface SceneNavigatorProps {
  scenes: SimpleScene[]
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
}

export default function SceneNavigator({
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
}: SceneNavigatorProps) {
  const [filter, setFilter] = useState<'all' | 'ИНТ' | 'ЭКСТ'>('all')
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())
  const [seriesDropdownOpen, setSeriesDropdownOpen] = useState(false)

  // Функция расчёта хронометража сцены в зависимости от системы
  const calculateSceneTiming = (scene: SimpleScene): { pages: number; duration: number } => {
    const coeff = genreCoefficient || 1.0
    const charCount = scene.charCount || (scene.pages ? scene.pages * 1800 : 0)
    
    // Страницы всегда считаются одинаково - это физический размер текста
    const pages = Math.max(0.1, parseFloat((charCount / 1800).toFixed(1)))

    switch (timingSystem) {
      case 'page':
        // Постраничный: 1 страница = 55 секунд
        const duration = Math.round(pages * 55 * coeff)
        return { pages, duration }
      
      case 'character':
        // Посимвольный: 1 символ = 0.05 секунды (20 символов = 1 секунда)
        const charDuration = Math.round(charCount * 0.05 * coeff)
        return { pages, duration: charDuration }
      
      case 'flexible':
        // Гибкий: базовый расчёт по страницам
        const flexibleDuration = Math.round(pages * 55 * coeff)
        return { pages, duration: flexibleDuration }
      
      case 'manual':
        // Ручной: пока fallback на постраничный
        const manualDuration = Math.round(pages * 55 * coeff)
        return { pages, duration: manualDuration }
      
      default:
        const defaultDuration = Math.round(pages * 55 * coeff)
        return { pages, duration: defaultDuration }
    }
  }

  // Вспомогательная функция для расчёта только страниц (для отображения)
  const calculateScenePages = (scene: SimpleScene): number => {
    const charCount = scene.charCount || (scene.pages ? scene.pages * 1800 : 0)
    return Math.max(0.1, parseFloat((charCount / 1800).toFixed(1)))
  }

  // Расчёт текущего хронометража серии
  const currentSeriesDuration = useMemo(() => {
    return scenes.reduce((total, scene) => {
      if (scene.pages !== undefined) {
        return total + calculateSceneTiming(scene).duration
      }
      return total
    }, 0)
  }, [scenes, timingSystem, genreCoefficient])

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

  const filteredScenes = useMemo(() => {
    if (filter === 'all') return scenes
    if (filter === 'ИНТ') return scenes.filter(s => s.type.includes('ИНТ'))
    if (filter === 'ЭКСТ') return scenes.filter(s => s.type.includes('ЭКСТ'))
    return scenes
  }, [scenes, filter])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Начинать drag после перемещения на 8px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = filteredScenes.findIndex((scene) => scene.id === active.id)
      const newIndex = filteredScenes.findIndex((scene) => scene.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        onSceneReorder?.(oldIndex, newIndex)
      }
    }
  }

  const toggleExpanded = (sceneId: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev)
      if (next.has(sceneId)) {
        next.delete(sceneId)
      } else {
        next.add(sceneId)
      }
      return next
    })
  }

  const getColorTagColor = (colorTag?: string): string => {
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

  const getTimeIcon = (time: string) => {
    const t = (time || '').toUpperCase()
    if (t === 'ДЕНЬ') return <span className="text-yellow-500">☀</span>
    if (t === 'НОЧЬ') return <span className="text-blue-400">🌙</span>
    if (t === 'УТРО') return <span className="text-orange-400">🌅</span>
    if (t === 'ВЕЧЕР') return <span className="text-purple-400">🌆</span>
    if (t === 'РАССВЕТ') return <span className="text-orange-400">🌅</span>
    if (t === 'ЗАКАТ') return <span className="text-purple-400">🌆</span>
    return <Clock size={12} />
  }

  const getTypeBadge = (type: string) => {
    if (type.includes('ИНТ-ЭКСТ')) return { bg: 'rgba(251,146,60,0.2)', color: '#fb923c', label: 'ИНТ-ЭКСТ' }
    if (type.includes('ЭКСТ')) return { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', label: 'ЭКСТ' }
    return { bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6', label: 'ИНТ' }
  }

  // Компонент для сортируемой карточки сцены
  function SortableSceneCard({ scene, isActive, isExpanded, stripColor, badge }: {
    scene: SimpleScene
    isActive: boolean
    isExpanded: boolean
    stripColor: string
    badge: { bg: string; color: string; label: string }
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: scene.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
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
          ...style,
        }}
        onClick={() => onSceneClick?.(scene.id)}
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
            </div>

            {/* Локация */}
            <div className="flex items-center gap-1.5 text-xs" style={{ color: textPrimary }}>
              <MapPin size={12} style={{ color: textSecondary }} />
              <span className="truncate">{scene.location}</span>
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
                    {calculateScenePages(scene)} стр
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: isDark ? '#10b981' : '#059669' }}>
                    <Clock size={11} />
                    {Math.floor(calculateSceneTiming(scene).duration / 60)}:{(calculateSceneTiming(scene).duration % 60).toFixed(0).padStart(2, '0')}
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
                toggleExpanded(scene.id)
              }}
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
      <div className="p-4 border-b relative overflow-hidden" 
        style={{ 
          borderColor: border,
          background: isDark 
            ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)' 
            : 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.02) 100%)'
        }}>
        {/* Декоративный элемент */}
        <div className="absolute top-0 left-0 w-1 h-full" style={{ background: accentColor }} />
        
        <div className="flex items-center justify-between mb-3 pl-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)' }}>
              <Film size={16} style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: textPrimary }}>Навигатор сцен</h2>
              <p className="text-[10px]" style={{ color: textSecondary }}>Drag & drop для reorder</p>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded-full font-medium"
            style={{ background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)', color: accentColor }}>
            {filteredScenes.length}
          </span>
        </div>

        {/* Выбор серии (только для сериалов) */}
        {isSerial && (
          <div className="flex items-center gap-1 pl-2 mb-2">
            <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSeriesDropdownOpen(false) }}>
              <button
                onClick={() => setSeriesDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 cursor-pointer transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
                  color: isDark ? '#e5e7eb' : '#374151',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
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
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    minWidth: 110,
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
          </div>
        )}

        {/* Фильтры - стильные кнопки */}
        <div className="flex items-center gap-1 pl-2">
          {(['Все', 'ИНТ', 'ЭКСТ'] as const).map((label) => {
            const f = label === 'Все' ? 'all' : label as 'ИНТ' | 'ЭКСТ'
            const isActive = filter === f
            return (
              <button
                key={label}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                style={{
                  background: isActive 
                    ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)') 
                    : 'transparent',
                  color: isActive ? accentColor : textSecondary,
                  boxShadow: isActive 
                    ? (isDark ? '0 2px 8px rgba(99,102,241,0.3)' : '0 2px 8px rgba(99,102,241,0.2)') 
                    : 'none',
                  border: isActive 
                    ? `1px solid ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}` 
                    : `1px solid transparent`
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Прогресс-бар хронометража серии */}
      {seriesProgress && (
        <div className="px-3 py-2 border-b" style={{ borderColor: border }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: textSecondary }}>
              Серия {currentSeries}
            </span>
            <span className="text-[10px]" style={{ color: seriesProgress.isOver ? '#ef4444' : textPrimary }}>
              {Math.floor(seriesProgress.current / 60)}:{(seriesProgress.current % 60).toFixed(0).padStart(2, '0')} / {episodeDuration} мин
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
              Нет сцен
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredScenes.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredScenes.map((scene, index) => {
                const isActive = activeSceneId === scene.id
                const isExpanded = expandedScenes.has(scene.id)
                const stripColor = getColorTagColor(scene.colorTag)
                const badge = getTypeBadge(scene.type || '')

                return (
                  <SortableSceneCard
                    key={`${scene.id}-${index}`}
                    scene={scene}
                    isActive={isActive}
                    isExpanded={isExpanded}
                    stripColor={stripColor}
                    badge={badge}
                  />
                )
              })}
            </SortableContext>
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
