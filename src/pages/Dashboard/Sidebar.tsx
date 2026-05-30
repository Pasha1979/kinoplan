import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Film, FileText, Calendar, ClipboardList,
  Video, ChevronLeft, ChevronRight, Settings,
  ArrowLeft, MapPin, Shirt, Car, Package,
  Zap, PersonStanding, Sparkles, MessageSquare, Users, ChevronDown,
  ClipboardCheck, UserCheck, BarChart2, FolderOpen, GitBranch,
  ScrollText, Tag, History
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'

interface NavItem {
  icon: React.ReactNode
  label: string
  path: string
  ready: boolean
  group?: string
}

function NavButton({ item, isActive, sidebarExpanded, onClick }: {
  item: NavItem; isActive: boolean; sidebarExpanded: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={!sidebarExpanded ? item.label : undefined}
      className="w-full flex items-center gap-3 rounded-xl transition-all duration-200 relative"
      style={{
        padding: sidebarExpanded ? '10px 14px' : '10px 0',
        justifyContent: sidebarExpanded ? 'flex-start' : 'center',
        background: isActive ? 'rgba(249,115,22,0.15)' : 'transparent',
        color: isActive ? '#fb923c' : item.ready ? '#9ca3af' : '#4b5563',
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange-500 rounded-r-full" />}
      <span className="shrink-0">{item.icon}</span>
      {sidebarExpanded && (
        <>
          <span className="text-sm font-medium truncate flex-1 text-left">{item.label}</span>
          {!item.ready && (
            <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#374151' }}>скоро</span>
          )}
        </>
      )}
    </button>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarExpanded, toggleSidebar } = useUiStore()
  const { getCurrentProject } = useProjectStore()
  const project = getCurrentProject()

  const [preproOpen, setPreproOpen] = useState(true)
  const [productionOpen, setProductionOpen] = useState(true)
  const [teamOpen, setTeamOpen] = useState(true)
  const [reportsOpen, setReportsOpen] = useState(true)
  const [filesOpen, setFilesOpen] = useState(true)

  if (!project) return null

  const navItems: NavItem[] = [
    // Основные
    { icon: <Film size={20} />,        label: 'Обзор',        path: `/project/${project.id}`,           ready: true },
    { icon: <FileText size={20} />,    label: 'Сценарий',     path: `/project/${project.id}/script`,    ready: false },
    { icon: <Calendar size={20} />,    label: 'Планирование', path: `/project/${project.id}/schedule`,  ready: false },
    { icon: <ClipboardList size={20}/>,label: 'Вызывные',     path: `/project/${project.id}/callsheets`,ready: false },
    // Пре-продакшн
    { icon: <Users size={20} />,       label: 'Кастинг',      path: `/project/${project.id}/casting`,   ready: false, group: 'Пре-продакшн' },
    { icon: <MapPin size={20} />,      label: 'Локации',      path: `/project/${project.id}/locations`, ready: false, group: 'Пре-продакшн' },
    { icon: <Shirt size={20} />,       label: 'Костюмы',      path: `/project/${project.id}/costumes`,  ready: false, group: 'Пре-продакшн' },
    { icon: <Car size={20} />,         label: 'Транспорт',    path: `/project/${project.id}/transport`, ready: false, group: 'Пре-продакшн' },
    { icon: <Package size={20} />,     label: 'Реквизит',     path: `/project/${project.id}/props`,     ready: false, group: 'Пре-продакшн' },
    { icon: <Zap size={20} />,         label: 'Пиротехника',  path: `/project/${project.id}/sfx`,       ready: false, group: 'Пре-продакшн' },
    { icon: <PersonStanding size={20}/>,label: 'Каскадёры',   path: `/project/${project.id}/stunts`,    ready: false, group: 'Пре-продакшн' },
    { icon: <Sparkles size={20} />,    label: 'VFX / CG',     path: `/project/${project.id}/vfx`,       ready: false, group: 'Пре-продакшн' },
    { icon: <MessageSquare size={20}/>,label: 'Собрания',     path: `/project/${project.id}/meetings`,  ready: false, group: 'Пре-продакшн' },
    // Продакшн
    { icon: <Video size={20} />,          label: 'Съёмочный день',    path: `/project/${project.id}/production`,   ready: false, group: 'Продакшн' },
    { icon: <ClipboardCheck size={20} />, label: 'Произв. отчёты',    path: `/project/${project.id}/reports`,      ready: false, group: 'Продакшн' },
    { icon: <ScrollText size={20} />,     label: 'Явочный лист',      path: `/project/${project.id}/attendance`,   ready: false, group: 'Продакшн' },
    { icon: <UserCheck size={20} />,      label: 'DOOD / Занятость',  path: `/project/${project.id}/dood`,         ready: false, group: 'Продакшн' },
    // Команда
    { icon: <Users size={20} />,          label: 'Съёмочная группа',  path: `/project/${project.id}/crew`,         ready: false, group: 'Команда' },
    { icon: <History size={20} />,        label: 'Лог изменений',     path: `/project/${project.id}/changelog`,    ready: false, group: 'Команда' },
    // Отчёты
    { icon: <BarChart2 size={20} />,      label: 'Аналитика',         path: `/project/${project.id}/analytics`,    ready: false, group: 'Отчёты' },
    { icon: <GitBranch size={20} />,      label: 'Версии КПП',        path: `/project/${project.id}/scheduleversions`, ready: false, group: 'Отчёты' },
    { icon: <Tag size={20} />,            label: 'Теги',              path: `/project/${project.id}/tags`,         ready: false, group: 'Отчёты' },
    // Файлы
    { icon: <FolderOpen size={20} />,     label: 'Медиатека',         path: `/project/${project.id}/files`,        ready: false, group: 'Файлы' },
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
      <nav className="flex-1 overflow-y-auto" style={{ padding: '12px 10px' }}>

        {/* Основные пункты (без группы) */}
        {navItems.filter(i => !i.group).map((item) => {
          const isActive = location.pathname === item.path
          return (
            <NavButton key={item.path} item={item} isActive={isActive}
              sidebarExpanded={sidebarExpanded} onClick={() => navigate(item.path)} />
          )
        })}

        {/* Группа: Пре-продакшн (аккордеон) */}
        <div className="mt-3">
          {/* Заголовок группы — кнопка сворачивания */}
          {sidebarExpanded ? (
            <button
              onClick={() => setPreproOpen(o => !o)}
              className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg transition-colors mb-1"
              style={{ color: '#374151' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6b7280'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}
            >
              <span className="text-xs font-bold uppercase tracking-widest">Пре-продакшн</span>
              <ChevronDown size={13} style={{ transform: preproOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </button>
          ) : (
            <div className="h-px mx-2 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
          )}

          {/* Пункты группы */}
          {(preproOpen || !sidebarExpanded) && (
            <div>
              {navItems.filter(i => i.group === 'Пре-продакшн').map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavButton key={item.path} item={item} isActive={isActive}
                    sidebarExpanded={sidebarExpanded} onClick={() => navigate(item.path)} />
                )
              })}
            </div>
          )}
        </div>

        {/* Группа: Продакшн (аккордеон) */}
        <div className="mt-3">
          {sidebarExpanded ? (
            <button
              onClick={() => setProductionOpen(o => !o)}
              className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg transition-colors mb-1"
              style={{ color: '#374151' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6b7280'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}
            >
              <span className="text-xs font-bold uppercase tracking-widest">Продакшн</span>
              <ChevronDown size={13} style={{ transform: productionOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </button>
          ) : (
            <div className="h-px mx-2 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
          )}
          {(productionOpen || !sidebarExpanded) && (
            <div>
              {navItems.filter(i => i.group === 'Продакшн').map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavButton key={item.path} item={item} isActive={isActive}
                    sidebarExpanded={sidebarExpanded} onClick={() => navigate(item.path)} />
                )
              })}
            </div>
          )}
        </div>

        {/* Группа: Команда (аккордеон) */}
        <div className="mt-3">
          {sidebarExpanded ? (
            <button
              onClick={() => setTeamOpen(o => !o)}
              className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg transition-colors mb-1"
              style={{ color: '#374151' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6b7280'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}
            >
              <span className="text-xs font-bold uppercase tracking-widest">Команда</span>
              <ChevronDown size={13} style={{ transform: teamOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </button>
          ) : (
            <div className="h-px mx-2 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
          )}
          {(teamOpen || !sidebarExpanded) && (
            <div>
              {navItems.filter(i => i.group === 'Команда').map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavButton key={item.path} item={item} isActive={isActive}
                    sidebarExpanded={sidebarExpanded} onClick={() => navigate(item.path)} />
                )
              })}
            </div>
          )}
        </div>

        {/* Группа: Отчёты (аккордеон) */}
        <div className="mt-3">
          {sidebarExpanded ? (
            <button
              onClick={() => setReportsOpen(o => !o)}
              className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg transition-colors mb-1"
              style={{ color: '#374151' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6b7280'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}
            >
              <span className="text-xs font-bold uppercase tracking-widest">Отчёты</span>
              <ChevronDown size={13} style={{ transform: reportsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </button>
          ) : (
            <div className="h-px mx-2 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
          )}
          {(reportsOpen || !sidebarExpanded) && (
            <div>
              {navItems.filter(i => i.group === 'Отчёты').map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavButton key={item.path} item={item} isActive={isActive}
                    sidebarExpanded={sidebarExpanded} onClick={() => navigate(item.path)} />
                )
              })}
            </div>
          )}
        </div>

        {/* Группа: Файлы (аккордеон) */}
        <div className="mt-3">
          {sidebarExpanded ? (
            <button
              onClick={() => setFilesOpen(o => !o)}
              className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg transition-colors mb-1"
              style={{ color: '#374151' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6b7280'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}
            >
              <span className="text-xs font-bold uppercase tracking-widest">Файлы</span>
              <ChevronDown size={13} style={{ transform: filesOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </button>
          ) : (
            <div className="h-px mx-2 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
          )}
          {(filesOpen || !sidebarExpanded) && (
            <div>
              {navItems.filter(i => i.group === 'Файлы').map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavButton key={item.path} item={item} isActive={isActive}
                    sidebarExpanded={sidebarExpanded} onClick={() => navigate(item.path)} />
                )
              })}
            </div>
          )}
        </div>

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
          onClick={() => alert('Настройки приложения будут реализованы позже')}
          className="w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200 cursor-pointer"
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
