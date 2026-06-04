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
}

export default function SceneNavigator({
  scenes,
  isDark,
  onSceneClick,
  activeSceneId,
  onSceneReorder,
  timingSystem = 'page',
  genreCoefficient = 1.0,
}: SceneNavigatorProps) {
  const [filter, setFilter] = useState<'all' | 'ИНТ' | 'ЭКСТ'>('all')
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())

  // Функция расчёта хронометража сцены в зависимости от системы
  const calculateSceneDuration = (pages: number): number => {
    const coeff = genreCoefficient || 1.0
    
    switch (timingSystem) {
      case 'page':
        // Постраничный: 1 страница = 55 секунд
        return Math.round(pages * 55 * coeff)
      
      case 'character':
        // Посимвольный: 1 страница ≈ 1800 символов, 1 символ = 0.05 секунды
        const charCount = pages * 1800
        return Math.round(charCount * 0.05 * coeff)
      
      case 'flexible':
        // Гибкий: базовый расчёт по страницам
        return Math.round(pages * 55 * coeff)
      
      case 'manual':
        // Ручной: пока fallback на постраничный
        return Math.round(pages * 55 * coeff)
      
      default:
        return Math.round(pages * 55 * coeff)
    }
  }

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
        className={`rounded-lg border overflow-hidden transition-all cursor-pointer hover:scale-[1.02] hover:shadow-md ${isActive ? 'ring-1 ring-indigo-500' : ''} ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50'}`}
        style={{
          background: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa',
          borderColor: isActive ? '#6366f1' : border,
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
                    {scene.pages} стр
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: isDark ? '#10b981' : '#059669' }}>
                    <Clock size={11} />
                    {Math.floor(calculateSceneDuration(scene.pages) / 60)}:{(calculateSceneDuration(scene.pages) % 60).toFixed(0).padStart(2, '0')}
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

  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  return (
    <div className="w-72 flex flex-col border-r h-full"
      style={{ background: cardBg, borderColor: border }}>
      
      {/* Шапка */}
      <div className="p-4 border-b" style={{ borderColor: border }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: textPrimary }}>
            <Film size={16} />
            Сцены
          </h2>
          <span className="text-xs px-2 py-1 rounded-full"
            style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0', color: textSecondary }}>
            {filteredScenes.length}
          </span>
        </div>

        {/* Фильтры */}
        <div className="flex items-center gap-1">
          {(['Все', 'ИНТ', 'ЭКСТ'] as const).map((label) => {
            const f = label === 'Все' ? 'all' : label as 'ИНТ' | 'ЭКСТ'
            return (
              <button
                key={label}
                onClick={() => setFilter(f)}
                className="px-2 py-1 rounded text-xs font-medium transition-all"
                style={{
                  background: filter === f ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: filter === f ? '#818cf8' : textSecondary,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Список сцен */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
      <div className="p-3 border-t text-center" style={{ borderColor: border }}>
        <p className="text-[10px]" style={{ color: textSecondary }}>
          Кликните на сцену для перехода
        </p>
      </div>
    </div>
  )
}
