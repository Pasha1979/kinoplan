import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings, Film, Search } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import ProjectCard from './ProjectCard'
import CreateProjectModal from './CreateProjectModal'
import type { Project } from '../../store/projectStore'

export default function HomePage() {
  const navigate = useNavigate()
  const { projects, addProject, deleteProject, setCurrentProject } = useProjectStore()
  const { theme, toggleTheme } = useUiStore()
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = (project: Project) => {
    addProject(project)
    setCurrentProject(project.id)
    setShowModal(false)
    navigate(`/project/${project.id}`)
  }

  const handleOpen = (project: Project) => {
    setCurrentProject(project.id)
    navigate(`/project/${project.id}`)
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
            onClick={() => alert('Настройки приложения будут реализованы позже')}
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
      <main className="flex-1 flex flex-col px-6 py-8 max-w-6xl mx-auto w-full">
        {projects.length === 0 ? (
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
            {/* Шапка списка проектов */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Мои проекты
                </h1>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  {projects.length} {projects.length === 1 ? 'проект' : projects.length < 5 ? 'проекта' : 'проектов'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus size={16} />
                Новый проект
              </button>
            </div>

            {/* Поиск */}
            {projects.length > 3 && (
              <div className={`relative mb-6 max-w-sm`}>
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Найти проект..."
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-orange-500/40'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400'
                  }`}
                />
              </div>
            )}

            {/* Сетка карточек */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => handleOpen(project)}
                  onDelete={() => deleteProject(project.id)}
                />
              ))}
              {/* Карточка создания нового */}
              <button
                onClick={() => setShowModal(true)}
                className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-48 transition-all hover:-translate-y-0.5 active:translate-y-0 ${
                  theme === 'dark'
                    ? 'border-white/10 text-gray-600 hover:border-orange-500/30 hover:text-orange-400 hover:bg-orange-500/3'
                    : 'border-gray-200 text-gray-400 hover:border-orange-400 hover:text-orange-500'
                }`}
              >
                <div className="w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center">
                  <Plus size={24} />
                </div>
                <span className="text-sm font-medium">Новый проект</span>
              </button>
            </div>
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
