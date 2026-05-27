import { useState, useMemo } from 'react'
import { Film, MapPin, Clock, ChevronDown, ChevronRight } from 'lucide-react'

export interface Scene {
  id: string
  number: string
  type: 'INT' | 'EXT' | 'INT/EXT'
  location: string
  timeOfDay: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS'
  synopsis: string
  pageCount: number
  colorTag?: string
  isOmitted?: boolean
}

interface SceneNavigatorProps {
  scenes: Scene[]
  isDark: boolean
  onSceneClick?: (sceneId: string) => void
  activeSceneId?: string
}

export default function SceneNavigator({
  scenes,
  isDark,
  onSceneClick,
  activeSceneId,
}: SceneNavigatorProps) {
  const [filter, setFilter] = useState<'all' | 'INT' | 'EXT'>('all')
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())

  const filteredScenes = useMemo(() => {
    if (filter === 'all') return scenes
    return scenes.filter(s => s.type.includes(filter))
  }, [scenes, filter])

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

  const getColorTagStyle = (colorTag?: string) => {
    const colors: Record<string, { bg: string; border: string }> = {
      white: { bg: 'bg-white', border: 'border-gray-300' },
      blue: { bg: 'bg-blue-100', border: 'border-blue-400' },
      pink: { bg: 'bg-pink-100', border: 'border-pink-400' },
      yellow: { bg: 'bg-yellow-100', border: 'border-yellow-400' },
      green: { bg: 'bg-green-100', border: 'border-green-400' },
      orange: { bg: 'bg-orange-100', border: 'border-orange-400' },
    }
    return colors[colorTag || 'white']
  }

  const getTimeIcon = (timeOfDay: string) => {
    switch (timeOfDay) {
      case 'DAY': return <span className="text-yellow-500">☀</span>
      case 'NIGHT': return <span className="text-blue-400">☾</span>
      case 'DAWN': return <span className="text-orange-400">🌅</span>
      case 'DUSK': return <span className="text-purple-400">🌆</span>
      default: return <Clock size={12} />
    }
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
          {(['all', 'INT', 'EXT'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2 py-1 rounded text-xs font-medium transition-all"
              style={{
                background: filter === f ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: filter === f ? '#818cf8' : textSecondary,
              }}
            >
              {f === 'all' ? 'Все' : f}
            </button>
          ))}
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
          filteredScenes.map((scene) => {
            const isActive = activeSceneId === scene.id
            const isExpanded = expandedScenes.has(scene.id)
            const colorStyle = getColorTagStyle(scene.colorTag)

            return (
              <div
                key={scene.id}
                className={`rounded-lg border overflow-hidden transition-all cursor-pointer hover:scale-[1.02] hover:shadow-md ${isActive ? 'ring-1 ring-indigo-500' : ''} ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50'}`}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa',
                  borderColor: isActive ? '#6366f1' : border,
                }}
                onClick={() => onSceneClick?.(scene.id)}
              >
                {/* Основная строка сцены */}
                <div className="p-3 flex items-start gap-2">
                  {/* Цветная метка */}
                  <div className={`w-1 h-full min-h-[40px] rounded-full ${colorStyle.bg} ${colorStyle.border}`} />
                  
                  <div className="flex-1 min-w-0">
                    {/* Номер и тип */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: textPrimary }}>
                        {scene.number}.
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          background: scene.type === 'INT' ? 'rgba(139,92,246,0.2)' : 'rgba(34,197,94,0.2)',
                          color: scene.type === 'INT' ? '#8b5cf6' : '#22c55e',
                        }}>
                        {scene.type}
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

                    {/* Время и страницы */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: textSecondary }}>
                        {getTimeIcon(scene.timeOfDay)}
                        {scene.timeOfDay}
                      </span>
                      <span className="text-[10px]" style={{ color: textSecondary }}>
                        {scene.pageCount} стр
                      </span>
                    </div>
                  </div>

                  {/* Кнопка развернуть */}
                  {scene.synopsis && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpanded(scene.id)
                      }}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
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
          })
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
