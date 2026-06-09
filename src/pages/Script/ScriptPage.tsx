import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Upload, Plus, BookOpen, Clock, Hash, AlignLeft, ChevronLeft, Save, Settings, X, ChevronRight, AlertTriangle, Globe, HelpCircle } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import { projectService } from '../../services/projectService'
import { useScriptStore } from '../../store/scriptStore'
import type { ScriptFormat, TimingSystem, Scene } from '../../store/scriptStore'
import { calculateSceneTiming } from '../../utils/sceneTiming'
import ScriptEditorTiptap from '../../components/ScriptEditorTiptap'
import TitlePageEditor from '../../components/TitlePageEditor'
import FormatAssistant from '../../components/FormatAssistant'
import SceneNavigator from '../../components/SceneNavigator'

type ScriptView = 'empty' | 'editor'
type ScriptTab = 'text' | 'title' | 'cards' | 'development' | 'plan' | 'statistics' | 'breakdown'

// При "Написать с нуля" список сцен пустой — сценарист начинает с чистого листа

export default function ScriptPage() {
  const navigate = useNavigate()
  const { theme } = useUiStore()
  const { currentProjectId, projects } = useNormalizedProjectStore()
  const { scripts, currentScriptId, updateScript, setCurrentScript } = useScriptStore()
  const currentScript = useScriptStore(state => 
    state.scripts.find(s => s.id === state.currentScriptId) || null
  )
  const project = currentProjectId ? projects[currentProjectId] : null
  const isDark = theme === 'dark'

  const [currentSeries, setCurrentSeries] = useState(1)
  const [view, setView] = useState<ScriptView>('empty')
  // scenes берутся из scriptStore (единый источник истины), фильтруем по серии
  const allScenes = useMemo(() => currentScript?.scenes || [], [currentScript?.scenes])
  const scenes = useMemo(() => {
    if (project?.type === 'serial' && currentSeries > 0) {
      return allScenes.filter(s => new RegExp(`^${currentSeries}-`).test(s.number))
    }
    return allScenes
  }, [allScenes, project?.type, currentSeries])

  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [importHover, setImportHover] = useState(false)
  const [createHover, setCreateHover] = useState(false)
  const [activeTab, setActiveTab] = useState<ScriptTab>('text')
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [, setSceneCount] = useState(0)
  const [scriptStats, setScriptStats] = useState({ scenes: 0, pages: 0, duration: 0 })
  const [seriesDuration, setSeriesDuration] = useState(0)
  const [seriesPages, setSeriesPages] = useState(0)
  const [enableAutoFix, setEnableAutoFix] = useState(false)

  // Целевой хронометраж из настроек проекта
  const targetDuration = project?.type === 'serial' 
    ? project.episodeDuration 
    : project?.totalDuration
  const [_focusSceneId, setFocusSceneId] = useState<string>()
  const [scriptFormat, setScriptFormat] = useState<ScriptFormat>('russian')
  const [showFormatModal, setShowFormatModal] = useState(false)
  const [showTimingSettingsModal, setShowTimingSettingsModal] = useState(false)
  const [tempTimingSystem, setTempTimingSystem] = useState<TimingSystem>('page')
  const [tempGenreCoefficient, setTempGenreCoefficient] = useState('auto')
  const [tempFormat, setTempFormat] = useState<ScriptFormat>('russian')
  const [isSaving, setIsSaving] = useState(false)
  const prevFormatRef = useRef<ScriptFormat>('russian')
  // 4.1 Ссылка на функцию конвертации внутри редактора
  const convertFormatRef = useRef<((from: ScriptFormat, to: ScriptFormat) => void) | null>(null)
  // Ссылка на функцию перестановки сцен в редакторе
  const reorderEditorRef = useRef<((fromIndex: number, toIndex: number) => void) | null>(null)
  // Ссылка на функцию обновления номеров в редакторе
  const updateNumbersRef = useRef<((scenes: Array<{ id: string; number: string }>) => void) | null>(null)
  // AbortController для отмены устаревших запросов сохранения
  const abortControllerRef = useRef<AbortController | null>(null)

  // При получении новых сцен из редактора — синхронизируем со всеми stores
  const handleScenesChange = useCallback((newScenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number; charCount?: number; duration?: number }>) => {
    if (!currentScriptId) return

    // Merge с существующими сценами из scriptStore: сохраняем metadata (synopsis, breakdownElements и т.д.)
    const existingMap = new Map(currentScript?.scenes.map(s => [s.id, s]) || [])
    const mergedScenes: Scene[] = newScenes.map(s => {
      const existing = existingMap.get(s.id)
      return {
        id: s.id,
        projectId: existing?.projectId || project?.id || '',
        number: s.number,
        type: s.type,
        location: s.location,
        timeOfDay: existing?.timeOfDay || 'DAY',
        time: s.time,
        charCount: s.charCount,
        duration: s.duration,
        synopsis: existing?.synopsis || '',
        pages: s.pages,
        cast: s.cast,
        breakdownElements: existing?.breakdownElements || [],
        scriptText: existing?.scriptText,
        colorTag: existing?.colorTag,
        isOmitted: existing?.isOmitted || false,
        order: existing?.order ?? 0,
        isBookmarked: existing?.isBookmarked,
        bookmarkColor: existing?.bookmarkColor,
      } as Scene
    })

    // 1. Синхронизируем scriptStore (единый источник истины)
    useScriptStore.getState().updateScript(currentScriptId, { scenes: mergedScenes })

    // 2. Синхронизируем нормализованный store
    const pid = currentProjectId ?? project?.id
    if (pid) {
      useNormalizedProjectStore.getState().setScenesBatch(
        mergedScenes.map(s => ({
          id: s.id,
          projectId: pid,
          number: s.number,
          type: s.type as 'ИНТ' | 'ЭКСТ' | 'ИНТ-ЭКСТ',
          location: s.location,
          time: s.time || '',
          cast: s.cast,
          pages: s.pages,
        }))
      )
    }

    // Если selectedScene больше нет — выбираем первую
    if (scenes.length > 0) {
      const stillExists = selectedScene && scenes.find(s => s.id === selectedScene.id)
      if (!stillExists) {
        setSelectedScene(scenes[0])
      }
    } else {
      setSelectedScene(null)
    }
  }, [currentScriptId, currentScript?.scenes, project, currentProjectId, scenes, selectedScene, setSelectedScene])

  // Проверяем, есть ли сценарий для текущего проекта и загружаем его формат
  useEffect(() => {
    if (project) {
      const projectScripts = scripts.filter(s => s.projectId === project.id)
      if (projectScripts.length > 0) {
        const currentScript = projectScripts[0]
        Promise.resolve().then(() => {
          setView('editor')
          if (currentScript.format) {
            setScriptFormat(currentScript.format)
          }
        })
        if (currentScript.format) {
          prevFormatRef.current = currentScript.format
        }
        // Устанавливаем currentScriptId если не установлен
        if (!currentScriptId) {
          setCurrentScript(currentScript.id)
        }
      }
    }
  }, [project, scripts, currentScriptId, setCurrentScript])

  // 4.1 Конвертация формата — вызываем функцию из редактора при переключении RU/EN
  const handleFormatSwitch = (newFormat: ScriptFormat) => {
    if (newFormat === scriptFormat) return
    if (convertFormatRef.current) {
      convertFormatRef.current(prevFormatRef.current, newFormat)
    }
    prevFormatRef.current = newFormat
    setScriptFormat(newFormat)
  }

  const bg = isDark ? '#0f0f20' : '#f5f5f5'
  const sidebarBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'
  const textMuted = isDark ? '#374151' : '#d1d5db'

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
              onClick={() => alert('Функция импорта файлов будет реализована в ближайшем обновлении')}
              onMouseEnter={() => setImportHover(true)}
              onMouseLeave={() => setImportHover(false)}
              className="relative flex flex-col items-start rounded-2xl p-6 text-left transition-all overflow-hidden opacity-60"
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
            
            {/* Переключатель форматов */}
            <div>
              {selectedScene ? (
                <>
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
                    {/* Хронометраж выбранной сцены */}
                    {selectedScene.pages > 0 && (
                      <>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb' }}>·</span>
                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: isDark ? '#10b981' : '#059669' }}>
                          <Clock size={10} />
                          {(() => {
                            const { duration } = calculateSceneTiming(
                              { pages: selectedScene.pages, charCount: selectedScene.charCount },
                              currentScript?.timingSystem || 'page',
                              currentScript?.genreCoefficient || 1.0
                            )
                            return `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
                          })()}
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm" style={{ color: textSecondary }}>
                  Нет сцен — начните писать
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Кнопка Сохранить — подтверждает автосохранение */}
            <button
              onClick={async () => {
                if (isSaving) return
                const pid = currentProjectId ?? project?.id
                if (!pid) return
                // Отменяем предыдущий запрос, если есть
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort()
                }
                // Создаем новый AbortController
                const controller = new AbortController()
                abortControllerRef.current = controller
                setIsSaving(true)
                try {
                  await projectService.saveScenesBatch(pid, scenes.map(s => ({
                    id: s.id,
                    projectId: pid,
                    number: s.number,
                    type: s.type as 'ИНТ' | 'ЭКСТ' | 'ИНТ-ЭКСТ',
                    location: s.location,
                    time: s.time,
                    cast: s.cast,
                    pages: s.pages,
                  })), controller.signal)
                } catch (error) {
                  // Игнорируем ошибки отмены запроса
                  if (error instanceof DOMException && error.name === 'AbortError') {
                    return
                  }
                } finally {
                  setIsSaving(false)
                  abortControllerRef.current = null
                }
              }}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.3)',
              }}
              onMouseEnter={e => { if (!isSaving) (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.25)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)' }}
            >
              <Save size={13} />
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            {/* Кнопка Настройки — открывает модальное окно */}
            <button
              onClick={() => {
                setTempTimingSystem(currentScript?.timingSystem || 'page')
                setTempGenreCoefficient(currentScript?.genreCoefficient === 1.0 ? 'auto' : currentScript?.genreCoefficient?.toString() || 'auto')
                setTempFormat(scriptFormat)
                setShowTimingSettingsModal(true)
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ color: textSecondary }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              title="Настройки хронометража"
            >
              <Settings size={15} />
            </button>
            {/* Кнопка Помощь — заглушка, потом мини-обучение */}
            <button
              onClick={() => alert('Мини-обучение: горячие клавиши и справка по модулю сценария будет реализовано позже')}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ color: textSecondary }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              title="Помощь"
            >
              <HelpCircle size={15} />
            </button>
            {/* Кнопка Format Assistant */}
            <button
              onClick={() => setEnableAutoFix(!enableAutoFix)}
              className="w-8 h-8 rounded-lg flex items-center justify-center relative"
              style={{ 
                color: enableAutoFix ? '#818cf8' : textSecondary,
                background: enableAutoFix ? 'rgba(99,102,241,0.15)' : 'transparent',
              }}
              onMouseEnter={e => !enableAutoFix && ((e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6')}
              onMouseLeave={e => !enableAutoFix && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              title="Проверка форматирования"
            >
              <AlertTriangle size={15} />
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

        {/* Вкладки редактора — стильный контейнер */}
        <div className="shrink-0 px-6 py-3 border-b"
          style={{ background: isDark ? 'rgba(15,15,26,0.8)' : 'rgba(248,250,252,0.9)', borderColor: border }}>
          <div className="flex items-center gap-1 p-1 rounded-xl"
            style={{ 
              background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
              boxShadow: isDark ? 'inset 0 2px 4px rgba(0,0,0,0.4)' : 'inset 0 2px 4px rgba(0,0,0,0.06)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              width: 'fit-content'
            }}>
            {[
              { id: 'text' as ScriptTab, label: 'ТЕКСТ', icon: FileText },
              { id: 'title' as ScriptTab, label: 'ТИТУЛ', icon: BookOpen },
              { id: 'breakdown' as ScriptTab, label: 'РАЗБИВКА', icon: Hash },
              { id: 'cards' as ScriptTab, label: 'КАРТОЧКИ', icon: Hash },
              { id: 'development' as ScriptTab, label: 'РАЗРАБОТКА', icon: Settings },
              { id: 'plan' as ScriptTab, label: 'ПЛАН', icon: Clock },
              { id: 'statistics' as ScriptTab, label: 'СТАТИСТИКА', icon: AlignLeft },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 relative"
                  style={{
                    background: isActive 
                      ? (isDark ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.95)') 
                      : 'transparent',
                    color: isActive 
                      ? '#ffffff' 
                      : (isDark ? '#9ca3af' : '#64748b'),
                    boxShadow: isActive 
                      ? (isDark ? '0 2px 8px rgba(99,102,241,0.4)' : '0 2px 8px rgba(99,102,241,0.3)') 
                      : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                      ;(e.currentTarget as HTMLElement).style.color = isDark ? '#d1d5db' : '#374151'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = isDark ? '#9ca3af' : '#64748b'
                    }
                  }}
                >
                  <Icon size={12} style={{ opacity: isActive ? 1 : 0.7 }} />
                  <span style={{ letterSpacing: '0.02em' }}>{tab.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/50" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Область контента по вкладкам */}
        {activeTab === 'title' ? (
          <TitlePageEditor 
            isDark={isDark}
            scriptTitle={project?.name}
          />
        ) : ['breakdown', 'cards', 'development', 'plan', 'statistics'].includes(activeTab) ? (
          <div className="flex-1 flex items-center justify-center" style={{ background: bg }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)' }}>
                <Settings size={32} style={{ color: isDark ? '#818cf8' : '#6366f1' }} />
              </div>
              <p className="text-lg font-medium mb-2" style={{ color: textPrimary }}>
                В разработке
              </p>
              <p className="text-sm" style={{ color: textSecondary }}>
                Этот раздел появится в будущих обновлениях
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Навигатор сцен — слева */}
            <SceneNavigator
              scenes={scenes.map(s => ({
                id: s.id,
                number: s.number,
                type: s.type,
                location: s.location,
                time: s.time,
                pages: s.pages || 0,
                charCount: s.charCount,
                cast: s.cast,
              }))}
              isDark={isDark}
              timingSystem={currentScript?.timingSystem || 'page'}
              genreCoefficient={currentScript?.genreCoefficient || 1.0}
              currentSeries={currentSeries}
              episodeDuration={targetDuration}
              isSerial={project?.type === 'serial'}
              episodesCount={project?.episodesCount || 8}
              onSeriesChange={setCurrentSeries}
              onSeriesDurationChange={setSeriesDuration}
              onSeriesPagesChange={setSeriesPages}
              onSceneClick={(sceneId) => {
                const selected = scenes.find(s => s.id === sceneId) || scenes[0]
                setSelectedScene(selected)
                setFocusSceneId(selected.number)
              }}
              onSceneReorder={(fromIndex, toIndex) => {
                // Валидация индексов
                if (scenes.length === 0) return
                if (fromIndex < 0 || fromIndex >= scenes.length) return
                if (toIndex < 0 || toIndex >= scenes.length) return
                if (fromIndex === toIndex) return
                if (!currentScriptId) return

                // Переставляем сцены в scriptStore (единый источник истины)
                const allScenes = [...(currentScript?.scenes || [])]
                const [movedScene] = allScenes.splice(fromIndex, 1)
                allScenes.splice(toIndex, 0, movedScene)

                // Перенумеровываем
                const isSerial = project?.type === 'serial' && currentSeries > 0
                const seriesNumber = currentSeries
                const renumberedScenes = allScenes.map((scene, index) => ({
                  ...scene,
                  number: isSerial ? `${seriesNumber}-${index + 1}` : (index + 1).toString(),
                  order: index,
                }))

                // 1. Обновляем scriptStore
                useScriptStore.getState().updateScript(currentScriptId, { scenes: renumberedScenes })

                // 2. Переставляем блоки в редакторе
                if (reorderEditorRef.current) {
                  reorderEditorRef.current(fromIndex, toIndex)
                }

                // 3. Обновляем номера в редакторе
                setTimeout(() => {
                  if (updateNumbersRef.current) {
                    updateNumbersRef.current(renumberedScenes)
                  }
                }, 200)
              }}
              activeSceneId={selectedScene?.id || ''}
            />
            
            {/* Редактор — справа */}
            <div className="flex-1 h-full">
              <ScriptEditorTiptap
                format={scriptFormat}
                projectType={project?.type || 'film'}
                projectId={project?.id}
                currentSeries={currentSeries}
                fontFamily="Courier New"
                fontSize={12}
                isDark={isDark}
                genreCoefficient={currentScript?.genreCoefficient || 1.0}
                timingSystem={currentScript?.timingSystem || 'page'}
                onSceneCountChange={setSceneCount}
                onStatsChange={setScriptStats}
                onScenesChange={handleScenesChange}
                focusSceneId={_focusSceneId}
                onConvertReady={(fn) => { convertFormatRef.current = fn }}
                onReorderReady={(reorderFn) => { reorderEditorRef.current = reorderFn }}
                onUpdateNumbersReady={(updateFn) => { updateNumbersRef.current = updateFn }}
              />
            </div>
          </div>
        )}

        {/* Статусбар внизу — только для текстового редактора */}
        {activeTab === 'text' && (
          <div className="shrink-0 flex items-center gap-6 px-6 py-2 border-t"
            style={{ background: sidebarBg, borderColor: border }}>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
              <Hash size={11} />
              {scriptStats.scenes} сцен
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
              <AlignLeft size={11} />
              {seriesPages.toFixed(1)} стр.
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
              <Clock size={11} />
              {Math.floor(seriesDuration / 60)}:{(seriesDuration % 60).toString().padStart(2, '0')}
            </span>

            {/* Прогресс-бар хронометража серии (из навигатора — единый источник) */}
            {targetDuration && (
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium" style={{ color: textSecondary }}>
                      Хронометраж
                    </span>
                    <span className="text-[10px] font-semibold" style={{
                      color: seriesDuration / 60 > targetDuration ? '#ef4444' : textPrimary
                    }}>
                      {Math.min(100, Math.round((seriesDuration / 60 / targetDuration) * 100))}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, (seriesDuration / 60 / targetDuration) * 100)}%`,
                        background: seriesDuration / 60 > targetDuration
                          ? 'linear-gradient(90deg, #ef4444, #f87171)'
                          : 'linear-gradient(90deg, #10b981, #34d399)'
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] shrink-0">
                  <span style={{ color: textSecondary }}>
                    {Math.floor(seriesDuration / 60)}:{(seriesDuration % 60).toString().padStart(2, '0')} / {targetDuration}:00
                  </span>
                  {Math.abs(Math.round(seriesDuration / 60) - targetDuration) > 0 && (
                    <span style={{
                      color: seriesDuration / 60 > targetDuration ? '#ef4444' : '#10b981',
                      fontWeight: 500
                    }}>
                      {seriesDuration / 60 > targetDuration && <AlertTriangle size={10} className="inline mr-0.5" />}
                      ({seriesDuration / 60 > targetDuration ? '+' : ''}{Math.round(seriesDuration / 60) - targetDuration})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Format Assistant — панель проверки форматирования */}
        {activeTab === 'text' && (
          <FormatAssistant
            blocks={[]}
            format={scriptFormat === 'custom' ? 'russian' : scriptFormat}
            isDark={isDark}
            enableAutoFix={enableAutoFix}
          />
        )}
      </div>

      {/* ── Правая панель: заметки / версии — В РАЗРАБОТКЕ ───────────────────── */}
      {rightPanelOpen && (
        <div className="shrink-0 flex flex-col border-l overflow-hidden"
          style={{ width: 300, background: sidebarBg, borderColor: border }}>
          
          {/* Заглушка */}
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)' }}>
                <Settings size={24} style={{ color: isDark ? '#818cf8' : '#6366f1' }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>
                Заметки к сцене
              </p>
              <p className="text-xs" style={{ color: textSecondary }}>
                В разработке
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно выбора формата сценария */}
      {showFormatModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="max-w-md w-full mx-4 p-8 rounded-2xl"
            style={{ background: isDark ? '#1a1a35' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: textPrimary }}>Выберите формат сценария</h3>
            <p className="text-sm mb-6" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              Формат будет применён ко всему сценарию. Его можно изменить позже.
            </p>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  setScriptFormat('russian')
                  setShowFormatModal(false)
                  navigate(`/project/${project?.id}/script/create`)
                }}
                className="w-full p-4 rounded-xl text-left transition-all"
                style={{
                  background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Globe size={20} style={{ color: '#818cf8' }} />
                  <span className="font-bold" style={{ color: textPrimary }}>Российский формат</span>
                </div>
                <p className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                  1. ИНТ. КУХНЯ — ДЕНЬ<br />
                  Автонумерация сцен, кириллица
                </p>
              </button>
              
              <button
                onClick={() => {
                  setScriptFormat('hollywood')
                  setShowFormatModal(false)
                  navigate(`/project/${project?.id}/script/create`)
                }}
                className="w-full p-4 rounded-xl text-left transition-all"
                style={{
                  background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)',
                  border: '1px solid rgba(34,197,94,0.25)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Globe size={20} style={{ color: '#22c55e' }} />
                  <span className="font-bold" style={{ color: textPrimary }}>Голливудский формат</span>
                </div>
                <p className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                  INT. KITCHEN - DAY<br />
                  Международный стандарт, латиница
                </p>
              </button>
            </div>
            
            <button
              onClick={() => setShowFormatModal(false)}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: textSecondary }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно настроек хронометража */}
      {showTimingSettingsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="max-w-md w-full mx-4 p-6 rounded-2xl"
            style={{ background: isDark ? '#1a1a35' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: textPrimary }}>Настройки сценария</h3>
              <button
                onClick={() => setShowTimingSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: textSecondary }}
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Переключатель языка формата */}
            <div className="mb-4 p-3 rounded-xl"
              style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
              <label className="text-xs font-medium mb-2 block" style={{ color: textPrimary }}>
                Формат сценария
              </label>
              <div className="flex items-center gap-1 p-1 rounded-lg"
                style={{ background: isDark ? 'rgba(0,0,0,0.3)' : '#e5e7eb' }}>
                <button
                  onClick={() => {
                    setTempFormat('russian')
                    handleFormatSwitch('russian')
                  }}
                  className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: tempFormat === 'russian' 
                      ? (isDark ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.95)') 
                      : 'transparent',
                    color: tempFormat === 'russian' ? '#ffffff' : (isDark ? '#9ca3af' : '#64748b'),
                    boxShadow: tempFormat === 'russian' ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                  }}
                >
                  🇷🇺 Русский (RU)
                </button>
                <button
                  onClick={() => {
                    setTempFormat('hollywood')
                    handleFormatSwitch('hollywood')
                  }}
                  className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: tempFormat === 'hollywood' 
                      ? (isDark ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.95)') 
                      : 'transparent',
                    color: tempFormat === 'hollywood' ? '#ffffff' : (isDark ? '#9ca3af' : '#64748b'),
                    boxShadow: tempFormat === 'hollywood' ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                  }}
                >
                  🇺🇸 Hollywood (EN)
                </button>
              </div>
              <p className="text-[10px] mt-2" style={{ color: textSecondary }}>
                Переключает форматирование сценария между русским и голливудским стандартом
              </p>
            </div>
            
            <p className="text-sm mb-4" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              Выберите систему расчёта хронометража для сценария.
            </p>
            
            {/* Система хронометража */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: textPrimary }}>
                Система расчёта
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'page' as TimingSystem, label: 'Постраничный', tooltip: '1 страница = 55 секунд' },
                  { value: 'character' as TimingSystem, label: 'Посимвольный', tooltip: '1 символ = 0.05 секунды' },
                  { value: 'flexible' as TimingSystem, label: 'Гибкий', tooltip: 'Страницы + диалоги' },
                  { value: 'manual' as TimingSystem, label: 'Ручной', tooltip: 'Установка вручную' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTempTimingSystem(option.value)}
                    className="p-3 rounded-lg text-left transition-all text-xs"
                    style={{
                      background: tempTimingSystem === option.value ? 'rgba(99,102,241,0.15)' : isDark ? 'rgba(255,255,255,0.03)' : '#f3f4f6',
                      border: `1px solid ${tempTimingSystem === option.value ? 'rgba(99,102,241,0.3)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      color: tempTimingSystem === option.value ? '#818cf8' : textPrimary,
                    }}
                    title={option.tooltip}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-[10px] mt-1" style={{ color: textSecondary }}>
                      {option.tooltip}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Жанровый коэффициент */}
            <div className="mb-6">
              <label className="text-xs font-medium mb-2 block" style={{ color: textPrimary }}>
                Жанровый коэффициент
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'auto', label: 'Авто (1.0)' },
                  { value: '0.9', label: '0.9 (Мюзикл)' },
                  { value: '1.15', label: '1.15 (Комедия)' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTempGenreCoefficient(option.value)}
                    className="p-2 rounded-lg text-center transition-all text-xs"
                    style={{
                      background: tempGenreCoefficient === option.value ? 'rgba(99,102,241,0.15)' : isDark ? 'rgba(255,255,255,0.03)' : '#f3f4f6',
                      border: `1px solid ${tempGenreCoefficient === option.value ? 'rgba(99,102,241,0.3)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      color: tempGenreCoefficient === option.value ? '#818cf8' : textPrimary,
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowTimingSettingsModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: textSecondary }}
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  // Сохраняем настройки в текущий сценарий
                  if (currentScript) {
                    const coefficient = tempGenreCoefficient === 'auto' ? 1.0 : parseFloat(tempGenreCoefficient)
                    updateScript(currentScript.id, {
                      timingSystem: tempTimingSystem,
                      genreCoefficient: coefficient,
                    })
                  }
                  setShowTimingSettingsModal(false)
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
