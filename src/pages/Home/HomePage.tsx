import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings, Film, Search, Upload, Star } from 'lucide-react'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import { useToastStore } from '../../store/toastStore'
import { projectService } from '../../services/projectService'
import { useUiStore } from '../../store/uiStore'
import { browserFS } from '../../adapters/BrowserFS'
import ProjectCard from './ProjectCard'
import CreateProjectModal from './CreateProjectModal'
import type { Project } from '../../store/projectStore'

export default function HomePage() {
  const navigate = useNavigate()
  const { projects, isLoading, error, toggleFavorite, updateLastOpenedAt } = useNormalizedProjectStore()
  const { theme, toggleTheme } = useUiStore()
  const { showToast } = useToastStore()
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'recent'>('all')

  const projectList = useMemo(() => Object.values(projects), [projects])

  // Количество недавно открытых проектов (по lastOpenedAt)
  const recentCount = useMemo(() => {
    return projectList.filter((p: Project) => p.lastOpenedAt).length
  }, [projectList])

  // Фильтрация по вкладкам
  const displayProjects = useMemo(() => {
    let filtered = projectList.filter((p: Project) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )

    if (activeTab === 'favorites') {
      filtered = filtered.filter((p: Project) => p.isFavorite)
    } else if (activeTab === 'recent') {
      filtered = filtered.filter((p: Project) => p.lastOpenedAt)
      filtered = filtered.sort((a: Project, b: Project) => 
        new Date(b.lastOpenedAt!).getTime() - new Date(a.lastOpenedAt!).getTime()
      )
    }
    // 'all' — показываем все

    return filtered
  }, [projectList, search, activeTab])

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
      <header className={`sticky top-0 z-30 flex items-center justify-between px-6 h-16 border-b ${
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
      <main className="flex-1 flex flex-col px-8 py-8 max-w-7xl mx-auto w-full">
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
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-colors bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-400 hover:to-red-400 shadow-lg shadow-orange-500/20"
              >
                <Plus size={20} />
                Новый проект
              </button>
            </div>

            {/* Поиск */}
            <div className={`relative mb-12 max-w-md`}>
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

            {/* Сетка карточек */}
            {displayProjects.length === 0 ? (
              <div className={`py-16 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {search
                  ? 'Ничего не найдено'
                  : activeTab === 'favorites'
                    ? 'Нет избранных проектов — нажмите на звёздочку на карточке проекта'
                    : 'Нет недавно открытых проектов'}
              </div>
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
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

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
