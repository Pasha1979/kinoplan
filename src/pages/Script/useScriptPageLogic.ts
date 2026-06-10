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
  const { scripts, currentScriptId, updateScript, setCurrentScript } = useScriptStore()
  const currentScript = useScriptStore(state =>
    state.scripts.find(s => s.id === state.currentScriptId) || null
  )
  const { showToast } = useToastStore()
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
  }, [currentScriptId, currentScript?.scenes, project, currentProjectId, scenes, selectedScene])

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
        if (!currentScriptId) {
          setCurrentScript(script.id)
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
    } catch (error) {
      // Игнорируем ошибки отмены запроса
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
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

    // Перенумеровываем
    const isSerial = project?.type === 'serial' && currentSeries > 0
    const renumberedScenes = reordered.map((scene, index) => ({
      ...scene,
      number: isSerial ? `${currentSeries}-${index + 1}` : (index + 1).toString(),
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
  }, [scenes, currentScriptId, currentScript?.scenes, project?.type, currentSeries])

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
