import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Upload, Plus, BookOpen, Clock, Search, Hash, Sun, Moon, AlignLeft, ChevronLeft, Save, Settings, X, ChevronRight } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useScriptStore } from '../../store/scriptStore'
import ScriptEditor from '../../components/ScriptEditor'

type ScriptView = 'empty' | 'editor'
type ScriptTab = 'text' | 'cards' | 'development' | 'plan' | 'statistics'

const DEMO_SCENES = [
  { id: '1', number: '1', type: 'ИНТ', location: 'КВАРТИРА ИВАНА', time: 'ДЕНЬ', cast: ['ИВАН', 'МАША'], pages: 1.5 },
  { id: '2', number: '2', type: 'ЭКСТ', location: 'УЛИЦА У ДОМА', time: 'ДЕНЬ', cast: ['ИВАН'], pages: 0.5 },
  { id: '3', number: '3', type: 'ИНТ', location: 'ОФИС КОМПАНИИ', time: 'ДЕНЬ', cast: ['ИВАН', 'ДИРЕКТОР', 'СЕКРЕТАРЬ'], pages: 2 },
  { id: '4', number: '4', type: 'ЭКСТ', location: 'ПАРК', time: 'ВЕЧЕР', cast: ['МАША', 'НЕЗНАКОМЕЦ'], pages: 1 },
  { id: '5', number: '5', type: 'ИНТ', location: 'КВАРТИРА ИВАНА', time: 'НОЧЬ', cast: ['ИВАН'], pages: 0.75 },
  { id: '6', number: '6', type: 'ИНТ', location: 'ОФИС КОМПАНИИ', time: 'УТРО', cast: ['ДИРЕКТОР', 'ИВАН', 'КОЛЛЕГИ'], pages: 3 },
  { id: '7', number: '7', type: 'ЭКСТ', location: 'АЭРОПОРТ', time: 'ДЕНЬ', cast: ['ИВАН', 'МАША'], pages: 1.25 },
]

export default function ScriptPage() {
  const navigate = useNavigate()
  const { theme } = useUiStore()
  const { getCurrentProject } = useProjectStore()
  const { scripts } = useScriptStore()
  const project = getCurrentProject()
  const isDark = theme === 'dark'

  const [view, setView] = useState<ScriptView>('empty')
  const [selectedScene, setSelectedScene] = useState(DEMO_SCENES[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [importHover, setImportHover] = useState(false)
  const [createHover, setCreateHover] = useState(false)
  const [activeTab, setActiveTab] = useState<ScriptTab>('text')
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  // Проверяем, есть ли сценарий для текущего проекта
  useEffect(() => {
    if (project) {
      const projectScripts = scripts.filter(s => s.projectId === project.id)
      if (projectScripts.length > 0) {
        setView('editor')
      }
    }
  }, [project, scripts])

  const bg = isDark ? '#0f0f20' : '#f5f5f5'
  const sidebarBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'
  const textMuted = isDark ? '#374151' : '#d1d5db'

  const filteredScenes = DEMO_SCENES.filter(s =>
    s.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.cast.some(c => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
    s.number.includes(searchQuery)
  )

  const totalPages = DEMO_SCENES.reduce((s, sc) => s + sc.pages, 0)

  if (view === 'empty') {
    return (
      <div className="flex-1 flex flex-col" style={{ background: bg }}>

        {/* Шапка */}
        <div className="shrink-0 flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: border }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <FileText size={16} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: textPrimary }}>Сценарий</h1>
              {project && <p className="text-xs" style={{ color: textSecondary }}>{project.name}</p>}
            </div>
          </div>
        </div>

        {/* Центральный экран выбора */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16">

          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: 'rgba(99,102,241,0.12)', border: '2px solid rgba(99,102,241,0.25)' }}>
            <BookOpen size={30} style={{ color: '#818cf8' }} />
          </div>

          <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: textPrimary }}>
            Добавьте сценарий
          </h2>
          <p className="text-sm text-center mb-10 max-w-sm" style={{ color: textSecondary }}>
            Загрузите готовый файл или начните писать с нуля прямо в редакторе
          </p>

          {/* Две карточки выбора */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">

            {/* Загрузить файл */}
            <button
              onClick={() => setView('editor')}
              onMouseEnter={() => setImportHover(true)}
              onMouseLeave={() => setImportHover(false)}
              className="relative flex flex-col items-start rounded-2xl p-6 text-left transition-all overflow-hidden"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #1e1b4b 0%, #1a1a35 60%, #1e1b4b 100%)'
                  : 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                border: `1px solid ${importHover ? 'rgba(129,140,248,0.6)' : 'rgba(129,140,248,0.25)'}`,
                boxShadow: importHover
                  ? '0 8px 32px rgba(99,102,241,0.25), 0 0 0 1px rgba(129,140,248,0.3)'
                  : '0 2px 12px rgba(99,102,241,0.1)',
                transform: importHover ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              {/* Декоративный круг */}
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }} />

              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 relative"
                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                <Upload size={20} className="text-white" />
              </div>

              <p className="font-bold text-base mb-1.5 relative" style={{ color: isDark ? '#f1f5f9' : '#1e1b4b' }}>
                Загрузить файл
              </p>
              <p className="text-xs leading-relaxed mb-4 relative" style={{ color: isDark ? '#94a3b8' : '#6366f1' }}>
                Импорт из Word, PDF или Final Draft. Сцены распознаются автоматически.
              </p>
              <div className="flex gap-2 flex-wrap relative">
                {['DOCX', 'PDF', 'FDX'].map(f => (
                  <span key={f} className="text-xs px-2.5 py-1 rounded-lg font-mono font-bold"
                    style={{
                      background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)',
                      color: isDark ? '#a5b4fc' : '#4338ca',
                      border: '1px solid rgba(99,102,241,0.25)',
                    }}>{f}</span>
                ))}
              </div>
            </button>

            {/* Написать с нуля */}
            <button
              onClick={() => navigate(`/project/${project?.id}/script/create`)}
              onMouseEnter={() => setCreateHover(true)}
              onMouseLeave={() => setCreateHover(false)}
              className="relative flex flex-col items-start rounded-2xl p-6 text-left transition-all overflow-hidden"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #0f2a1e 0%, #1a1a35 60%, #0f2a1e 100%)'
                  : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                border: `1px solid ${createHover ? 'rgba(52,211,153,0.6)' : 'rgba(52,211,153,0.25)'}`,
                boxShadow: createHover
                  ? '0 8px 32px rgba(16,185,129,0.2), 0 0 0 1px rgba(52,211,153,0.3)'
                  : '0 2px 12px rgba(16,185,129,0.08)',
                transform: createHover ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              {/* Декоративный круг */}
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />

              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 relative"
                style={{ background: 'linear-gradient(135deg, #059669, #34d399)', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
                <Plus size={20} className="text-white" />
              </div>

              <p className="font-bold text-base mb-1.5 relative" style={{ color: isDark ? '#f1f5f9' : '#064e3b' }}>
                Написать с нуля
              </p>
              <p className="text-xs leading-relaxed mb-4 relative" style={{ color: isDark ? '#94a3b8' : '#059669' }}>
                Профессиональный редактор с авто-форматированием. Российский и голливудский стандарты.
              </p>
              <div className="flex gap-2 flex-wrap relative">
                {['ИНТ./ЭКСТ.', 'Персонаж', 'Диалог'].map(f => (
                  <span key={f} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                    style={{
                      background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)',
                      color: isDark ? '#6ee7b7' : '#047857',
                      border: '1px solid rgba(16,185,129,0.25)',
                    }}>{f}</span>
                ))}
              </div>
            </button>

          </div>

          {/* Подсказка внизу */}
          <p className="text-xs mt-8" style={{ color: textMuted }}>
            Вставить текст сценария вручную можно прямо в редакторе
          </p>
        </div>
      </div>
    )
  }

  // ─── VIEW: EDITOR ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: bg }}>

      {/* ── Левая панель: навигатор сцен ────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col border-r overflow-hidden"
        style={{ width: 260, background: sidebarBg, borderColor: border }}>

        {/* Шапка навигатора */}
        <div className="shrink-0 px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: textSecondary }}>
              Сцены
            </h2>
            <div className="flex items-center gap-1">
              <span className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: textSecondary }}>
                {DEMO_SCENES.length}
              </span>
              <button className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ color: textSecondary }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Поиск */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: textSecondary }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Сцена, персонаж..."
              className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none transition-colors"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`,
                color: textPrimary,
              }}
            />
          </div>
        </div>

        {/* Список сцен */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filteredScenes.map(scene => {
            const isActive = selectedScene.id === scene.id
            return (
              <button
                key={scene.id}
                onClick={() => setSelectedScene(scene)}
                className="w-full text-left rounded-xl px-3 py-2.5 mb-0.5 transition-all"
                style={{
                  background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold shrink-0 w-5 text-center"
                    style={{ color: isActive ? '#818cf8' : textSecondary }}>
                    {scene.number}
                  </span>
                  <span className="text-xs px-1.5 rounded shrink-0 font-mono"
                    style={{
                      background: scene.type === 'ИНТ' ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.12)',
                      color: scene.type === 'ИНТ' ? '#818cf8' : '#4ade80',
                    }}>
                    {scene.type}
                  </span>
                  <span className="text-xs font-medium truncate flex-1"
                    style={{ color: isActive ? textPrimary : (isDark ? '#d1d5db' : '#374151') }}>
                    {scene.location}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <span className="flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                    {scene.time === 'НОЧЬ' ? <Moon size={9} /> : <Sun size={9} />}
                    {scene.time}
                  </span>
                  <span className="text-xs" style={{ color: textMuted }}>·</span>
                  <span className="text-xs" style={{ color: textSecondary }}>
                    {scene.pages} стр.
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Итого страниц */}
        <div className="shrink-0 px-4 py-3 border-t" style={{ borderColor: border }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: textSecondary }}>Итого страниц</span>
            <span className="text-xs font-bold" style={{ color: textPrimary }}>{totalPages.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs" style={{ color: textSecondary }}>≈ хронометраж</span>
            <span className="text-xs font-bold" style={{ color: '#818cf8' }}>{Math.round(totalPages)} мин</span>
          </div>
        </div>
      </div>

      {/* ── Центральная область: редактор ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Шапка редактора */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b"
          style={{ background: sidebarBg, borderColor: border }}>

          <div className="flex items-center gap-3">
            {/* Кнопка возврата */}
            <button
              onClick={() => setView('empty')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
                color: isDark ? '#e5e7eb' : '#374151',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.14)' : '#e5e5e5' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0' }}
            >
              <ChevronLeft size={14} />
              Назад
            </button>
            <span style={{ color: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb' }}>|</span>
            <div>
              <p className="text-sm font-bold" style={{ color: textPrimary }}>
                Сц. {selectedScene.number} · {selectedScene.type}. {selectedScene.location} — {selectedScene.time}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                {selectedScene.cast.map(c => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-md"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: textSecondary }}>
                    {c}
                  </span>
                ))}
                <span className="flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                  <AlignLeft size={10} />
                  {selectedScene.pages} стр.
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Кнопка Сохранить */}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.3)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.25)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)' }}
            >
              <Save size={13} />
              Сохранить
            </button>
            {/* Кнопка Настройки */}
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ color: textSecondary }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <Settings size={15} />
            </button>
            {/* Кнопка правой панели */}
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ color: textSecondary }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              {rightPanelOpen ? <X size={15} /> : <ChevronRight size={15} />}
            </button>
          </div>
        </div>

        {/* Вкладки */}
        <div className="shrink-0 flex items-center gap-1 px-6 py-2 border-b"
          style={{ background: sidebarBg, borderColor: border }}>
          {[
            { id: 'text' as ScriptTab, label: 'ТЕКСТ' },
            { id: 'cards' as ScriptTab, label: 'КАРТОЧКИ' },
            { id: 'development' as ScriptTab, label: 'РАЗРАБОТКА' },
            { id: 'plan' as ScriptTab, label: 'ПЛАН' },
            { id: 'statistics' as ScriptTab, label: 'СТАТИСТИКА' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: activeTab === tab.id ? '#818cf8' : textSecondary,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Область текста сценария */}
        <ScriptEditor 
          format="russian"
          fontFamily="Courier New"
          fontSize={12}
          isDark={isDark}
        />

        {/* Статусбар внизу */}
        <div className="shrink-0 flex items-center gap-6 px-6 py-2 border-t"
          style={{ background: sidebarBg, borderColor: border }}>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
            <Hash size={11} />
            Сцена {selectedScene.number} из {DEMO_SCENES.length}
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
            <AlignLeft size={11} />
            {selectedScene.pages} стр.
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
            <Clock size={11} />
            ≈ {Math.round(selectedScene.pages * 60)} сек
          </span>
          <div className="flex-1" />
          <span className="text-xs" style={{ color: textMuted }}>
            Всего: {totalPages.toFixed(2)} стр. · ≈ {Math.round(totalPages)} мин
          </span>
        </div>
      </div>

      {/* ── Правая панель: заметки / версии ───────────────────────────────────── */}
      {rightPanelOpen && (
        <div className="shrink-0 flex flex-col border-l overflow-hidden"
          style={{ width: 300, background: sidebarBg, borderColor: border }}>
          
          {/* Шапка правой панели */}
          <div className="shrink-0 px-4 pt-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: textSecondary }}>
                Заметки к сцене
              </h2>
            </div>
          </div>

          {/* Заметки (заглушка) */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="rounded-xl p-4 mb-3"
              style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Hash size={12} style={{ color: '#818cf8' }} />
                <span className="text-xs font-bold" style={{ color: textPrimary }}>The Drafts</span>
              </div>
              <div className="space-y-2">
                <div className="text-xs px-2 py-1.5 rounded-md"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: textSecondary }}>
                  v1.0 (Черновик 1) — 15.03.2026
                </div>
                <div className="text-xs px-2 py-1.5 rounded-md"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                  v2.0 (Черновик 2) — 20.03.2026 [АКТИВЕН]
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4"
              style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}` }}>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={12} style={{ color: '#818cf8' }} />
                <span className="text-xs font-bold" style={{ color: textPrimary }}>The Notes</span>
              </div>
              <button className="w-full text-xs px-2 py-1.5 rounded-md transition-all"
                style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px dashed rgba(99,102,241,0.3)' }}>
                + Новая заметка
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
