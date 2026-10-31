import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings, Film, Search, Upload, Star, ArrowUpDown, X, FolderOpen, Tag, Copy, Download, Archive, ArchiveRestore, Trash2, HelpCircle } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import { useToastStore } from '../../store/toastStore'
import { projectService } from '../../services/projectService'
import { useUiStore } from '../../store/uiStore'
import { browserFS } from '../../adapters/BrowserFS'
import ProjectCard, { TYPE_LABELS, STATUS_LABELS, getOverallProgress } from './ProjectCard'
import FilterDropdown from './FilterDropdown'
import SortableCard from './SortableCard'
import ContextMenu from './ContextMenu'
import TagEditor from './TagEditor'
import HomeHelpModal from './HomeHelpModal'
import CreateProjectModal from './CreateProjectModal'
import type { Project } from '../../store/projectStore'

type TabKey = 'all' | 'favorites' | 'recent' | 'archive'
type SortBy = 'updated' | 'name' | 'created' | 'progress' | 'manual'

const SORT_OPTIONS = [
  { value: 'updated', label: 'Сначала изменённые' },
  { value: 'name', label: 'По названию (А–Я)' },
  { value: 'created', label: 'По дате создания' },
  { value: 'progress', label: 'По прогрессу' },
  { value: 'manual', label: 'Свой порядок' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Все типы' },
  ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export default function HomePage() {
  const navigate = useNavigate()
  const { projects, isLoading, error, toggleFavorite, updateLastOpenedAt, updateProject, reorderProjects } = useNormalizedProjectStore()
  const { theme, toggleTheme } = useUiStore()
  const { showToast } = useToastStore()
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null)
  const [tagEditor, setTagEditor] = useState<{ x: number; y: number; project: Project } | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const projectList = useMemo(() => Object.values(projects), [projects])

  // Количество недавно открытых проектов (по lastOpenedAt, без архива)
  const recentCount = useMemo(() => {
    return projectList.filter((p: Project) => p.lastOpenedAt && !p.isArchived).length
  }, [projectList])

  const archiveCount = useMemo(() => {
    return projectList.filter((p: Project) => p.isArchived).length
  }, [projectList])

  // Все уникальные теги для фильтра
  const allTags = useMemo(() => {
    const set = new Set<string>()
    projectList.forEach((p: Project) => p.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [projectList])

  const tagOptions = useMemo(() => [
    { value: 'all', label: 'Все теги' },
    ...allTags.map((t) => ({ value: t, label: t })),
  ], [allTags])

  const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all' || tagFilter !== 'all'

  const resetFilters = () => {
    setTypeFilter('all')
    setStatusFilter('all')
    setTagFilter('all')
  }

  // Фильтрация по вкладкам, поиску, типу, статусу и тегу + сортировка
  const displayProjects = useMemo(() => {
    let filtered = projectList.filter((p: Project) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )

    // Архив показывается только на своей вкладке
    if (activeTab === 'archive') {
      filtered = filtered.filter((p: Project) => p.isArchived)
    } else {
      filtered = filtered.filter((p: Project) => !p.isArchived)
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((p: Project) => p.type === typeFilter)
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p: Project) => p.status === statusFilter)
    }
    if (tagFilter !== 'all') {
      filtered = filtered.filter((p: Project) => p.tags?.includes(tagFilter))
    }

    if (activeTab === 'favorites') {
      filtered = filtered.filter((p: Project) => p.isFavorite)
    }

    if (activeTab === 'recent') {
      return filtered
        .filter((p: Project) => p.lastOpenedAt)
        .sort((a: Project, b: Project) =>
          new Date(b.lastOpenedAt!).getTime() - new Date(a.lastOpenedAt!).getTime()
        )
    }

    const bySort = (a: Project, b: Project): number => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'ru')
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'progress':
          return getOverallProgress(b) - getOverallProgress(a)
        case 'manual':
          return (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9)
            || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
    }

    // Избранные всегда сверху (кроме ручного порядка), затем выбранная сортировка
    return filtered.sort((a: Project, b: Project) => {
      if (sortBy !== 'manual') {
        const fav = Number(b.isFavorite ?? false) - Number(a.isFavorite ?? false)
        if (fav !== 0) return fav
      }
      return bySort(a, b)
    })
  }, [projectList, search, activeTab, sortBy, typeFilter, statusFilter, tagFilter])

  // Drag-and-drop доступен на вкладке «Все» в ручном порядке без фильтров
  const isDraggable = activeTab === 'all' && sortBy === 'manual' && !search && !hasActiveFilters

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = displayProjects.map((p) => p.id)
    const from = ids.indexOf(active.id as string)
    const to = ids.indexOf(over.id as string)
    if (from === -1 || to === -1) return
    reorderProjects(arrayMove(ids, from, to))
  }

  useEffect(() => {
    projectService.getProjects()
  }, [])

  const handleCreate = async (data: Partial<Project>) => {
    const created = await projectService.createProject(data)
    setShowModal(false)
    updateLastOpenedAt(created.id)
    navigate(`/project/${created.id}`)
  }

  const handleOpen = (project: Project) => {
    updateLastOpenedAt(project.id)
    navigate(`/project/${project.id}`)
  }

  const handleDelete = async (id: string) => {
    await projectService.deleteProject(id)
  }

  const handleDuplicate = async (project: Project) => {
    const { id, createdAt, updatedAt, ...rest } = project
    try {
      await projectService.createProject({ ...rest, name: `${project.name} (копия)` })
      showToast('Проект продублирован', 'success')
    } catch {
      showToast('Не удалось продублировать проект', 'error')
    }
  }

  const handleToggleArchive = (project: Project) => {
    updateProject(project.id, { isArchived: !project.isArchived })
    showToast(project.isArchived ? 'Проект возвращён из архива' : 'Проект перемещён в архив', 'info')
  }

  const menuItems = contextMenu ? [
    {
      label: 'Открыть',
      icon: <FolderOpen size={14} />,
      onClick: () => handleOpen(contextMenu.project),
    },
    {
      label: contextMenu.project.isFavorite ? 'Убрать из избранного' : 'В избранное',
      icon: <Star size={14} fill={contextMenu.project.isFavorite ? 'currentColor' : 'none'} />,
      onClick: () => toggleFavorite(contextMenu.project.id),
    },
    {
      label: 'Теги…',
      icon: <Tag size={14} />,
      onClick: () => setTagEditor({ x: contextMenu.x, y: contextMenu.y, project: contextMenu.project }),
    },
    {
      label: 'Дублировать',
      icon: <Copy size={14} />,
      onClick: () => { void handleDuplicate(contextMenu.project) },
    },
    {
      label: 'Экспорт',
      icon: <Download size={14} />,
      onClick: () => { void handleExport(contextMenu.project.id, contextMenu.project.name) },
    },
    {
      label: contextMenu.project.isArchived ? 'Вернуть из архива' : 'В архив',
      icon: contextMenu.project.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />,
      onClick: () => handleToggleArchive(contextMenu.project),
    },
    {
      label: 'Удалить',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: () => {
        if (confirm(`Удалить проект "${contextMenu.project.name}"? Это действие нельзя отменить.`)) {
          void handleDelete(contextMenu.project.id)
        }
      },
    },
  ] : []

  const handleExport = async (projectId: string, projectName: string) => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const json = await projectService.exportProjectToJSON(projectId)
      const filename = `${projectName.replace(/[^a-zа-яё0-9]/gi, '_')}.json`
      await browserFS.downloadFile(filename, json, 'application/json')
      showToast('Проект экспортирован', 'success')
    } catch {
      showToast('Не удалось экспортировать проект', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = async () => {
    if (isImporting) return
    setIsImporting(true)
    try {
      const text = await browserFS.uploadFile('.json')
      const imported = await projectService.importProjectFromJSON(text)
      updateLastOpenedAt(imported.id)
      navigate(`/project/${imported.id}`)
      showToast('Проект импортирован', 'success')
    } catch {
      showToast('Не удалось импортировать проект', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-[#0d0d1a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Верхняя панель */}
      <header className={`sticky top-0 z-30 flex items-center justify-between px-10 md:px-16 lg:px-24 h-16 border-b ${
        theme === 'dark' ? 'bg-[#0d0d1a]/80 border-white/8 backdrop-blur-md' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Film size={16} className="text-white" />
          </div>
          <span className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            КиноПлан
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Кнопка Импорт */}
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-white hover:bg-white/8 disabled:opacity-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50'
            }`}
            title="Импорт проекта">
            <Upload size={18} />
          </button>
          {/* Переключатель темы */}
          <button
            onClick={toggleTheme}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              theme === 'dark'
                ? 'border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {theme === 'dark' ? '☀️ Светлая' : '🌙 Тёмная'}
          </button>
          {/* Помощь по разделу */}
          <button
            onClick={() => setShowHelp(true)}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-white hover:bg-white/8'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Помощь по этой странице">
            <HelpCircle size={18} />
          </button>
          <button
            onClick={() => showToast('Настройки приложения будут реализованы позже', 'info')}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-white hover:bg-white/8'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}>
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 flex flex-col px-10 md:px-16 lg:px-24 py-8 max-w-[1400px] mx-auto w-full">
        {isLoading && projectList.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Загрузка...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-red-400">{error}</span>
          </div>
        ) : projectList.length === 0 ? (
          /* Приветственный экран — первый запуск */
          <div className="flex-1 flex flex-col items-center justify-center text-center pb-24">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center mb-6">
              <Film size={36} className="text-orange-400" />
            </div>
            <h2 className={`text-2xl font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              У вас пока нет проектов
            </h2>
            <p className={`text-base mb-8 max-w-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Создайте первый проект и начните планировать производство
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white rounded-2xl font-semibold text-base transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={20} />
              Создать первый проект
            </button>
          </div>
        ) : (
          <>
            {/* Горизонтальные вкладки */}
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'bg-orange-500 text-white'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-white/5'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Все <span className={`ml-2 text-xs opacity-70`}>{projectList.length}</span>
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'favorites'
                      ? 'bg-orange-500 text-white'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-white/5'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Star size={16} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />
                  Избранное <span className={`ml-2 text-xs opacity-70`}>{projectList.filter(p => p.isFavorite).length}</span>
                </button>
                <button
                  onClick={() => setActiveTab('recent')}
                  className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'recent'
                      ? 'bg-orange-500 text-white'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-white/5'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Недавние <span className={`ml-2 text-xs opacity-70`}>{recentCount}</span>
                </button>
                <button
                  onClick={() => setActiveTab('archive')}
                  className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'archive'
                      ? 'bg-orange-500 text-white'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-white/5'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Archive size={16} />
                  Архив <span className={`ml-2 text-xs opacity-70`}>{archiveCount}</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-colors border disabled:opacity-50 ${
                    theme === 'dark'
                      ? 'border-white/15 text-gray-300 hover:border-orange-500/40 hover:text-white'
                      : 'border-gray-200 text-gray-600 hover:border-orange-400 hover:text-gray-900'
                  }`}
                >
                  <Upload size={16} />
                  Импорт
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-colors bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-400 hover:to-red-400 shadow-lg shadow-orange-500/20"
                >
                  <Plus size={20} />
                  Новый проект
                </button>
              </div>
            </div>

            {/* Поиск + сортировка + фильтры */}
            <div className="flex items-center gap-3 flex-wrap mb-12">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Найти проект..."
                  className={`w-full pl-12 pr-4 py-3 rounded-xl text-sm border focus:outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-orange-500/40'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400'
                  }`}
                />
              </div>

              {activeTab !== 'recent' && (
                <FilterDropdown
                  icon={<ArrowUpDown size={14} />}
                  options={SORT_OPTIONS}
                  value={sortBy}
                  onChange={(v) => setSortBy(v as SortBy)}
                />
              )}
              <FilterDropdown
                options={TYPE_OPTIONS}
                value={typeFilter}
                onChange={setTypeFilter}
                highlight={typeFilter !== 'all'}
              />
              <FilterDropdown
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
                highlight={statusFilter !== 'all'}
              />
              {allTags.length > 0 && (
                <FilterDropdown
                  icon={<Tag size={14} />}
                  options={tagOptions}
                  value={tagFilter}
                  onChange={setTagFilter}
                  highlight={tagFilter !== 'all'}
                />
              )}

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className={`flex items-center gap-1.5 px-3 py-3 rounded-xl text-sm transition-colors ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-white/5'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Сбросить фильтры"
                >
                  <X size={14} />
                  Сбросить
                </button>
              )}
            </div>

            {/* Сетка карточек */}
            {displayProjects.length === 0 ? (
              <div className={`py-16 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {search || hasActiveFilters
                  ? 'Ничего не найдено'
                  : activeTab === 'favorites'
                    ? 'Нет избранных проектов — нажмите на звёздочку на карточке проекта'
                    : activeTab === 'archive'
                      ? 'Архив пуст — переместить проект можно через правый клик по карточке'
                      : 'Нет недавно открытых проектов'}
              </div>
            ) : isDraggable ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={displayProjects.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {displayProjects.map((project: Project) => (
                      <SortableCard key={project.id} id={project.id}>
                        <ProjectCard
                          project={project}
                          onClick={() => handleOpen(project)}
                          onDelete={() => handleDelete(project.id)}
                          onExport={() => handleExport(project.id, project.name)}
                          onToggleFavorite={() => toggleFavorite(project.id)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setContextMenu({ x: e.clientX, y: e.clientY, project })
                          }}
                        />
                      </SortableCard>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {displayProjects.map((project: Project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => handleOpen(project)}
                    onDelete={() => handleDelete(project.id)}
                    onExport={() => handleExport(project.id, project.name)}
                    onToggleFavorite={() => toggleFavorite(project.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({ x: e.clientX, y: e.clientY, project })
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Контекстное меню карточки */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Редактор тегов проекта */}
      {tagEditor && (
        <TagEditor
          x={tagEditor.x}
          y={tagEditor.y}
          tags={projects[tagEditor.project.id]?.tags ?? []}
          onChange={(tags) => updateProject(tagEditor.project.id, { tags })}
          onClose={() => setTagEditor(null)}
        />
      )}

      {/* Помощь по странице */}
      {showHelp && (
        <HomeHelpModal
          isDark={theme === 'dark'}
          onClose={() => setShowHelp(false)}
        />
      )}

      {/* Модальное окно создания проекта */}
      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
