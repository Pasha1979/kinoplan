import { Outlet, useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useNormalizedProjectStore } from '../store/useProjectStore'
import { useUiStore } from '../store/uiStore'
import Sidebar from '../pages/Dashboard/Sidebar'

export default function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { projects, setCurrentProject } = useProjectStore()
  const { setCurrentProjectId } = useNormalizedProjectStore()
  const { theme } = useUiStore()

  // Устанавливаем текущий проект из URL
  useEffect(() => {
    if (!projectId) {
      navigate('/')
      return
    }
    const exists = projects.find((p) => p.id === projectId)
    if (!exists) {
      navigate('/')
      return
    }
    setCurrentProject(projectId)
    setCurrentProjectId(projectId)
  }, [projectId, projects, navigate, setCurrentProject, setCurrentProjectId])

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-[#0d0d1a]' : 'bg-gray-50'}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
