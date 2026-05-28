import { useState, useMemo } from 'react'
import { 
  Users, Box, MapPin, Shirt, Car, Sparkles, Flame, 
  Monitor, StickyNote, Plus, X,
  Search, Filter, Download, BarChart3
} from 'lucide-react'
import { parseScript, getUniqueElements, type ParsedElement, type ParsedScene } from '../utils/scriptParser'
import CharacterStats, { type CharacterData } from './CharacterStats'

export type BreakdownCategory = 
  | 'cast'        // Актёры / роли
  | 'extras'      // Массовка
  | 'props'       // Реквизит
  | 'costumes'    // Костюмы
  | 'locations'   // Локации
  | 'vehicles'    // Транспорт
  | 'sfx'         // Спецэффекты
  | 'stunts'      // Трюки
  | 'vfx'         // VFX
  | 'notes'       // Прочие заметки

export interface BreakdownElement {
  id: string
  category: BreakdownCategory
  name: string
  notes?: string
  sceneIds: string[]  // в каких сценах используется
}

export interface SceneBreakdown {
  sceneId: string
  sceneNumber: string
  elements: BreakdownElement[]
}

interface ScriptBreakdownProps {
  scenes: Array<{ id: string; number: string; location: string; type: string }>
  isDark: boolean
  blocks?: Array<{ id: string; type: string; content: string }>
}

const CATEGORIES: { id: BreakdownCategory; label: string; icon: typeof Users; color: string }[] = [
  { id: 'cast', label: 'Актёры', icon: Users, color: '#818cf8' },
  { id: 'extras', label: 'Массовка', icon: Users, color: '#a78bfa' },
  { id: 'props', label: 'Реквизит', icon: Box, color: '#f59e0b' },
  { id: 'costumes', label: 'Костюмы', icon: Shirt, color: '#ec4899' },
  { id: 'locations', label: 'Локации', icon: MapPin, color: '#22c55e' },
  { id: 'vehicles', label: 'Транспорт', icon: Car, color: '#3b82f6' },
  { id: 'sfx', label: 'Спецэффекты', icon: Sparkles, color: '#f97316' },
  { id: 'stunts', label: 'Трюки', icon: Flame, color: '#ef4444' },
  { id: 'vfx', label: 'VFX/CG', icon: Monitor, color: '#8b5cf6' },
  { id: 'notes', label: 'Заметки', icon: StickyNote, color: '#6b7280' },
]

export default function ScriptBreakdown({ scenes, isDark, blocks }: ScriptBreakdownProps) {
  const [selectedCategory, setSelectedCategory] = useState<BreakdownCategory | 'all'>('all')
  const [selectedScene, setSelectedScene] = useState<string | 'all'>('all')
  const [manualElements, setManualElements] = useState<BreakdownElement[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newElementName, setNewElementName] = useState('')
  const [newElementCategory, setNewElementCategory] = useState<BreakdownCategory>('cast')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState<'elements' | 'stats'>('elements')

  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  // Парсинг блоков из редактора
  const parsedElements = useMemo(() => {
    if (!blocks || blocks.length === 0) return []
    
    const parsedScenes = parseScript(blocks as any)
    const uniqueElements = getUniqueElements(parsedScenes)
    
    // Конвертируем ParsedElement в BreakdownElement
    return uniqueElements.map(el => ({
      id: el.id,
      category: el.category,
      name: el.name,
      notes: el.notes,
      sceneIds: el.sceneIds,
    }))
  }, [blocks])

  // Объединяем распарсенные и ручные элементы
  const allElements = [...parsedElements, ...manualElements]

  // Подготовка данных для CharacterStats
  const characterData = useMemo(() => {
    const characterElements = allElements.filter(e => e.category === 'cast')
    return characterElements.map(char => ({
      id: char.id,
      name: char.name,
      sceneIds: char.sceneIds,
      dialogPages: char.sceneIds.length * 0.5, // Примерная оценка
      firstAppearance: char.sceneIds[0] || '1',
      lastAppearance: char.sceneIds[char.sceneIds.length - 1] || '1',
      appearanceGaps: [], // Упрощенно для демо
    }))
  }, [allElements])

  const filteredElements = useMemo(() => {
    let result = allElements
    
    if (selectedCategory !== 'all') {
      result = result.filter(e => e.category === selectedCategory)
    }
    
    if (selectedScene !== 'all') {
      result = result.filter(e => e.sceneIds.includes(selectedScene))
    }
    
    if (searchQuery) {
      result = result.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    
    return result
  }, [allElements, selectedCategory, selectedScene, searchQuery])

  const handleAddElement = () => {
    if (!newElementName.trim()) return
    
    const newElement: BreakdownElement = {
      id: crypto.randomUUID(),
      category: newElementCategory,
      name: newElementName.toUpperCase(),
      sceneIds: selectedScene !== 'all' ? [selectedScene] : [],
    }
    
    setManualElements(prev => [...prev, newElement])
    setNewElementName('')
    setShowAddModal(false)
  }

  const removeElement = (elementId: string) => {
    setManualElements(prev => prev.filter(e => e.id !== elementId))
  }

  const getCategoryIcon = (category: BreakdownCategory) => {
    const cat = CATEGORIES.find(c => c.id === category)
    if (!cat) return Users
    return cat.icon
  }

  const getCategoryColor = (category: BreakdownCategory) => {
    const cat = CATEGORIES.find(c => c.id === category)
    return cat?.color || '#6b7280'
  }

  // Если выбран режим статистики — показываем CharacterStats
  if (activeView === 'stats') {
    return (
      <CharacterStats
        characters={characterData}
        totalScenes={scenes.length}
        isDark={isDark}
      />
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      
      {/* Левая панель — фильтры и категории */}
      <div className="w-72 flex flex-col border-r overflow-hidden"
        style={{ background: cardBg, borderColor: border }}>
        
        {/* Шапка */}
        <div className="p-4 border-b" style={{ borderColor: border }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: textPrimary }}>
              {activeView === 'elements' ? 'Разбивка сцен' : 'Статистика'}
            </h2>
            <span className="text-xs px-2 py-1 rounded-full"
              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0', color: textSecondary }}>
              {activeView === 'elements' ? `${filteredElements.length} элементов` : `${characterData.length} персонажей`}
            </span>
          </div>
          
          {/* Переключатель режимов */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveView('elements')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === 'elements' ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-white/5 text-gray-500'}`}
            >
              Элементы
            </button>
            <button
              onClick={() => setActiveView('stats')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === 'stats' ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-white/5 text-gray-500'}`}
            >
              <BarChart3 size={12} className="inline mr-1" />
              Статистика
            </button>
          </div>

          {/* Поиск */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: textSecondary }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск элементов..."
              className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none border transition-all ${isDark ? 'bg-white/5 border-white/10 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 focus:border-indigo-400'}`}
              style={{ color: textPrimary }}
            />
          </div>

          {/* Фильтр по сцене */}
          <select
            value={selectedScene}
            onChange={(e) => setSelectedScene(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg text-xs outline-none border mb-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-300'}`}
            style={{ color: textPrimary }}
          >
            <option value="all">Все сцены</option>
            {scenes.map(scene => (
              <option key={scene.id} value={scene.id}>
                {scene.number}. {scene.location}
              </option>
            ))}
          </select>

          {/* Кнопка добавить */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
          >
            <Plus size={16} />
            Добавить элемент
          </button>
        </div>

        {/* Категории */}
        <div className="flex-1 overflow-y-auto p-2">
          <div
            onClick={() => setSelectedCategory('all')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all mb-1 ${selectedCategory === 'all' ? 'bg-indigo-500/20' : 'hover:bg-white/5'}`}
          >
            <Filter size={14} style={{ color: selectedCategory === 'all' ? '#818cf8' : textSecondary }} />
            <span className="text-sm" style={{ color: selectedCategory === 'all' ? '#818cf8' : textPrimary }}>
              Все категории
            </span>
          </div>

          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const count = allElements.filter(e => e.category === cat.id).length
            const isSelected = selectedCategory === cat.id
            
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all mb-1 ${isSelected ? 'bg-indigo-500/20' : 'hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} style={{ color: isSelected ? cat.color : textSecondary }} />
                  <span className="text-sm" style={{ color: isSelected ? cat.color : textPrimary }}>
                    {cat.label}
                  </span>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0', color: textSecondary }}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>

        {/* Кнопка экспорт */}
        <div className="p-3 border-t" style={{ borderColor: border }}>
          <button
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all border hover:border-indigo-400"
            style={{ borderColor: border, color: textSecondary }}
          >
            <Download size={14} />
            Экспорт в PDF
          </button>
        </div>
      </div>

      {/* Центральная область — список элементов */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Шапка центральной панели */}
        <div className="shrink-0 px-6 py-3 border-b flex items-center justify-between"
          style={{ background: cardBg, borderColor: border }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: textPrimary }}>
              {selectedCategory === 'all' ? 'Все элементы' : CATEGORIES.find(c => c.id === selectedCategory)?.label}
            </h3>
            <p className="text-xs" style={{ color: textSecondary }}>
              {selectedScene === 'all' ? 'Все сцены' : `Сцена ${scenes.find(s => s.id === selectedScene)?.number}`}
            </p>
          </div>
        </div>

        {/* Список элементов */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredElements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: textSecondary }}>
                Нет элементов в выбранной категории
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredElements.map(element => {
                const Icon = getCategoryIcon(element.category)
                const color = getCategoryColor(element.category)
                const sceneCount = element.sceneIds.length
                
                return (
                  <div
                    key={element.id}
                    className={`rounded-lg border p-3 transition-all hover:scale-[1.02] hover:shadow-md ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    style={{
                      background: cardBg,
                      borderColor: border,
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg" style={{ background: `${color}20` }}>
                          <Icon size={14} style={{ color }} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold" style={{ color: textPrimary }}>
                            {element.name}
                          </h4>
                          {element.notes && (
                            <p className="text-xs" style={{ color: textSecondary }}>
                              {element.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeElement(element.id)}
                        className="p-1 rounded hover:bg-red-500/20 transition-colors"
                        style={{ color: textSecondary }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: `${color}20`, color }}>
                        {sceneCount} сцен
                      </span>
                      <div className="flex gap-1">
                        {element.sceneIds.slice(0, 3).map(sceneId => {
                          const scene = scenes.find(s => s.id === sceneId)
                          return scene ? (
                            <span key={sceneId} className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0', color: textSecondary }}>
                              {scene.number}
                            </span>
                          ) : null
                        })}
                        {element.sceneIds.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0', color: textSecondary }}>
                            +{element.sceneIds.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Модалка добавления элемента */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md p-6 rounded-2xl"
            style={{ background: cardBg, border: `1px solid ${border}` }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: textPrimary }}>
              Добавить элемент разбивки
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>
                  Название
                </label>
                <input
                  type="text"
                  value={newElementName}
                  onChange={(e) => setNewElementName(e.target.value)}
                  placeholder="Например: ИВАН или ПИСТОЛЕТ"
                  className={`w-full px-3 py-2 rounded-lg text-sm outline-none border ${isDark ? 'bg-white/5 border-white/10 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 focus:border-indigo-400'}`}
                  style={{ color: textPrimary }}
                />
              </div>
              
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>
                  Категория
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.slice(0, 6).map(cat => {
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setNewElementCategory(cat.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all border ${newElementCategory === cat.id ? 'border-indigo-400 bg-indigo-500/20' : 'border-transparent hover:bg-white/5'}`}
                        style={{ color: newElementCategory === cat.id ? cat.color : textPrimary }}
                      >
                        <Icon size={12} style={{ color: cat.color }} />
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all border"
                style={{ borderColor: border, color: textSecondary }}
              >
                Отмена
              </button>
              <button
                onClick={handleAddElement}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
