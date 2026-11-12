import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useScriptPageLogic } from './useScriptPageLogic'
import { useScriptStore, type TitlePage } from '../../store/scriptStore'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import ScriptEmptyState from './components/ScriptEmptyState'
import ScriptHeader from './components/ScriptHeader'
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
import { extractSceneHtml, insertSceneHtml, renumberHeaders } from './components/sceneHtmlOps'
import { renumberSceneNumbers } from '../../utils/sceneNumbering'
import type { Scene } from '../../types/scene'
import SceneNavigator from '../../components/SceneNavigator'
import ScriptEditorTiptap from '../../components/ScriptEditorTiptap'
import { extractBlocksFromHtml } from '../../utils/formatBlockExtractor'
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

export default function ScriptPage() {
  // Мост к pushUndo: навигатор сцен сообщает о перестановке до её выполнения
  const beforeSceneReorderRef = useRef<(scriptId: string) => void>(() => {})
  const logic = useScriptPageLogic({
    onBeforeSceneReorder: useCallback((id: string) => beforeSceneReorderRef.current(id), []),
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
    updateNumbersRef,
    formatEditorRef,
  } = logic

  const updateScript = useScriptStore((s) => s.updateScript)

  // Поиск по сценарию
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
  const search = useScriptSearch(editorInstance)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showAutoFormatModal, setShowAutoFormatModal] = useState(false)
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

  // Одиночный редактор сцены («Перейти к сцене» из карточки)
  const [editScene, setEditScene] = useState<Scene | null>(null)
  const editSceneOwner = editScene ? episodeScripts.find((ep) => ep.scenes?.some((s) => s.id === editScene.id)) : undefined
  const editSceneIndex = editScene && editSceneOwner ? editSceneOwner.scenes!.findIndex((s) => s.id === editScene.id) : -1

  // ── UNDO-стек для операций на доске (драг, группы, маркеры) — 15 действий
  type ScriptSnapshot = { content: string; scenes: Scene[]; sceneGroups?: import('../../types/scene').SceneGroup[]; actMarkers?: Record<string, string> }
  const undoStack = useRef<Array<Array<{ scriptId: string; snap: ScriptSnapshot }>>>([])
  const [undoCount, setUndoCount] = useState(0)
  const pushUndo = useCallback((scriptIds: string[]) => {
    const pack = scriptIds.map((id) => {
      const s = episodeScripts.find((ep) => ep.id === id)
      return s ? { scriptId: id, snap: { content: s.content || '', scenes: structuredClone(s.scenes || []), sceneGroups: s.sceneGroups, actMarkers: s.actMarkers } } : null
    }).filter(Boolean) as Array<{ scriptId: string; snap: ScriptSnapshot }>
    undoStack.current.push(pack)
    if (undoStack.current.length > 15) undoStack.current.shift()
    setUndoCount(undoStack.current.length)
  }, [episodeScripts])
  // Навигатор сцен → undo-стек доски (снимок «до» перестановки)
  useEffect(() => {
    beforeSceneReorderRef.current = (id: string) => pushUndo([id])
  }, [pushUndo])
  const handleUndo = useCallback(() => {
    const pack = undoStack.current.pop()
    if (!pack) return
    pack.forEach(({ scriptId, snap }: { scriptId: string; snap: ScriptSnapshot }) => {
      updateScript(scriptId, { content: snap.content, scenes: snap.scenes, sceneGroups: snap.sceneGroups, actMarkers: snap.actMarkers })
      if (scriptId === currentScript?.id && editorInstance) editorInstance.commands.setContent(snap.content)
    })
    setUndoCount(undoStack.current.length)
  }, [episodeScripts, currentScript?.id, editorInstance, updateScript])

  // Перенос сцен drag&drop: внутри серии ИЛИ между скриптами-сериями.
  // Вырезает HTML-фрагменты по номерам шапок, вставляет в цель, перенумеровывает.
  const handleMoveScenes = useCallback((sceneIds: string[], toEpisode: number, toIndex: number) => {
    const isSerial = project?.type === 'serial'
    const from = episodeScripts.find((ep) => ep.scenes?.some((s) => sceneIds.includes(s.id)))
    const to = episodeScripts.find((ep) => (ep.episodeNumber ?? 1) === toEpisode)
    if (!from || !to) return
    // все переносимые сцены должны быть из одного скрипта
    if (!sceneIds.every((id) => from.scenes!.some((s) => s.id === id))) return

    pushUndo([from.id, to.id])
    const fromEp = from.episodeNumber ?? 1
    const moving = sceneIds.map((id) => from.scenes!.find((s) => s.id === id)!)
    const frags = moving.map((s) => extractSceneHtml(from.content || '', s.number, 0)).join('')
    const movedSet = new Set(sceneIds)

    const renum = (arr: typeof from.scenes, ep: number) => {
      // Литерные варианты (1-9-А) сохраняют буквы и каскадно перенумеровываются
      const nums = renumberSceneNumbers((arr || []).map((s) => s.number), isSerial, ep)
      return arr!.map((s, i) => ({ ...s, number: nums[i], order: i }))
    }

    if (from.id === to.id) {
      // тот же скрипт: вырезать → вставить внутрь с поправкой индекса
      const firstIdx = from.scenes!.findIndex((s) => movedSet.has(s.id))
      const insertIdx = firstIdx < toIndex ? Math.max(0, toIndex - sceneIds.length) : toIndex
      let content = from.content || ''
      moving.forEach((s) => { content = spliceSceneHtml(content, s.number, 0, '') })
      content = insertSceneHtml(content, frags, insertIdx)
      content = renumberHeaders(content, toEpisode, isSerial)
      const arr = from.scenes!.filter((s) => !movedSet.has(s.id))
      arr.splice(insertIdx, 0, ...moving)
      updateScript(from.id, { content, scenes: renum(arr, toEpisode) })
      if (from.id === currentScript?.id && editorInstance) editorInstance.commands.setContent(content)
      return
    }

    // разные скрипты: из источника вырезать+перенумеровать, в цель вставить+перенумеровать
    let fromContent = from.content || ''
    moving.forEach((s) => { fromContent = spliceSceneHtml(fromContent, s.number, 0, '') })
    fromContent = renumberHeaders(fromContent, fromEp, isSerial)
    const toContent = renumberHeaders(insertSceneHtml(to.content || '', frags, toIndex), toEpisode, isSerial)

    const fromScenes = renum(from.scenes!.filter((s) => !movedSet.has(s.id)), fromEp)
    const toArr = [...(to.scenes || [])]
    toArr.splice(toIndex, 0, ...moving)
    const toScenes = renum(toArr, toEpisode)

    updateScript(from.id, { content: fromContent, scenes: fromScenes })
    updateScript(to.id, { content: toContent, scenes: toScenes })
    if (from.id === currentScript?.id && editorInstance) editorInstance.commands.setContent(fromContent)
    if (to.id === currentScript?.id && editorInstance) editorInstance.commands.setContent(toContent)
  }, [episodeScripts, project?.type, currentScript?.id, editorInstance, updateScript])
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
    pushUndo([owner.id])
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
    if (owner) { pushUndo([owner.id]); updateScript(owner.id, { sceneGroups: groups }) }
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
    if (owner) { pushUndo([owner.id]); updateScript(owner.id, { sceneLinks: links }) }
  }, [episodeScripts, updateScript, pushUndo])

  const handleSaveScene = useCallback((newContent: string) => {
    if (!editSceneOwner) { console.warn('[sceneSave] владелец сцены не найден — не сохранено'); return }
    // 1) пишем в стор — сохранится и в PouchDB, и для закрытых серий
    updateScript(editSceneOwner.id, { content: newContent })
    // 2) если это открытый скрипт — обновляем живой редактор (пересчёт сцен пойдёт сам)
    if (editSceneOwner.id === currentScript?.id && editorInstance) {
      editorInstance.commands.setContent(newContent)
    }
  }, [editSceneOwner, currentScript?.id, editorInstance, updateScript])

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
    const newContent = spliceSceneHtml(owner.content || '', sc.number, Math.max(0, idx), html)
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
  })), [viewAllSeries, allScenes, scenes])

  const scriptCharacters = useMemo(() => currentScript?.characters || [], [currentScript?.characters])

  // Блоки всех серий — парсим из сохранённого HTML каждого скрипта (data-type у блоков).
  // Нужно статистике: темп и диалог/действие считаются по блокам, а у каждой серии свой документ
  const allBlocks = useMemo(() => {
    const out: Array<{ type: string; content: string }> = []
    const TYPE_MAP: Record<string, string> = {
      'scene-header': 'scene_header', 'scene-dialog': 'dialog', 'scene-action': 'action',
      sceneHeader: 'scene_header', sceneDialog: 'dialog', sceneAction: 'action',
      scene_header: 'scene_header', dialog: 'dialog', action: 'action',
    }
    for (const ep of episodeScripts) {
      if (!ep.content) continue
      try {
        const doc = new DOMParser().parseFromString(ep.content, 'text/html')
        doc.body.querySelectorAll('[data-type]').forEach((el) => {
          const t = el.getAttribute('data-type') || ''
          out.push({ type: TYPE_MAP[t] ?? t, content: el.textContent || '' })
        })
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

  if (view === 'empty') {
    return (
      <ScriptEmptyState
        isDark={isDark}
        projectName={project?.name}
        colors={colors}
        onImportClick={() => showToast('Функция импорта файлов будет реализована в ближайшем обновлении', 'info')}
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
          onToggleRightPanel={handleToggleRightPanel}
          onToggleFormatLock={toggleFormatLock}
          onOpenSearch={handleOpenSearch}
          isFocusMode={focusMode.isFocused}
          onToggleFocusMode={focusMode.toggle}
          isSplitScreen={splitScreen.isActive}
          onToggleSplitScreen={splitScreen.toggle}
          dialogueActiveCharacter={dialogueMode.activeCharacter}
          onToggleDialoguePicker={dialogueMode.togglePicker}
          onFormat={handleOpenFormat}
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
        ) : ['breakdown', 'plan'].includes(activeTab) ? (
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
                <ScriptEditorTiptap
                  key={currentScript?.id || 'no-script'}
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
                  focusSceneId={splitScreen.isActive ? splitScreen.leftFocusSceneId : focusSceneId}
                  onConvertReady={(fn) => { convertFormatRef.current = fn }}
                  onReorderReady={(reorderFn) => { reorderEditorRef.current = reorderFn }}
                  onUpdateNumbersReady={(updateFn) => { updateNumbersRef.current = updateFn }}
                  onFormatReady={(formatFn) => { formatEditorRef.current = formatFn }}
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
                    <ScriptEditorTiptap
                      key={`right-${rightScript?.id || 'none'}`}
                      format={scriptFormat}
                      projectType={project?.type || 'film'}
                      projectId={project?.id}
                      currentSeries={splitScreen.rightSeries}
                      fontFamily="Courier New"
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
                        if (rightScript?.id) {
                          useScriptStore.getState().updateScript(rightScript.id, { content: html })
                        }
                      }}
                    />
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

      {/* Правая панель: валидация, заметки, версии — на статистике не нужна */}
      {rightPanelOpen && !focusMode.isFocused && !['statistics', 'cards', 'development'].includes(activeTab) && (
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
