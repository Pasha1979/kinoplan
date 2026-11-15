import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useScriptPageLogic } from './useScriptPageLogic'
import { useScriptStore, type TitlePage } from '../../store/scriptStore'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import ScriptEmptyState from './components/ScriptEmptyState'
import ScriptHeader from './components/ScriptHeader'
import ExportModal from './components/ExportModal'
import ScriptTabs from './components/ScriptTabs'
import ScriptStatusBar from './components/ScriptStatusBar'
import FormatSelectModal from './components/FormatSelectModal'
import TimingSettingsModal from './components/TimingSettingsModal'
import TitlePageEditor from '../../components/TitlePageEditor'
import ScriptRightPanel, { type ValidationIssue } from './components/ScriptRightPanel'
import StatisticsView from './components/StatisticsView'
import CardsView from './components/CardsView'
import DevelopmentView from './components/DevelopmentView'
import SceneEditModal from './components/SceneEditModal'
import { spliceSceneHtml } from './components/SceneEditModal'
import { extractSceneHtml, insertSceneHtml, renumberHeaders, replaceSceneInEditor, setEditorContentNoHistory } from './components/sceneHtmlOps'
import { restoreMove, renumberScenesArr, type BoardUndoEntry } from './components/boardUndo'
import type { Scene } from '../../types/scene'
import SceneNavigator from '../../components/SceneNavigator'
import ScriptEditorTiptap from '../../components/ScriptEditorTiptap'
import { extractBlocksFromHtml, type FormatBlock } from '../../utils/formatBlockExtractor'
import { isBuiltinStatus, reassignSceneStatus } from '../../utils/draftStatus'
import { Settings } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import SearchBar from '../../components/SearchBar'
import { useScriptSearch } from '../../hooks/useScriptSearch'
import HelpModal from '../../components/HelpModal'
import FocusModeOverlay from '../../components/FocusModeOverlay'
import { useFocusMode } from '../../hooks/useFocusMode'
import { useSplitScreen } from '../../hooks/useSplitScreen'
import { useDialogueMode } from '../../hooks/useDialogueMode'
import DialogueCharacterPicker from '../../components/DialogueCharacterPicker'
import FormatModal from './components/FormatModal'
import ScriptBreakdown from '../../components/ScriptBreakdown'
import { browserFS } from '../../adapters/BrowserFS'
import { docxToScreenplayHtml, DocxImportError } from '../../services/docxImportService'
import { saveScriptContent } from '../../services/storageService'

export default function ScriptPage() {
  // Мост к pushUndo: навигатор сцен сообщает о перестановке до её выполнения
  const beforeSceneReorderRef = useRef<(scriptId: string, fromIndex: number, toIndex: number) => void>(() => {})
  const logic = useScriptPageLogic({
    onBeforeSceneReorder: useCallback((id: string, from: number, to: number) => beforeSceneReorderRef.current(id, from, to), []),
  })
  const formatLocked = useScriptStore((s) => s.formatLocked)
  const toggleFormatLock = useScriptStore((s) => s.toggleFormatLock)
  const {
    navigate,
    project,
    isDark,
    colors,
    showToast,
    // view
    view,
    setView,
    // script data
    currentScript,
    scenes,
    selectedScene,
    setSelectedScene,
    // tabs
    activeTab,
    setActiveTab,
    // editor state
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
    // episode scripts (для сериалов)
    episodeScripts,
    viewAllSeries,
    allScenes,
    // scenes
    handleScenesChange,
    handleSceneReorder,
    handleSceneClick,
    // refs
    convertFormatRef,
    reorderEditorRef,
    formatEditorRef,
  } = logic

  const updateScript = useScriptStore((s) => s.updateScript)
  // T-97: ошибки ленивой загрузки контента — гейт «Повторить» вместо пустого редактора
  const contentErrors = useScriptStore((s) => s.contentErrors)

  // T-35: контент сценариев хранится отдельными документами — подгружаем лениво
  const episodeIds = episodeScripts.map((s) => s.id).join(',')
  useEffect(() => {
    episodeScripts.forEach((s) => { void useScriptStore.getState().ensureContentLoaded(s.id) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeIds])

  // Поиск по сценарию
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
  const search = useScriptSearch(editorInstance)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showAutoFormatModal, setShowAutoFormatModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [formatRawText, setFormatRawText] = useState('')
  const focusMode = useFocusMode()
  const splitScreen = useSplitScreen(currentSeries)
  const dialogueMode = useDialogueMode(scenes)

  // Контент и projectId для правой панели (по выбранной серии)
  const rightScript = episodeScripts.find(s => s.episodeNumber === splitScreen.rightSeries)
    ?? episodeScripts.find(s => s.episodeNumber === 1)
    ?? currentScript

  // Навигация по сцене: в режиме split — направляем в активную панель,
  // иначе — стандартное поведение через оригинальный хендлер
  const handleSceneClickRouted = useCallback((sceneId: string) => {
    if (splitScreen.isActive) {
      splitScreen.navigateToScene(sceneId)
    } else {
      // Режим «Все серии»: сцена может принадлежать другому скрипту —
      // сначала переключаемся на него, потом фокусируемся
      if (viewAllSeries) {
        const owner = episodeScripts.find((ep) => ep.scenes?.some((sc) => sc.id === sceneId))
        if (owner && owner.id !== currentScript?.id) {
          useScriptStore.getState().setCurrentScript(owner.id)
        }
      }
      handleSceneClick(sceneId)
    }
  }, [splitScreen.isActive, splitScreen.navigateToScene, handleSceneClick, viewAllSeries, episodeScripts, currentScript?.id])

  // Обновление полей сцены (синопсис, статус, заметки, colorTag) — пишем
  // в скрипт-владелец, работает и для серий, которые сейчас не открыты
  const handleUpdateScene = useCallback((sceneId: string, patch: Partial<Scene>) => {
    const owner = episodeScripts.find((ep) => ep.scenes?.some((s) => s.id === sceneId))
    if (!owner) return
    updateScript(owner.id, {
      scenes: owner.scenes!.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
    })
  }, [episodeScripts, updateScript])

  // T-122: удаление своего статуса — сначала чистим/переводим draftStatus у сцен
  // ВО ВСЕХ сериях (статусы проект-широкие), затем убираем статус из проекта.
  // Осиротевших ссылок не остаётся.
  const handleDeleteDraftStatus = useCallback((statusId: string, replacementId?: string) => {
    if (!project || isBuiltinStatus(statusId)) return
    for (const ep of episodeScripts) {
      if (ep.scenes?.some((s) => s.draftStatus === statusId)) {
        updateScript(ep.id, { scenes: reassignSceneStatus(ep.scenes, statusId, replacementId) })
      }
    }
    useNormalizedProjectStore.getState().updateProject(project.id, {
      draftStatuses: (project.draftStatuses ?? []).filter((d) => d.id !== statusId),
    })
  }, [project, episodeScripts, updateScript])

  // T-108 мостик: элемент разбивки → персонажи/локации Разработки (без дублей по имени)
  const handleSendToDevelopment = useCallback((el: { category: string; name: string; sceneIds: string[] }) => {
    if (!project) return
    const dev = project.development ?? { characters: [], locations: [], synopsis: {} }
    if (el.category === 'cast') {
      if (dev.characters.some((c) => c.name === el.name)) {
        showToast(`«${el.name}» уже в кастинге`, 'info')
        return
      }
      useNormalizedProjectStore.getState().updateProject(project.id, {
        development: {
          ...dev,
          characters: [...dev.characters, {
            id: crypto.randomUUID(), name: el.name, type: 'secondary', sceneIds: el.sceneIds,
          }],
        },
      })
      showToast(`«${el.name}» → персонажи Разработки`, 'success')
    } else if (el.category === 'locations') {
      if (dev.locations.some((l) => l.name === el.name)) {
        showToast(`«${el.name}» уже в локациях`, 'info')
        return
      }
      useNormalizedProjectStore.getState().updateProject(project.id, {
        development: {
          ...dev,
          locations: [...dev.locations, {
            id: crypto.randomUUID(), name: el.name, sceneIds: el.sceneIds,
          }],
        },
      })
      showToast(`«${el.name}» → локации Разработки`, 'success')
    }
  }, [project, showToast])

  // Одиночный редактор сцены («Перейти к сцене» из карточки)
  const [editScene, setEditScene] = useState<Scene | null>(null)
  const editSceneOwner = editScene ? episodeScripts.find((ep) => ep.scenes?.some((s) => s.id === editScene.id)) : undefined
  const editSceneIndex = editScene && editSceneOwner ? editSceneOwner.scenes!.findIndex((s) => s.id === editScene.id) : -1

  // ── UNDO-стек доски (T-107): фрагментные записи вместо копий полного content.
  // meta — патч полей без контента; reorder — обратная перестановка;
  // move — исходные позиции сцен (HTML не хранится — фрагменты живут в контенте).
  // Стеки разведены: контент-записи доски идут через setEditorContentNoHistory,
  // поэтому Ctrl+Z в редакторе не трогает операции доски и наоборот.
  const undoStack = useRef<BoardUndoEntry[]>([])
  const isUndoingRef = useRef(false)
  const [undoCount, setUndoCount] = useState(0)
  const pushUndo = useCallback((entry: BoardUndoEntry) => {
    if (isUndoingRef.current) return
    undoStack.current.push(entry)
    if (undoStack.current.length > 15) undoStack.current.shift()
    setUndoCount(undoStack.current.length)
  }, [])
  // Навигатор сцен → undo-стек доски (запись «до» перестановки)
  useEffect(() => {
    beforeSceneReorderRef.current = (scriptId: string, fromIndex: number, toIndex: number) =>
      pushUndo({ kind: 'reorder', scriptId, fromIndex, toIndex })
  }, [pushUndo])
  const handleUndo = useCallback(() => {
    const entry = undoStack.current.pop()
    if (!entry) return
    isUndoingRef.current = true
    try {
      if (entry.kind === 'meta') {
        updateScript(entry.scriptId, entry.patch)
      } else if (entry.kind === 'reorder') {
        // обратная перестановка — через тот же путь (стор + PM-транзакция)
        handleSceneReorder(entry.toIndex, entry.fromIndex)
      } else {
        // move: вернуть сцены на исходные позиции — фрагменты из живого контента
        const home = useScriptStore.getState().scripts.find((s) => s.id === entry.toScriptId)
        const dest = useScriptStore.getState().scripts.find((s) => s.id === entry.fromScriptId)
        if (home && dest) {
          const r = restoreMove(home, dest, entry.items, project?.type === 'serial')
          updateScript(home.id, { content: r.homeContent, scenes: r.homeScenes })
          if (home.id === currentScript?.id && editorInstance) setEditorContentNoHistory(editorInstance, r.homeContent)
          if (r.destContent !== null && r.destScenes) {
            updateScript(dest.id, { content: r.destContent, scenes: r.destScenes })
            if (dest.id === currentScript?.id && editorInstance) setEditorContentNoHistory(editorInstance, r.destContent)
          }
        }
      }
    } finally {
      isUndoingRef.current = false
    }
    setUndoCount(undoStack.current.length)
  }, [project?.type, currentScript?.id, editorInstance, updateScript, handleSceneReorder])

  // Перенос сцен drag&drop: внутри серии ИЛИ между скриптами-сериями.
  // Вырезает HTML-фрагменты по номерам шапок, вставляет в цель, перенумеровывает.
  const handleMoveScenes = useCallback((sceneIds: string[], toEpisode: number, toIndex: number) => {
    const isSerial = project?.type === 'serial'
    const from = episodeScripts.find((ep) => ep.scenes?.some((s) => sceneIds.includes(s.id)))
    const to = episodeScripts.find((ep) => (ep.episodeNumber ?? 1) === toEpisode)
    if (!from || !to) return
    // все переносимые сцены должны быть из одного скрипта
    if (!sceneIds.every((id) => from.scenes!.some((s) => s.id === id))) return

    // T-107: фрагментная запись — исходные позиции сцен, без копии контента
    const items = sceneIds.map((sceneId) => ({
      sceneId,
      index: from.scenes!.findIndex((s) => s.id === sceneId),
    }))
    pushUndo({ kind: 'move', fromScriptId: from.id, toScriptId: to.id, items })
    const fromEp = from.episodeNumber ?? 1
    const moving = sceneIds.map((id) => from.scenes!.find((s) => s.id === id)!)
    const frags = moving.map((s) => extractSceneHtml(from.content || '', s.number, 0, s.id)).join('')
    const movedSet = new Set(sceneIds)

    const renum = (arr: typeof from.scenes, ep: number) => renumberScenesArr(arr || [], ep, isSerial)

    if (from.id === to.id) {
      // тот же скрипт: вырезать → вставить внутрь с поправкой индекса
      const firstIdx = from.scenes!.findIndex((s) => movedSet.has(s.id))
      const insertIdx = firstIdx < toIndex ? Math.max(0, toIndex - sceneIds.length) : toIndex
      let content = from.content || ''
      moving.forEach((s) => { content = spliceSceneHtml(content, s.number, 0, '', s.id) })
      content = insertSceneHtml(content, frags, insertIdx)
      content = renumberHeaders(content, toEpisode, isSerial)
      const arr = from.scenes!.filter((s) => !movedSet.has(s.id))
      arr.splice(insertIdx, 0, ...moving)
      updateScript(from.id, { content, scenes: renum(arr, toEpisode) })
      // T-107: запись вне PM-истории — Ctrl+Z редактора не трогает операции доски
      if (from.id === currentScript?.id && editorInstance) setEditorContentNoHistory(editorInstance, content)
      return
    }

    // разные скрипты: из источника вырезать+перенумеровать, в цель вставить+перенумеровать
    let fromContent = from.content || ''
    moving.forEach((s) => { fromContent = spliceSceneHtml(fromContent, s.number, 0, '', s.id) })
    fromContent = renumberHeaders(fromContent, fromEp, isSerial)
    const toContent = renumberHeaders(insertSceneHtml(to.content || '', frags, toIndex), toEpisode, isSerial)

    const fromScenes = renum(from.scenes!.filter((s) => !movedSet.has(s.id)), fromEp)
    const toArr = [...(to.scenes || [])]
    toArr.splice(toIndex, 0, ...moving)
    const toScenes = renum(toArr, toEpisode)

    updateScript(from.id, { content: fromContent, scenes: fromScenes })
    updateScript(to.id, { content: toContent, scenes: toScenes })
    if (from.id === currentScript?.id && editorInstance) setEditorContentNoHistory(editorInstance, fromContent)
    if (to.id === currentScript?.id && editorInstance) setEditorContentNoHistory(editorInstance, toContent)
  }, [episodeScripts, project?.type, currentScript?.id, editorInstance, updateScript, pushUndo])
  // Контент скриптов по сериям — для встроенного просмотра сцены в модале карточек
  const contentByEp = useMemo(
    () => Object.fromEntries(episodeScripts.map((ep) => [ep.episodeNumber ?? 1, ep.content || ''])),
    [episodeScripts],
  )
  // Маркеры актов по сериям — для линий-разделителей на доске карточек
  const actMarkersByEp = useMemo(
    () => Object.fromEntries(
      episodeScripts.map((ep) => [ep.episodeNumber ?? 1, (ep.actMarkers || {}) as Record<string, string>]),
    ),
    [episodeScripts],
  )
  const handleMarkerSet = useCallback((key: string, sceneId: string, episode: number) => {
    const owner = episodeScripts.find((ep) => (ep.episodeNumber ?? 1) === episode)
    if (!owner) return
    pushUndo({ kind: 'meta', scriptId: owner.id, patch: { actMarkers: owner.actMarkers } })
    updateScript(owner.id, { actMarkers: { ...(owner.actMarkers || {}), [key]: sceneId } })
  }, [episodeScripts, updateScript, pushUndo])

  // Группы карточек по сериям (фаза 5)
  // На одну серию может быть несколько скриптов (версии) — объединяем группы,
  // иначе Object.fromEntries затирает группы более поздними пустыми скриптами
  const sceneGroupsByEp = useMemo(() => {
    const out: Record<number, import('../../types/scene').SceneGroup[]> = {}
    episodeScripts.forEach((ep) => {
      const n = ep.episodeNumber ?? 1
      out[n] = [...(out[n] || []), ...(ep.sceneGroups || [])]
    })
    return out
  }, [episodeScripts])
  const handleGroupsChange = useCallback((episode: number, groups: import('../../types/scene').SceneGroup[]) => {
    // Владелец — скрипт серии, которому принадлежат сцены группы (не первый по номеру!)
    const allIds = new Set(groups.flatMap((g) => g.sceneIds))
    const owner = episodeScripts.find((ep) =>
      (ep.episodeNumber ?? 1) === episode && (ep.scenes || []).some((sc) => allIds.has(sc.id)),
    ) || episodeScripts.find((ep) => (ep.episodeNumber ?? 1) === episode)
    if (owner) { pushUndo({ kind: 'meta', scriptId: owner.id, patch: { sceneGroups: owner.sceneGroups } }); updateScript(owner.id, { sceneGroups: groups }) }
  }, [episodeScripts, updateScript, pushUndo])

  // Связи между сценами (фаза 6) — плоский список, может пересекать серии.
  // Мержим со всех версий скриптов с дедупликацией по id (как группы).
  const sceneLinks = useMemo(() => {
    const seen = new Set<string>()
    return episodeScripts.flatMap((ep) => ep.sceneLinks || []).filter((l) => {
      if (seen.has(l.id)) return false
      seen.add(l.id); return true
    })
  }, [episodeScripts])
  const handleLinksChange = useCallback((links: import('../../types/scene').SceneLink[]) => {
    // Владелец — скрипт, содержащий сцены-связи; иначе первый
    const ids = new Set(links.flatMap((l) => [l.from, l.to]))
    const owner = episodeScripts.find((ep) => (ep.scenes || []).some((sc) => ids.has(sc.id)))
      || episodeScripts[0]
    if (owner) { pushUndo({ kind: 'meta', scriptId: owner.id, patch: { sceneLinks: owner.sceneLinks } }); updateScript(owner.id, { sceneLinks: links }) }
  }, [episodeScripts, updateScript, pushUndo])

  // T-99: модалка отдаёт ФРАГМЕНТ сцены (getHTML мини-редактора).
  // Открытая серия — транзакция splice по UUID в живой документ (undo/курсор живы);
  // закрытая — строковая хирургия в контенте стора.
  const handleSaveScene = useCallback((sceneHtml: string) => {
    if (!editSceneOwner || !editScene) { console.warn('[sceneSave] владелец сцены не найден — не сохранено'); return }
    if (editSceneOwner.id === currentScript?.id && editorInstance
        && replaceSceneInEditor(editorInstance, editScene.id, sceneHtml, editScene.number)) {
      return // пересчёт сцен и content пойдёт через onUpdate редактора
    }
    const idx = editSceneOwner.scenes!.findIndex((s) => s.id === editScene.id)
    const newContent = spliceSceneHtml(editSceneOwner.content || '', editScene.number, Math.max(0, idx), sceneHtml, editScene.id)
    updateScript(editSceneOwner.id, { content: newContent })
    if (editSceneOwner.id === currentScript?.id && editorInstance) {
      editorInstance.commands.setContent(newContent)
    }
  }, [editSceneOwner, editScene, currentScript?.id, editorInstance, updateScript])

  const handleContentChange = useCallback((html: string) => {
    if (currentScript?.id) {
      updateScript(currentScript.id, { content: html })
      triggerAutoSave()
    }
  }, [currentScript?.id, updateScript, triggerAutoSave])

  // Применение авто-исправления из панели валидации: заменяем текст ноды блока
  const handleApplyIssueFix = useCallback((issue: ValidationIssue) => {
    if (!editorInstance || !issue.suggestion) return
    const targetIdx = (issue.lineNumber ?? 0) - 1
    let from: number | null = null
    let to: number | null = null
    if (targetIdx >= 0) {
      editorInstance.state.doc.forEach((node, offset, index) => {
        if (index === targetIdx) {
          from = offset + 1
          to = offset + node.nodeSize - 1
        }
      })
    }
    // Страховка: если индекс не совпал — ищем ноду с точно таким же текстом
    if (issue.content) {
      const want = issue.content.trim()
      editorInstance.state.doc.forEach((node, offset) => {
        if ((node.textContent || '').trim() === want) {
          from = offset + 1
          to = offset + node.nodeSize - 1
        }
      })
    }
    if (from == null || to == null) return
    const textNode = editorInstance.schema.text(issue.suggestion)
    editorInstance
      .chain()
      .focus()
      .insertContentAt({ from, to: Math.max(to, from) }, textNode)
      .run()
  }, [editorInstance])

  // Сохранение отредактированного текста сцены из модала карточек (встроенный редактор)
  const handleSaveSceneHtml = useCallback((sc: Scene, html: string) => {
    const owner = episodeScripts.find((ep) => ep.scenes?.some((s) => s.id === sc.id))
    if (!owner) return
    const idx = owner.scenes!.findIndex((s) => s.id === sc.id)
    // T-99: открытая серия — транзакция по UUID в живой документ, не setContent
    if (owner.id === currentScript?.id && editorInstance
        && replaceSceneInEditor(editorInstance, sc.id, html, sc.number)) {
      return
    }
    const newContent = spliceSceneHtml(owner.content || '', sc.number, Math.max(0, idx), html, sc.id)
    updateScript(owner.id, { content: newContent })
    if (owner.id === currentScript?.id && editorInstance) editorInstance.commands.setContent(newContent)
  }, [episodeScripts, currentScript?.id, editorInstance, updateScript])

  // «Пропустить» проблему валидации — сохраняется в сценарии
  const handleDismissIssue = useCallback((issueId: string) => {
    if (!currentScript?.id) return
    const cur = currentScript.dismissedIssues || []
    if (cur.includes(issueId)) return
    updateScript(currentScript.id, { dismissedIssues: [...cur, issueId] })
  }, [currentScript?.id, currentScript?.dismissedIssues, updateScript])

  // Ctrl+S / Ctrl+F / Ctrl+H / Escape(Focus) — глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault()
        search.open(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyH') {
        e.preventDefault()
        search.open(true)
      }
      // Escape — выход из Focus Mode (только если поиск закрыт)
      if (e.key === 'Escape' && focusMode.isFocused && !search.isOpen) {
        focusMode.exit()
      }
      // Escape — выход из Dialogue Mode (если поиск закрыт и нет фокус-режима)
      if (e.key === 'Escape' && dialogueMode.isActive && !search.isOpen && !focusMode.isFocused) {
        dialogueMode.exit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, search.open, search.isOpen, focusMode.isFocused, focusMode.exit, dialogueMode.isActive, dialogueMode.exit])

  const blocks = useMemo(() => {
    return extractBlocksFromHtml(currentScript?.content || '')
  }, [currentScript?.content])

  const defaultTitlePage = useMemo<TitlePage>(() => ({
    title: project?.name || currentScript?.title || '',
    writtenBy: '',
    basedOn: '',
    director: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    draftNumber: '1',
    date: new Date().toISOString().split('T')[0],
    print: true,
  }), [project?.name, currentScript?.title])

  const handleTitlePageChange = useCallback((titlePage: TitlePage) => {
    if (currentScript?.id) {
      updateScript(currentScript.id, { titlePage })
    }
  }, [currentScript?.id, updateScript])

  const { bg, sidebarBg, border, textPrimary, textSecondary } = colors

  // Стабильный объект colors для memo-компонентов (ScriptHeader, ScriptStatusBar)
  const headerColors = useMemo(() => ({ sidebarBg, border, textPrimary, textSecondary }), [sidebarBg, border, textPrimary, textSecondary])

  // Стабильные колбэки для ScriptHeader
  const handleBack = useCallback(() => setView('empty'), [])
  const handleOpenSettings = useCallback(() => setShowTimingSettingsModal(true), [])
  const handleHelp = useCallback(() => setShowHelpModal(true), [])
  const handleOpenFormat = useCallback(() => {
    const text = formatEditorRef.current?.() || ''
    setFormatRawText(text)
    setShowAutoFormatModal(true)
  }, [formatEditorRef])
  const handleToggleAutoFix = useCallback(() => setEnableAutoFix(prev => !prev), [])
  const handleToggleRightPanel = useCallback(() => setRightPanelOpen(prev => !prev), [])
  const handleOpenSearch = useCallback(() => search.open(false), [search.open])

  // Стабильный массив сцен для SceneNavigator (без нового массива каждый рендер)
  const navigatorScenes = useMemo(() => (viewAllSeries ? allScenes : scenes).map(s => ({
    id: s.id,
    number: s.number,
    type: s.type,
    location: s.location,
    sublocation: s.sublocation,
    time: s.time,
    pages: s.pages || 0,
    charCount: s.charCount,
    cast: s.cast,
    draftStatus: s.draftStatus,
  })), [viewAllSeries, allScenes, scenes])

  const scriptCharacters = useMemo(() => currentScript?.characters || [], [currentScript?.characters])

  // Блоки всех серий — парсим из сохранённого HTML каждого скрипта (data-type у блоков).
  // Нужно статистике и разбивке: id/sceneId несут идентичность сцены-владельца,
  // у каждой серии свой документ
  const allBlocks = useMemo(() => {
    const out: FormatBlock[] = []
    for (const ep of episodeScripts) {
      if (!ep.content) continue
      try {
        out.push(...extractBlocksFromHtml(ep.content))
      } catch { /* битый контент скрипта — пропускаем */ }
    }
    return out
  }, [episodeScripts])

  // SmartType: подсказки по всем сериям проекта — персонаж/локация из С1
  // должна подсказываться и в С2 (иначе в каждой серии словарь пустой)
  const smartTypeCharacters = useMemo(() => {
    const set = new Set<string>()
    episodeScripts.forEach((ep) => {
      ep.characters?.forEach((c) => c.name && set.add(c.name.toUpperCase().trim()))
      ep.scenes?.forEach((sc) => (sc.cast || []).forEach((n) => {
        const k = n.toUpperCase().trim()
        if (k) set.add(k)
      }))
    })
    return [...set]
  }, [episodeScripts])
  const smartTypeLocations = useMemo(() => {
    const set = new Set<string>()
    episodeScripts.forEach((ep) => ep.scenes?.forEach((sc) => {
      const loc = (sc.location || '').trim()
      if (!loc) return
      set.add(loc) // базовая локация — всегда, чтобы предлагать подлокации
      const sub = (sc.sublocation || '').trim()
      if (sub) set.add(`${loc}.${sub}`)
    }))
    return [...set]
  }, [episodeScripts])

  // T-31: импорт сценария из .docx (mammoth → parseScreenplayText → blocksToHtml)
  const handleImportDocx = useCallback(async () => {
    if (!project) return
    try {
      const { name, buffer } = await browserFS.uploadFileBinary('.docx')
      // T-111: accept в диалоге — лишь подсказка, формат проверяем явно
      if (!/\.docx$/i.test(name)) {
        showToast('Это не файл Word. Выберите документ .docx', 'error')
        return
      }
      const { html, blockCount } = await docxToScreenplayHtml(buffer)
      if (blockCount === 0) {
        showToast('Файл открылся, но текста сценария в нём нет', 'error')
        return
      }
      const newScript = {
        id: crypto.randomUUID(),
        projectId: project.id,
        title: name.replace(/\.docx$/i, ''),
        version: 'Импорт DOCX',
        format: 'russian' as const,
        scenes: [],
        characters: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timingSystem: 'page' as const,
        genreCoefficient: 1.0,
        fontFamily: 'Courier New',
        fontSize: 12,
        autoExtractCharacters: true,
      }
      const store = useScriptStore.getState()
      store.addScript(newScript)
      saveScriptContent(newScript.id, html)
      store.setCurrentScript(newScript.id)
      showToast(`Сценарий импортирован: ${name} (${blockCount} блоков)`, 'success')
    } catch (e) {
      // Отмена выбора файла — не ошибка
      if ((e as Error)?.message === 'Файл не выбран') return
      if (e instanceof DocxImportError) {
        showToast(e.kind === 'not-docx'
          ? 'Не удалось прочитать файл — это не .docx. Убедитесь, что выбран документ Word'
          : 'Файл повреждён и не читается. Попробуйте пересохранить его в Word', 'error')
        return
      }
      showToast('Не удалось импортировать DOCX-файл', 'error')
    }
  }, [project, showToast])

  if (view === 'empty') {
    return (
      <ScriptEmptyState
        isDark={isDark}
        projectName={project?.name}
        colors={colors}
        onImportClick={handleImportDocx}
        onCreateClick={() => navigate(`/project/${project?.id}/script/create`)}
      />
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: bg }}>
      {focusMode.isFocused && (
        <FocusModeOverlay
          scriptTitle={currentScript?.title}
          isDark={isDark}
          onExit={focusMode.exit}
        />
      )}
      {/* Центральная область: редактор */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!focusMode.isFocused && <ScriptHeader
          isDark={isDark}
          colors={headerColors}
          selectedScene={activeTab === 'text' ? selectedScene : null}
          currentScript={currentScript}
          isSaving={isSaving}
          enableAutoFix={enableAutoFix}
          rightPanelOpen={rightPanelOpen}
          formatLocked={formatLocked}
          onBack={handleBack}
          onSave={handleSave}
          onOpenSettings={handleOpenSettings}
          onHelp={handleHelp}
          onToggleAutoFix={handleToggleAutoFix}
          onToggleRightPanel={activeTab === 'text' ? handleToggleRightPanel : undefined}
          onToggleFormatLock={toggleFormatLock}
          onOpenSearch={handleOpenSearch}
          isFocusMode={focusMode.isFocused}
          onToggleFocusMode={focusMode.toggle}
          isSplitScreen={splitScreen.isActive}
          onToggleSplitScreen={splitScreen.toggle}
          dialogueActiveCharacter={dialogueMode.activeCharacter}
          onToggleDialoguePicker={dialogueMode.togglePicker}
          onFormat={handleOpenFormat}
          onExport={currentScript ? () => setShowExportModal(true) : undefined}
        />}

        {/* Dialogue Character Picker — dropdown под шапкой */}
        {dialogueMode.pickerOpen && (
          <div style={{ position: 'relative', zIndex: 9000 }}>
            <DialogueCharacterPicker
              characters={dialogueMode.characters}
              activeCharacter={dialogueMode.activeCharacter}
              isDark={isDark}
              onSelect={dialogueMode.selectCharacter}
              onClose={() => dialogueMode.setPickerOpen(false)}
              povMode={dialogueMode.povMode}
              onTogglePovMode={dialogueMode.togglePovMode}
            />
          </div>
        )}

        {/* Панель поиска */}
        {search.isOpen && (
          <SearchBar
            isDark={isDark}
            query={search.query}
            setQuery={search.setQuery}
            filter={search.filter}
            setFilter={search.setFilter}
            matches={search.matches}
            currentIndex={search.currentIndex}
            isReplaceOpen={search.isReplaceOpen}
            replaceText={search.replaceText}
            setReplaceText={search.setReplaceText}
            onSearch={search.search}
            onNext={search.goNext}
            onPrev={search.goPrev}
            onClose={search.close}
            onReplaceCurrent={search.replaceCurrent}
            onReplaceAll={search.replaceAll}
            onToggleReplace={() => search.open(!search.isReplaceOpen)}
          />
        )}

        <ScriptTabs
          isDark={isDark}
          border={border}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Область контента по вкладкам */}
        {activeTab === 'title' ? (
          <TitlePageEditor
            isDark={isDark}
            data={currentScript?.titlePage || defaultTitlePage}
            onChange={handleTitlePageChange}
          />
        ) : activeTab === 'statistics' ? (
          <StatisticsView
            isDark={isDark}
            scenes={allScenes}
            blocks={allBlocks}
            precisePages={scriptStats?.pages || 0}
            onSceneClick={handleSceneClickRouted}
            isSerial={project?.type === 'serial'}
            episodesCount={project?.episodesCount || 8}
            episodeDuration={project?.episodeDuration}
          />
        ) : activeTab === 'cards' ? (
          <CardsView
            isDark={isDark}
            scenes={allScenes}
            blocks={allBlocks}
            isSerial={project?.type === 'serial'}
            episodesCount={project?.episodesCount || 8}
            onSceneClick={(id) => {
              handleSceneClickRouted(id)
              setActiveTab('text')
            }}
            onUpdateScene={handleUpdateScene}
            onOpenSceneEditor={setEditScene}
            onMoveScenes={handleMoveScenes}
            actMarkers={actMarkersByEp}
            onMarkerSet={handleMarkerSet}
            groupsByEpisode={sceneGroupsByEp}
            onGroupsChange={handleGroupsChange}
            sceneLinks={sceneLinks}
            onLinksChange={handleLinksChange}
            onUndo={handleUndo}
            undoCount={undoCount}
            contentsByEpisode={contentByEp}
            scriptFormat={scriptFormat}
            onSaveSceneHtml={handleSaveSceneHtml}
            draftStatuses={project?.draftStatuses}
            onDraftStatusesChange={(list) => project && useNormalizedProjectStore.getState().updateProject(project.id, { draftStatuses: list })}
            onDeleteDraftStatus={handleDeleteDraftStatus}
          />
        ) : activeTab === 'development' ? (
          <DevelopmentView
            isDark={isDark}
            scenes={allScenes}
            isSerial={project?.type === 'serial'}
            episodesCount={project?.episodesCount || 8}
            development={project?.development}
            onSceneClick={(id) => {
              handleSceneClickRouted(id)
              setActiveTab('text')
            }}
            contentsByEpisode={contentByEp}
            scriptFormat={scriptFormat}
            onSaveSceneHtml={handleSaveSceneHtml}
            onDevelopmentChange={(dev) => {
              if (project?.id) {
                useNormalizedProjectStore.getState().updateProject(project.id, { development: dev })
              }
            }}
          />
        ) : activeTab === 'breakdown' ? (
          <ScriptBreakdown
            isDark={isDark}
            scenes={allScenes}
            blocks={allBlocks}
            onUpdateScene={handleUpdateScene}
            onSendToDevelopment={handleSendToDevelopment}
          />
        ) : ['plan'].includes(activeTab) ? (
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
          <div className={`flex-1 flex overflow-hidden${focusMode.isFocused ? ' justify-center' : ''}`}>
            {!focusMode.isFocused && <SceneNavigator
              scenes={navigatorScenes}
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
              totalPages={scriptStats.pages}
              onSceneClick={handleSceneClickRouted}
              onSceneReorder={handleSceneReorder}
              activeSceneId={selectedScene?.id || ''}
              draftStatuses={project?.draftStatuses}
              onUpdateScene={handleUpdateScene}
            />}

            {/* ─── Split Screen container ─── */}
            <div
              ref={splitScreen.isActive ? splitScreen.containerRef : undefined}
              className="flex-1 h-full flex overflow-hidden"
              style={focusMode.isFocused ? { maxWidth: 860, margin: '0 auto', width: '100%' } : undefined}
            >
              {/* Левая / единственная панель */}
              <div
                className="h-full overflow-hidden"
                style={splitScreen.isActive ? { width: `${splitScreen.leftWidthPct}%`, flexShrink: 0 } : { flex: 1 }}
                onClick={() => splitScreen.isActive && splitScreen.setActivePanel('left')}
              >
                {splitScreen.isActive && (
                  <div style={{
                    height: 3,
                    background: splitScreen.activePanel === 'left' ? '#818cf8' : 'transparent',
                    transition: 'background 0.15s',
                  }} />
                )}
                {currentScript && currentScript.content === undefined ? (
                  contentErrors[currentScript.id] ? (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ color: '#f87171', fontSize: 14 }}>Не удалось загрузить сценарий: {contentErrors[currentScript.id]}</div>
                      <button
                        onClick={() => void useScriptStore.getState().ensureContentLoaded(currentScript.id)}
                        style={{ padding: '8px 16px', borderRadius: 8, background: '#818cf8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}
                      >Повторить</button>
                    </div>
                  ) : (
                  <div style={{ padding: 24, color: '#64748b', fontSize: 14 }}>Загрузка сценария…</div>
                  )
                ) : (
                <ScriptEditorTiptap
                  key={currentScript?.id || 'no-script'}
                  format={scriptFormat}
                  projectType={project?.type || 'film'}
                  projectId={project?.id}
                  currentSeries={currentSeries}
                  fontFamily="'Courier Prime', 'Courier New', monospace"
                  fontSize={12}
                  isDark={isDark}
                  genreCoefficient={currentScript?.genreCoefficient || 1.0}
                  timingSystem={currentScript?.timingSystem || 'page'}
                  onSceneCountChange={setSceneCount}
                  onStatsChange={setScriptStats}
                  onScenesChange={handleScenesChange}
                  focusSceneId={splitScreen.isActive ? splitScreen.leftFocusSceneId : focusSceneId}
                  onConvertReady={(fn) => { convertFormatRef.current = fn }}
                  onReorderReady={(reorderFn) => { reorderEditorRef.current = reorderFn }}
                  onFormatReady={(formatFn) => { formatEditorRef.current = formatFn }}
                  onActiveSceneChange={(sceneId) => {
                    // T-101 scrollspy: навигатор подсвечивает сцену под курсором
                    if (!sceneId) return
                    const sc = scenes.find((s) => s.id === sceneId)
                    if (sc && sc.id !== selectedScene?.id) setSelectedScene(sc)
                  }}
                  formatLocked={formatLocked}
                  autoExtractCharacters={currentScript?.autoExtractCharacters ?? true}
                  initialContent={currentScript?.content}
                  smartTypeCharacters={smartTypeCharacters}
                  smartTypeLocations={smartTypeLocations}
                  onContentChange={handleContentChange}
                  onEditorReady={setEditorInstance}
                  dialogueCharacter={dialogueMode.activeCharacter}
                  povCharacter={dialogueMode.povMode ? dialogueMode.activeCharacter : null}
                />
                )}
              </div>

              {/* Divider */}
              {splitScreen.isActive && (
                <div
                  onMouseDown={splitScreen.onDividerMouseDown}
                  style={{
                    width: 5,
                    flexShrink: 0,
                    cursor: 'col-resize',
                    background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
                    borderLeft: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                    borderRight: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                    transition: 'background 0.15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.35)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}
                />
              )}

              {/* Правая панель — только в Split Mode */}
              {splitScreen.isActive && (
                <div
                  className="h-full flex flex-col overflow-hidden"
                  style={{ flex: 1 }}
                  onClick={() => splitScreen.setActivePanel('right')}
                >
                  {/* Индикатор активной панели */}
                  <div style={{
                    height: 3,
                    background: splitScreen.activePanel === 'right' ? '#818cf8' : 'transparent',
                    transition: 'background 0.15s',
                    flexShrink: 0,
                  }} />

                  {/* Мини-заголовок с выбором серии (только для сериала) */}
                  {project?.type === 'serial' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 12px',
                        flexShrink: 0,
                        borderBottom: `1px solid ${border}`,
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <span style={{ fontSize: 11, color: textSecondary, whiteSpace: 'nowrap' }}>Серия:</span>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {Array.from({ length: project?.episodesCount || 8 }, (_, i) => i + 1).map(n => (
                          <button
                            key={n}
                            onClick={() => splitScreen.setRightSeries(n)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 5,
                              fontSize: 11,
                              fontWeight: splitScreen.rightSeries === n ? 700 : 400,
                              background: splitScreen.rightSeries === n
                                ? 'rgba(99,102,241,0.2)'
                                : 'transparent',
                              border: splitScreen.rightSeries === n
                                ? '1px solid rgba(99,102,241,0.4)'
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                              color: splitScreen.rightSeries === n ? '#818cf8' : textSecondary,
                              cursor: 'pointer',
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    {rightScript && rightScript.content === undefined ? (
                      contentErrors[rightScript.id] ? (
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ color: '#f87171', fontSize: 14 }}>Не удалось загрузить сценарий: {contentErrors[rightScript.id]}</div>
                          <button
                            onClick={() => void useScriptStore.getState().ensureContentLoaded(rightScript.id)}
                            style={{ padding: '8px 16px', borderRadius: 8, background: '#818cf8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}
                          >Повторить</button>
                        </div>
                      ) : (
                      <div style={{ padding: 24, color: '#64748b', fontSize: 14 }}>Загрузка сценария…</div>
                      )
                    ) : (
                    <ScriptEditorTiptap
                      key={`right-${rightScript?.id || 'none'}`}
                      format={scriptFormat}
                      projectType={project?.type || 'film'}
                      projectId={project?.id}
                      currentSeries={splitScreen.rightSeries}
                      fontFamily="'Courier Prime', 'Courier New', monospace"
                      fontSize={12}
                      isDark={isDark}
                      genreCoefficient={rightScript?.genreCoefficient || 1.0}
                      timingSystem={rightScript?.timingSystem || 'page'}
                      focusSceneId={splitScreen.rightFocusSceneId}
                      formatLocked={formatLocked}
                      autoExtractCharacters={rightScript?.autoExtractCharacters ?? true}
                      initialContent={rightScript?.content}
                      smartTypeCharacters={smartTypeCharacters}
                      smartTypeLocations={smartTypeLocations}
                      onContentChange={(html) => {
                        // T-98: общий путь сохранения — статусбар честно
                        // показывает unsaved/saving и при правках справа
                        if (rightScript?.id) {
                          useScriptStore.getState().updateScript(rightScript.id, { content: html })
                          triggerAutoSave()
                        }
                      }}
                    />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Статусбар внизу — только для текстового редактора */}
        {activeTab === 'text' && (
          <ScriptStatusBar
            isDark={isDark}
            colors={headerColors}
            scenesCount={scriptStats.scenes}
            seriesPages={scriptStats.pages}
            seriesDuration={seriesDuration}
            targetDuration={targetDuration}
            saveStatus={saveStatus}
          />
        )}
      </div>

      {/* Правая панель: валидация, заметки, версии — на статистике/карточках/разработке/титуле не нужна */}
      {rightPanelOpen && !focusMode.isFocused && activeTab === 'text' && (
        <ScriptRightPanel
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          blocks={blocks}
          format={scriptFormat === 'custom' ? 'russian' : scriptFormat}
          enableAutoFix={enableAutoFix}
          onApplyFix={handleApplyIssueFix}
          dismissedIssueIds={currentScript?.dismissedIssues || []}
          onDismissIssue={handleDismissIssue}
          scenes={scenes}
          characters={scriptCharacters}
          timingSystem={currentScript?.timingSystem || 'page'}
          onIssueClick={(issue) => {
            const s = scenes.find(x => x.id === issue.sceneId) || scenes.find(x => x.number === issue.sceneNumber)
            if (s) handleSceneClickRouted(s.id)
            // Выделяем конкретный блок, к которому относится предупреждение
            // (lineNumber — 1-based индекс блока = индекс верхнего узла документа)
            if (issue.lineNumber != null && editorInstance) {
              const targetIdx = issue.lineNumber - 1
              let from: number | null = null
              let to: number | null = null
              editorInstance.state.doc.forEach((node, offset, index) => {
                if (index === targetIdx) {
                  from = offset + 1
                  to = offset + node.nodeSize - 1
                }
              })
              if (from != null && to != null && to > from) {
                editorInstance
                  .chain()
                  .focus()
                  .setTextSelection({ from, to })
                  .scrollIntoView()
                  .run()
              }
            }
          }}
        />
      )}

      {/* Модальное окно выбора формата сценария */}
      {showFormatModal && (
        <FormatSelectModal
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          onSelect={(format) => {
            setScriptFormat(format)
            setShowFormatModal(false)
            navigate(`/project/${project?.id}/script/create`)
          }}
          onClose={() => setShowFormatModal(false)}
        />
      )}

      {/* Модальное окно экспорта сцен в .doc */}
      {showExportModal && currentScript && (
        <ExportModal
          script={currentScript}
          isDark={isDark}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Модальное окно помощи */}
      {showHelpModal && (
        <HelpModal
          context={activeTab}
          isDark={isDark}
          onClose={() => setShowHelpModal(false)}
        />
      )}

      {/* Модальное окно автоформатирования */}
      {showAutoFormatModal && (
        <FormatModal
          isDark={isDark}
          rawText={formatRawText}
          onApply={(html) => {
            if (editorInstance) {
              editorInstance.chain().focus().setContent(html).run()
            }
            setShowAutoFormatModal(false)
          }}
          onClose={() => setShowAutoFormatModal(false)}
        />
      )}

      {/* Модальное окно настроек хронометража */}
      {showTimingSettingsModal && (
        <TimingSettingsModal
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          initialTimingSystem={currentScript?.timingSystem || 'page'}
          initialGenreCoefficient={currentScript?.genreCoefficient === 1.0 ? 'auto' : currentScript?.genreCoefficient?.toString() || 'auto'}
          initialFormat={scriptFormat}
          onFormatSwitch={handleFormatSwitch}
          onApply={handleApplyTimingSettings}
          onClose={() => setShowTimingSettingsModal(false)}
          autoExtractCharacters={currentScript?.autoExtractCharacters ?? true}
          onToggleAutoExtractCharacters={handleToggleAutoExtract}
        />
      )}

      {/* Одиночный редактор сцены («Перейти к сцене» из карточек) */}
      {editScene && editSceneOwner && editSceneIndex >= 0 && (
        <SceneEditModal
          scene={editScene}
          script={editSceneOwner}
          sceneIndex={editSceneIndex}
          isDark={isDark}
          onClose={() => setEditScene(null)}
          onSave={handleSaveScene}
        />
      )}
    </div>
  )
}
