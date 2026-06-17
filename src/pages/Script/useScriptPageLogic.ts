import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUiStore } from '../../store/uiStore'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import { projectService } from '../../services/projectService'
import { useScriptStore } from '../../store/scriptStore'
import { useToastStore } from '../../store/toastStore'
import type { ScriptFormat, TimingSystem, Scene } from '../../store/scriptStore'

export type ScriptView = 'empty' | 'editor'
export type ScriptTab = 'text' | 'title' | 'cards' | 'development' | 'plan' | 'statistics' | 'breakdown'

export function useScriptPageLogic() {
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
  // Номер текущей серии из Script.episodeNumber (для фильмов = 1)
  const currentSeries = currentScript?.episodeNumber || 1
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
  const reorderEditorRef = useRef<((fromIndex: number, toIndex: number) => void) | null>(null)
  // Ссылка на функцию обновления номеров в редакторе
  const updateNumbersRef = useRef<((scenes: Array<{ id: string; number: string }>) => void) | null>(null)
  // AbortController для отмены устаревших запросов сохранения
  const abortControllerRef = useRef<AbortController | null>(null)

  // Автосохранение с debounce — ставит 'unsaved' и запускает таймер на 2.5с
  const triggerAutoSave = useCallback(() => {
    setSaveStatus('unsaved')
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave()
    }, 2500)
  }, [])

  // При получении новых сцен из редактора — синхронизируем со всеми stores
  const handleScenesChange = useCallback((newScenes: Array<{ id: string; number: string; type: string; location: string; sublocation?: string; time: string; cast: string[]; pages: number; charCount?: number; duration?: number }>) => {
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
        sublocation: s.sublocation,
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
        // Устанавливаем currentScriptId если не установлен
        // Для сериалов — выбираем первую серию (episodeNumber=1)
        if (!currentScriptId) {
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

  // Перестановка сцен из навигатора → scriptStore + редактор
  const handleSceneReorder = useCallback((fromIndex: number, toIndex: number) => {
    // Валидация индексов
    if (scenes.length === 0) return
    if (fromIndex < 0 || fromIndex >= scenes.length) return
    if (toIndex < 0 || toIndex >= scenes.length) return
    if (fromIndex === toIndex) return
    if (!currentScriptId) return

    // Переставляем сцены в scriptStore (единый источник истины)
    const reordered = [...(currentScript?.scenes || [])]
    const [movedScene] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, movedScene)

    // Перенумеровываем (номер серии берём из текущего Script'а)
    const seriesPrefix = currentScript?.episodeNumber
    const renumberedScenes = reordered.map((scene, index) => ({
      ...scene,
      number: seriesPrefix ? `${seriesPrefix}-${index + 1}` : (index + 1).toString(),
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
  }, [scenes, currentScriptId, currentScript?.scenes, currentScript?.episodeNumber])

  // Клик по сцене в навигаторе → выделение + скролл редактора
  const handleSceneClick = useCallback((sceneId: string) => {
    const selected = scenes.find(s => s.id === sceneId) || scenes[0]
    setSelectedScene(selected)
    setFocusSceneId(selected.number)
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
    setCurrentSeries: (series: number) => {
      let script = episodeScripts.find(s => s.episodeNumber === series)
      if (!script && project) {
        // Автосоздание скрипта для серии, если его ещё нет
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
          episodeNumber: series,
        }
        addScript(newScript)
        setCurrentScript(newScript.id)
        return
      }
      if (script) {
        setCurrentScript(script.id)
      }
    },
    episodeScripts,
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
    updateNumbersRef,
  }
}
