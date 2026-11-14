import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUiStore } from '../../store/uiStore'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import { projectService } from '../../services/projectService'
import { useScriptStore } from '../../store/scriptStore'
import { renumberSceneNumbers } from '../../utils/sceneNumbering'
import { useToastStore } from '../../store/toastStore'
import type { ScriptFormat, TimingSystem, Scene } from '../../store/scriptStore'
import type { TimeOfDay } from '../../types/scene'

// Время суток сцены из слова в шапке («НОЧЬ»→NIGHT, «УТРО»→DAWN и т.д.)
const todFromTime = (t: string): TimeOfDay => {
  const u = t.toUpperCase()
  if (/НОЧЬ|NIGHT/.test(u)) return 'NIGHT'
  if (/РАССВЕТ|DAWN|УТРО|MORNING/.test(u)) return 'DAWN'
  if (/ЗАКАТ|ВЕЧЕР|DUSK|EVENING/.test(u)) return 'DUSK'
  if (/НЕПРЕРЫВН|CONTINUOUS/.test(u)) return 'CONTINUOUS'
  return 'DAY'
}

export type ScriptView = 'empty' | 'editor'
export type ScriptTab = 'text' | 'title' | 'cards' | 'development' | 'plan' | 'statistics' | 'breakdown'

export function useScriptPageLogic(opts?: { onBeforeSceneReorder?: (scriptId: string) => void }) {
  const navigate = useNavigate()
  const { theme } = useUiStore()
  const { currentProjectId, projects } = useNormalizedProjectStore()
  const { scripts, currentScriptId, updateScript, setCurrentScript, addScript } = useScriptStore()
  const currentScript = useScriptStore(state =>
    state.scripts.find(s => s.id === state.currentScriptId) || null
  )
  const { showToast } = useToastStore()
  const project = currentProjectId ? projects[currentProjectId] : null
  const isDark = theme === 'dark'

  const [view, setView] = useState<ScriptView>('empty')
  // scenes — только текущего Script'а (серии/фильма)
  const scenes = useMemo(() => currentScript?.scenes || [], [currentScript?.scenes])
  // «Все серии» — режим объединённого навигатора (0), не отдельный скрипт
  const [viewAllSeries, setViewAllSeries] = useState(false)
  // Номер текущей серии из Script.episodeNumber (для фильмов = 1, 0 = «Все серии»)
  const currentSeries = viewAllSeries ? 0 : (currentScript?.episodeNumber || 1)
  // Все Script'ы текущего проекта (для сериалов — с episodeNumber, fallback=1 для старых данных)
  const episodeScripts = useMemo(() => {
    if (!project) return []
    return scripts
      .filter(s => s.projectId === project.id)
      .map(s => ({ ...s, episodeNumber: s.episodeNumber ?? 1 }))
  }, [scripts, project])

  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
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
  const [focusSceneId, setFocusSceneId] = useState<string>()
  const [scriptFormat, setScriptFormat] = useState<ScriptFormat>('russian')
  const [showFormatModal, setShowFormatModal] = useState(false)
  const [showTimingSettingsModal, setShowTimingSettingsModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFormatRef = useRef<ScriptFormat>('russian')
  // 4.1 Ссылка на функцию конвертации внутри редактора
  const convertFormatRef = useRef<((from: ScriptFormat, to: ScriptFormat) => void) | null>(null)
  // Ссылка на функцию перестановки сцен в редакторе
  const reorderEditorRef = useRef<((fromIndex: number, toIndex: number, newNumbers?: Array<{ id: string; number: string }>) => void) | null>(null)
  // Ссылка на функцию получения текста редактора для автоформатирования
  const formatEditorRef = useRef<(() => string) | null>(null)
  // AbortController для отмены устаревших запросов сохранения
  const abortControllerRef = useRef<AbortController | null>(null)
  // Ref для актуальной handleSave — чтобы triggerAutoSave всегда вызывал свежую версию
  const handleSaveRef = useRef<() => void>(() => {})

  // Автосохранение с debounce — ставит 'unsaved' и запускает таймер на 2.5с
  const triggerAutoSave = useCallback(() => {
    setSaveStatus('unsaved')
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveRef.current()
    }, 2500)
  }, [])

  // При получении новых сцен из редактора — синхронизируем со всеми stores
  const handleScenesChange = useCallback((newScenes: Array<{ id: string; number: string; type: string; location: string; sublocation?: string; time: string; cast: string[]; dialogCharacters?: string[]; pages: number; charCount?: number; duration?: number }>) => {
    if (!currentScriptId) return

    // Merge с существующими сценами из scriptStore: сохраняем metadata (synopsis, breakdownElements и т.д.)
    // Сцены из редактора могут иметь ID по номеру (scene-${number}), а в store — UUID.
    // Ищем сначала по ID, затем по номеру, чтобы сохранить стабильный persistent ID.
    const existingById = new Map(currentScript?.scenes.map(s => [s.id, s]) || [])
    const existingByNumber = new Map(currentScript?.scenes.map(s => [s.number, s]) || [])
    const mergedScenes: Scene[] = newScenes.map(s => {
      const existing = existingById.get(s.id) || existingByNumber.get(s.number)
      return {
        id: existing?.id ?? s.id,
        projectId: existing?.projectId || project?.id || '',
        number: s.number,
        type: s.type,
        location: s.location,
        sublocation: s.sublocation,
        timeOfDay: s.time ? todFromTime(s.time) : (existing?.timeOfDay || 'DAY'),
        time: s.time,
        charCount: s.charCount,
        duration: s.duration,
        synopsis: existing?.synopsis || '',
        pages: s.pages,
        cast: s.cast,
        dialogCharacters: s.dialogCharacters || existing?.dialogCharacters || [],
        breakdownElements: existing?.breakdownElements || [],
        colorTag: existing?.colorTag,
        isOmitted: existing?.isOmitted || false,
        order: existing?.order ?? 0,
        isBookmarked: existing?.isBookmarked,
        bookmarkColor: existing?.bookmarkColor,
      } as Scene
    })

    // Удаляем дубликаты по id (на всякий случай) — важно для drag-and-drop
    const dedupedScenes = Array.from(new Map(mergedScenes.map(s => [s.id, s])).values())

    // 1. Синхронизируем scriptStore (единый источник истины)
    useScriptStore.getState().updateScript(currentScriptId, { scenes: dedupedScenes })

    // 2. Синхронизируем нормализованный store
    const pid = currentProjectId ?? project?.id
    if (pid) {
      useNormalizedProjectStore.getState().setScenesBatch(
        dedupedScenes.map(s => ({
          id: s.id,
          projectId: pid,
          number: s.number,
          type: s.type as 'ИНТ' | 'ЭКСТ' | 'ИНТ-ЭКСТ' | 'ПАВ',
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

    // Триггерим автосохранение при изменении сцен
    triggerAutoSave()
  }, [currentScriptId, currentScript?.scenes, project, currentProjectId, scenes, selectedScene, triggerAutoSave])

  // Проверяем, есть ли сценарий для текущего проекта и загружаем его формат
  useEffect(() => {
    if (project) {
      const projectScripts = scripts.filter(s => s.projectId === project.id)
      if (projectScripts.length > 0) {
        const script = projectScripts[0]
        Promise.resolve().then(() => {
          setView('editor')
          if (script.format) {
            setScriptFormat(script.format)
          }
        })
        if (script.format) {
          prevFormatRef.current = script.format
        }
        // Выбираем скрипт текущего проекта если не выбран или выбран чужой
        // (currentScriptId глобален и мог остаться от другого проекта)
        const belongsToProject = currentScriptId && projectScripts.some(s => s.id === currentScriptId)
        if (!belongsToProject) {
          const firstEpisode = projectScripts.find(s => s.episodeNumber === 1) || projectScripts[0]
          setCurrentScript(firstEpisode.id)
        }
      }
    }
  }, [project, scripts, currentScriptId, setCurrentScript])

  // 4.1 Конвертация формата — вызываем функцию из редактора при переключении RU/EN
  const handleFormatSwitch = useCallback((newFormat: ScriptFormat) => {
    if (newFormat === scriptFormat) return
    if (convertFormatRef.current) {
      convertFormatRef.current(prevFormatRef.current, newFormat)
    }
    prevFormatRef.current = newFormat
    setScriptFormat(newFormat)
  }, [scriptFormat])

  // Сохранение сцен (batch) с защитой от повторных запросов
  const handleSave = useCallback(async () => {
    if (isSaving) return
    const pid = currentProjectId ?? project?.id
    if (!pid) return
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsSaving(true)
    setSaveStatus('saving')
    try {
      await projectService.saveScenesBatch(pid, scenes.map(s => ({
        id: s.id,
        projectId: pid,
        number: s.number,
        type: s.type as 'ИНТ' | 'ЭКСТ' | 'ИНТ-ЭКСТ',
        location: s.location,
        time: s.time || '',
        cast: s.cast,
        pages: s.pages,
      })), controller.signal)
      setSaveStatus('saved')
    } catch (error) {
      // Игнорируем ошибки отмены запроса
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setSaveStatus('unsaved')
    } finally {
      setIsSaving(false)
      abortControllerRef.current = null
    }
  }, [isSaving, currentProjectId, project?.id, scenes])
  handleSaveRef.current = handleSave

  // Перестановка сцен из навигатора → scriptStore + редактор
  const handleSceneReorder = useCallback((fromIndex: number, toIndex: number) => {
    // Валидация индексов
    if (scenes.length === 0) return
    if (fromIndex < 0 || fromIndex >= scenes.length) return
    if (toIndex < 0 || toIndex >= scenes.length) return
    if (fromIndex === toIndex) return
    if (!currentScriptId) return

    // Снимок для кнопки «Отменить» на доске — до любых изменений
    opts?.onBeforeSceneReorder?.(currentScriptId)

    // Переставляем сцены в scriptStore (единый источник истины)
    const reordered = [...(currentScript?.scenes || [])]
    const [movedScene] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, movedScene)

    // Перенумеровываем с сохранением литерных суффиксов (1-9-А → 1-6-А и т.п.)
    const newNumbers = renumberSceneNumbers(
      reordered.map((s) => s.number),
      project?.type === 'serial',
      currentScript?.episodeNumber ?? 1,
    )
    const renumberedScenes = reordered.map((scene, index) => ({
      ...scene,
      number: newNumbers[index],
      order: index,
    }))

    // 1. Обновляем scriptStore
    useScriptStore.getState().updateScript(currentScriptId, { scenes: renumberedScenes })

    // 2. Переставляем блоки + перенумеровываем в ОДНОЙ транзакции редактора (T-43):
    //    один Ctrl+Z отменяет и порядок, и номера.
    if (reorderEditorRef.current) {
      reorderEditorRef.current(fromIndex, toIndex, renumberedScenes)
    }
  }, [scenes, currentScriptId, currentScript?.scenes, currentScript?.episodeNumber, project?.type, opts?.onBeforeSceneReorder])

  // Клик по сцене в навигаторе → выделение + скролл редактора
  const handleSceneClick = useCallback((sceneId: string) => {
    const selected = scenes.find(s => s.id === sceneId) || scenes[0]
    setSelectedScene(selected)
    // T-101: фокус по стабильному UUID (data-scene-id), не по номеру
    setFocusSceneId(selected.id)
  }, [scenes])

  // Применение настроек хронометража из модального окна
  const handleApplyTimingSettings = useCallback((timingSystem: TimingSystem, genreCoefficient: string) => {
    if (currentScript) {
      const coefficient = genreCoefficient === 'auto' ? 1.0 : parseFloat(genreCoefficient)
      updateScript(currentScript.id, {
        timingSystem,
        genreCoefficient: coefficient,
      })
    }
    setShowTimingSettingsModal(false)
  }, [currentScript, updateScript])

  // Toggle autoExtractCharacters for current script (per-script, not global)
  const handleToggleAutoExtract = useCallback(() => {
    if (currentScript) {
      updateScript(currentScript.id, {
        autoExtractCharacters: !currentScript.autoExtractCharacters,
      })
    }
  }, [currentScript, updateScript])

  // Переключение серии: поиск или автосоздание скрипта
  const setCurrentSeries = useCallback((series: number) => {
    // «Все серии» — только включаем объединённый вид, скрипт не создаём
    if (series === 0) {
      setViewAllSeries(true)
      return
    }
    setViewAllSeries(false)
    let script = episodeScripts.find(s => s.episodeNumber === series)
    if (!script && project) {
      const newScript = {
        id: crypto.randomUUID(),
        projectId: project.id,
        title: `${project.name} — Серия ${series}`,
        version: 'Черновик v1',
        format: currentScript?.format || 'russian',
        scenes: [],
        characters: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timingSystem: currentScript?.timingSystem || 'page',
        genreCoefficient: currentScript?.genreCoefficient || 1.0,
        fontFamily: currentScript?.fontFamily || 'Courier New',
        fontSize: currentScript?.fontSize || 12,
        autoExtractCharacters: currentScript?.autoExtractCharacters ?? true,
        episodeNumber: series,
      }
      addScript(newScript)
      setCurrentScript(newScript.id)
      return
    }
    if (script) {
      setCurrentScript(script.id)
    }
  }, [episodeScripts, project, currentScript, addScript, setCurrentScript])

  // Все сцены всех серий — каждая помечена своей серией (скрипт-владелец),
  // чтобы фильтры не зависели от формата номера сцены
  const allScenes = useMemo(
    () => episodeScripts.flatMap((s) =>
      (s.scenes || []).map((sc) => ({ ...sc, _episode: s.episodeNumber ?? 1 }) as Scene & { _episode: number })),
    [episodeScripts],
  )

  // Очистка таймаута автосохранения при размонтировании
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  // Цветовая палитра
  const colors = useMemo(() => ({
    bg: isDark ? '#0f0f20' : '#f5f5f5',
    sidebarBg: isDark ? '#13132a' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    textPrimary: isDark ? '#f1f5f9' : '#111827',
    textSecondary: isDark ? '#6b7280' : '#9ca3af',
    textMuted: isDark ? '#374151' : '#d1d5db',
  }), [isDark])

  return {
    // navigation / context
    navigate,
    project,
    isDark,
    colors,
    showToast,
    // script data
    currentScript,
    scenes,
    selectedScene,
    setSelectedScene,
    // view state
    view,
    setView,
    activeTab,
    setActiveTab,
    rightPanelOpen,
    setRightPanelOpen,
    enableAutoFix,
    setEnableAutoFix,
    // series / stats
    currentSeries,
    setCurrentSeries,
    episodeScripts,
    viewAllSeries,
    allScenes,
    targetDuration,
    scriptStats,
    setScriptStats,
    seriesDuration,
    setSeriesDuration,
    seriesPages,
    setSeriesPages,
    setSceneCount,
    focusSceneId,
    // format
    scriptFormat,
    setScriptFormat,
    handleFormatSwitch,
    // modals
    showFormatModal,
    setShowFormatModal,
    showTimingSettingsModal,
    setShowTimingSettingsModal,
    handleApplyTimingSettings,
    handleToggleAutoExtract,
    // save
    isSaving,
    handleSave,
    saveStatus,
    triggerAutoSave,
    // scenes actions
    handleScenesChange,
    handleSceneReorder,
    handleSceneClick,
    // editor refs
    convertFormatRef,
    reorderEditorRef,
    formatEditorRef,
  }
}
