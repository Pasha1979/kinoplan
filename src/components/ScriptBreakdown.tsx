import { useState, useMemo } from 'react'
import {
  Users, Box, MapPin, Shirt, Car, Sparkles, Flame,
  Monitor, StickyNote, Plus, X,
  Search, Filter, Download, BarChart3, Table, ArrowRight
} from 'lucide-react'
import { useToastStore } from '../store/toastStore'
import { parseScript, getUniqueElements, flattenSceneTags, mergeBreakdownElements } from '../utils/scriptParser'
import type { Block, SceneTag } from '../utils/scriptParser'
import type { BreakdownElement as SceneBreakdownElement } from '../types/scene'
import CharacterStats from './CharacterStats'

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

function useDeepCompareMemoize(value: Block[] | undefined): Block[] | undefined {
  const [prevValue, setPrevValue] = useState<Block[] | undefined>(value)
  const [memoizedValue, setMemoizedValue] = useState<Block[] | undefined>(value)

  const isDifferent = prevValue !== value && (
    !prevValue || !value || prevValue.length !== value.length ||
    prevValue.some((val, i) => {
      const other = value[i]
      return val.id !== other?.id || val.type !== other?.type || val.content !== other?.content
    })
  )

  if (isDifferent) {
    setPrevValue(value)
    setMemoizedValue(value)
  }

  return memoizedValue
}

export interface SceneBreakdown {
  sceneId: string
  sceneNumber: string
  elements: BreakdownElement[]
}

interface ScriptBreakdownProps {
  scenes: Array<{ id: string; number: string; location: string; type: string; breakdownElements?: SceneTag[] }>
  isDark: boolean
  blocks?: Block[]
  /** T-108: персист ручных тегов — пишет breakdownElements в сцену-владельца */
  onUpdateScene?: (sceneId: string, patch: { breakdownElements: SceneBreakdownElement[] }) => void
  /** T-108: мостик — cast → персонажи разработки, locations → локации разработки */
  onSendToDevelopment?: (el: { category: BreakdownCategory; name: string; sceneIds: string[] }) => void
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

export default function ScriptBreakdown({ scenes, isDark, blocks, onUpdateScene, onSendToDevelopment }: ScriptBreakdownProps) {
  const { showToast } = useToastStore()
  const [selectedCategory, setSelectedCategory] = useState<BreakdownCategory | 'all'>('all')
  const [selectedScene, setSelectedScene] = useState<string | 'all'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newElementName, setNewElementName] = useState('')
  const [newElementCategory, setNewElementCategory] = useState<BreakdownCategory>('cast')
  const [newElementScene, setNewElementScene] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState<'elements' | 'table' | 'stats'>('elements')

  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  const memoizedBlocks = useDeepCompareMemoize(blocks)

  // Парсинг блоков из редактора
  const parsedElements = useMemo(() => {
    if (!memoizedBlocks || memoizedBlocks.length === 0) return []
    
    const parsedScenes = parseScript(memoizedBlocks)
    const uniqueElements = getUniqueElements(parsedScenes)
    
    return uniqueElements.map(el => ({
      id: el.id,
      category: el.category,
      name: el.name,
      notes: el.notes,
      sceneIds: el.sceneIds,
      occurrences: el.occurrences,
    }))
  }, [memoizedBlocks])

  // Ручные теги — персистентно на сценах (scene.breakdownElements)
  const manualElements = useMemo(() => flattenSceneTags(scenes), [scenes])

  // Авто + ручные склеиваются по «категория|имя» — один ИВАН не дублируется
  const allElements = useMemo(
    () => mergeBreakdownElements(parsedElements, manualElements),
    [parsedElements, manualElements],
  )

  // Элементы по сцене — для таблицы «сцена × категория»
  const sceneElements = useMemo(() => {
    const map = new Map<string, typeof allElements>()
    scenes.forEach((s) => map.set(s.id, []))
    allElements.forEach((el) => {
      el.sceneIds.forEach((sid) => {
        const arr = map.get(sid)
        if (arr) arr.push(el)
      })
    })
    return map
  }, [scenes, allElements])

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
    const targetScene = newElementScene || (selectedScene !== 'all' ? selectedScene : scenes[0]?.id)
    if (!targetScene) {
      showToast('Нет сцен для привязки тега', 'error')
      return
    }
    const scene = scenes.find((s) => s.id === targetScene)
    if (!scene) return
    const newTag: SceneTag = {
      id: crypto.randomUUID(),
      category: newElementCategory,
      name: newElementName.toUpperCase(),
    }
    onUpdateScene?.(targetScene, {
      breakdownElements: [...(scene.breakdownElements || []), newTag],
    })
    setNewElementName('')
    setShowAddModal(false)
    showToast(`Тег «${newTag.name}» → сцена ${scene.number}`, 'success')
  }

  const removeElement = (el: (typeof allElements)[number]) => {
    if (el.manualRefs.length === 0) {
      showToast('Элемент из текста сценария — убирается правкой текста', 'info')
      return
    }
    el.manualRefs.forEach(({ sceneId, elementId }) => {
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene) return
      onUpdateScene?.(sceneId, {
        breakdownElements: (scene.breakdownElements || []).filter((t) => t.id !== elementId),
      })
    })
  }

  const openAddModal = () => {
    setNewElementScene(selectedScene !== 'all' ? selectedScene : scenes[0]?.id || '')
    setShowAddModal(true)
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

  // T-108: таблица по сценам — матрица «сцена × категория» (классическая разбивка)
  if (activeView === 'table') {
    const shownCategories = selectedCategory === 'all'
      ? CATEGORIES
      : CATEGORIES.filter((c) => c.id === selectedCategory)
    const shownScenes = selectedScene === 'all'
      ? scenes
      : scenes.filter((s) => s.id === selectedScene)
    return (
      <div className="flex-1 flex overflow-hidden" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
        {/* Левая панель — те же фильтры */}
        <div className="w-72 flex flex-col border-r overflow-hidden" style={{ background: cardBg, borderColor: border }}>
          <div className="p-4 border-b" style={{ borderColor: border }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold" style={{ color: textPrimary }}>Разбивка по сценам</h2>
            </div>
            <div className="flex gap-1 mb-3">
              <button onClick={() => setActiveView('elements')} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5 text-gray-500">Элементы</button>
              <button onClick={() => setActiveView('table')} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all bg-indigo-500/20 text-indigo-400"><Table size={12} className="inline mr-1" />Сцены</button>
              <button onClick={() => setActiveView('stats')} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5 text-gray-500"><BarChart3 size={12} className="inline mr-1" />Стат</button>
            </div>
            <select
              value={selectedScene}
              onChange={(e) => setSelectedScene(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-xs outline-none border mb-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-300'}`}
              style={{ color: textPrimary }}
            >
              <option value="all">Все сцены</option>
              {scenes.map(scene => (
                <option key={scene.id} value={scene.id}>{scene.number}. {scene.location}</option>
              ))}
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as BreakdownCategory | 'all')}
              className={`w-full px-3 py-2 rounded-lg text-xs outline-none border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-300'}`}
              style={{ color: textPrimary }}
            >
              <option value="all">Все категории</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex-1" />
        </div>

        {/* Матрица */}
        <div className="flex-1 overflow-auto p-4">
          <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 text-left px-3 py-2 border-b" style={{ background: cardBg, borderColor: border, color: textSecondary }}>Сцена</th>
                {shownCategories.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <th key={cat.id} className="text-left px-3 py-2 border-b" style={{ borderColor: border, color: cat.color }}>
                      <span className="flex items-center gap-1"><Icon size={12} />{cat.label}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {shownScenes.map((scene) => {
                const els = sceneElements.get(scene.id) || []
                return (
                  <tr key={scene.id} className="border-b" style={{ borderColor: border }}>
                    <td className="sticky left-0 z-10 px-3 py-2 font-medium whitespace-nowrap" style={{ background: cardBg, color: textPrimary }}>
                      {scene.number}. {scene.location}
                    </td>
                    {shownCategories.map((cat) => {
                      const inCat = els.filter((e) => e.category === cat.id)
                      return (
                        <td key={cat.id} className="px-3 py-2 align-top" style={{ color: textPrimary }}>
                          {inCat.map((e) => (
                            <span key={e.id} className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded"
                              style={{ background: `${cat.color}18`, color: cat.color }}>
                              {e.name}
                            </span>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {shownScenes.length === 0 && (
            <p className="text-sm text-center py-12" style={{ color: textSecondary }}>Нет сцен</p>
          )}
        </div>
      </div>
    )
  }

  // Режим элементов (activeView === 'elements')
  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      
      {/* Левая панель — фильтры и категории */}
      <div className="w-72 flex flex-col border-r overflow-hidden"
        style={{ background: cardBg, borderColor: border }}>
        
        {/* Шапка */}
        <div className="p-4 border-b" style={{ borderColor: border }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: textPrimary }}>
              Разбивка сцен
            </h2>
            <span className="text-xs px-2 py-1 rounded-full"
              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0', color: textSecondary }}>
              {filteredElements.length} элементов
            </span>
          </div>
          
          {/* Переключатель режимов */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveView('elements')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === 'elements' ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-white/5 text-gray-500'}`}
            >
              Элементы
            </button>
            <button
              onClick={() => setActiveView('table')}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5 text-gray-500"
              title="Таблица по сценам"
            >
              <Table size={12} className="inline mr-1" />
              Сцены
            </button>
            <button
              onClick={() => setActiveView('stats')}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5 text-gray-500"
            >
              <BarChart3 size={12} className="inline mr-1" />
              Стат
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
            onClick={openAddModal}
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
            onClick={() => showToast('Экспорт в PDF будет реализован в следующих версиях', 'info')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all border hover:border-indigo-400 cursor-pointer"
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
                        onClick={() => removeElement(element)}
                        className="p-1 rounded hover:bg-red-500/20 transition-colors"
                        style={{ color: textSecondary }}
                        title={element.manualRefs.length ? 'Удалить тег' : 'Авто-элемент из текста'}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Мостик в разработку: актёры и локации */}
                    {(element.category === 'cast' || element.category === 'locations') && onSendToDevelopment && (
                      <button
                        onClick={() => onSendToDevelopment({ category: element.category, name: element.name, sceneIds: element.sceneIds })}
                        className="mt-2 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-all hover:opacity-80"
                        style={{ background: isDark ? 'rgba(34,197,94,0.12)' : '#dcfce7', color: isDark ? '#4ade80' : '#16a34a' }}
                        title={element.category === 'cast' ? 'Отправить в кастинг (Разработка)' : 'Отправить в локации (Разработка)'}
                      >
                        <ArrowRight size={10} />
                        {element.category === 'cast' ? 'В кастинг' : 'В локации'}
                      </button>
                    )}
                    
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
                  Сцена
                </label>
                <select
                  value={newElementScene}
                  onChange={(e) => setNewElementScene(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm outline-none border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-300'}`}
                  style={{ color: textPrimary }}
                >
                  {scenes.map(scene => (
                    <option key={scene.id} value={scene.id}>{scene.number}. {scene.location}</option>
                  ))}
                </select>
              </div>

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
                  {CATEGORIES.map(cat => {
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
