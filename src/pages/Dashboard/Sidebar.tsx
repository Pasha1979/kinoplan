import { useNavigate, useLocation } from 'react-router-dom'
import {
  Film, FileText, Calendar, ClipboardList,
  Users, Video, Settings, ChevronLeft, ChevronRight,
  ArrowLeft
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'

interface NavItem {
  icon: React.ReactNode
  label: string
  path: string
  ready: boolean
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarExpanded, toggleSidebar } = useUiStore()
  const { getCurrentProject } = useProjectStore()
  const project = getCurrentProject()

  if (!project) return null

  const navItems: NavItem[] = [
    { icon: <Film size={20} />, label: 'Обзор', path: `/project/${project.id}`, ready: true },
    { icon: <FileText size={20} />, label: 'Сценарий', path: `/project/${project.id}/script`, ready: false },
    { icon: <Calendar size={20} />, label: 'Планирование', path: `/project/${project.id}/schedule`, ready: false },
    { icon: <ClipboardList size={20} />, label: 'Вызывные', path: `/project/${project.id}/callsheets`, ready: false },
    { icon: <Users size={20} />, label: 'Пре-продакшн', path: `/project/${project.id}/preproduction`, ready: false },
    { icon: <Video size={20} />, label: 'Продакшн', path: `/project/${project.id}/production`, ready: false },
  ]

  return (
    <aside
      className="relative flex flex-col border-r border-white/8 transition-all duration-300"
      style={{
        width: sidebarExpanded ? '240px' : '72px',
        background: 'linear-gradient(180deg, #111128 0%, #0d0d1e 100%)',
        minHeight: '100vh',
      }}
    >
      {/* Шапка — логотип + название проекта */}
      <div
        className="shrink-0 flex items-center gap-3 border-b border-white/8 overflow-hidden"
        style={{ padding: sidebarExpanded ? '20px 20px 18px' : '20px 0 18px', justifyContent: sidebarExpanded ? 'flex-start' : 'center' }}
      >
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Film size={18} className="text-white" />
        </div>
        {sidebarExpanded && (
          <div className="overflow-hidden">
            <p className="text-white text-sm font-bold truncate leading-tight">{project.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">КиноПлан</p>
          </div>
        )}
      </div>

      {/* Навигация */}
      <nav className="flex-1 py-4 space-y-1" style={{ padding: '16px 10px' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={!sidebarExpanded ? item.label : undefined}
              className="w-full flex items-center gap-3 rounded-xl transition-all duration-200 relative group"
              style={{
                padding: sidebarExpanded ? '12px 14px' : '12px 0',
                justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                background: isActive ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: isActive ? '#fb923c' : item.ready ? '#9ca3af' : '#4b5563',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {/* Активная полоса слева */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-orange-500 rounded-r-full" />
              )}

              <span className="shrink-0" style={{ marginLeft: isActive && sidebarExpanded ? '4px' : undefined }}>
                {item.icon}
              </span>

              {sidebarExpanded && (
                <>
                  <span className="text-sm font-medium truncate flex-1 text-left">{item.label}</span>
                  {!item.ready && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#4b5563' }}
                    >
                      скоро
                    </span>
                  )}
                </>
              )}
            </button>
          )
        })}
      </nav>

      {/* Нижняя часть */}
      <div className="shrink-0 border-t border-white/8 space-y-1" style={{ padding: '12px 10px' }}>
        <button
          onClick={() => navigate('/')}
          title={!sidebarExpanded ? 'К проектам' : undefined}
          className="w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200"
          style={{
            padding: sidebarExpanded ? '11px 14px' : '11px 0',
            justifyContent: sidebarExpanded ? 'flex-start' : 'center',
            color: '#6b7280',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLElement).style.color = '#d1d5db'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#6b7280'
          }}
        >
          <ArrowLeft size={20} className="shrink-0" />
          {sidebarExpanded && <span className="font-medium">К проектам</span>}
        </button>

        <button
          title={!sidebarExpanded ? 'Настройки' : undefined}
          className="w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200"
          style={{
            padding: sidebarExpanded ? '11px 14px' : '11px 0',
            justifyContent: sidebarExpanded ? 'flex-start' : 'center',
            color: '#6b7280',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLElement).style.color = '#d1d5db'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#6b7280'
          }}
        >
          <Settings size={20} className="shrink-0" />
          {sidebarExpanded && <span className="font-medium">Настройки</span>}
        </button>
      </div>

      {/* Кнопка сворачивания */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3.5 top-24 w-7 h-7 rounded-full flex items-center justify-center transition-all z-10"
        style={{
          background: '#1e1e3a',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#6b7280',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(249,115,22,0.5)'
          ;(e.currentTarget as HTMLElement).style.color = '#fb923c'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'
          ;(e.currentTarget as HTMLElement).style.color = '#6b7280'
        }}
      >
        {sidebarExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </aside>
  )
}
