import { useCallback, useEffect, useMemo, useState } from 'react'
import { useScriptPageLogic } from './useScriptPageLogic'
import { useScriptStore, type TitlePage } from '../../store/scriptStore'
import ScriptEmptyState from './components/ScriptEmptyState'
import ScriptHeader from './components/ScriptHeader'
import ScriptTabs from './components/ScriptTabs'
import ScriptStatusBar from './components/ScriptStatusBar'
import FormatSelectModal from './components/FormatSelectModal'
import TimingSettingsModal from './components/TimingSettingsModal'
import TitlePageEditor from '../../components/TitlePageEditor'
import ScriptRightPanel from './components/ScriptRightPanel'
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

export default function ScriptPage() {
  const logic = useScriptPageLogic()
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
    // scenes
    handleScenesChange,
    handleSceneReorder,
    handleSceneClick,
    // refs
    convertFormatRef,
    reorderEditorRef,
    updateNumbersRef,
  } = logic

  const updateScript = useScriptStore((s) => s.updateScript)

  // Поиск по сценарию
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
  const search = useScriptSearch(editorInstance)
  const [showHelpModal, setShowHelpModal] = useState(false)
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
      handleSceneClick(sceneId)
    }
  }, [splitScreen.isActive, splitScreen.navigateToScene, handleSceneClick])

  const handleContentChange = useCallback((html: string) => {
    if (currentScript?.id) {
      updateScript(currentScript.id, { content: html })
      triggerAutoSave()
    }
  }, [currentScript?.id, updateScript, triggerAutoSave])

  // Ctrl+S / Ctrl+F / Ctrl+H / Escape(Focus) — глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        search.open(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
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
    email: '',
    phone: '',
    draftNumber: '1',
    date: new Date().toLocaleDateString('ru-RU'),
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
  const handleToggleAutoFix = useCallback(() => setEnableAutoFix(prev => !prev), [])
  const handleToggleRightPanel = useCallback(() => setRightPanelOpen(prev => !prev), [])
  const handleOpenSearch = useCallback(() => search.open(false), [search.open])

  // Стабильный массив сцен для SceneNavigator (без нового массива каждый рендер)
  const navigatorScenes = useMemo(() => scenes.map(s => ({
    id: s.id,
    number: s.number,
    type: s.type,
    location: s.location,
    sublocation: s.sublocation,
    time: s.time,
    pages: s.pages || 0,
    charCount: s.charCount,
    cast: s.cast,
  })), [scenes])

  const scriptCharacters = useMemo(() => currentScript?.characters || [], [currentScript?.characters])

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
          selectedScene={selectedScene}
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
                  formatLocked={formatLocked}
                  autoExtractCharacters={currentScript?.autoExtractCharacters ?? true}
                  initialContent={currentScript?.content}
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

      {/* Правая панель: валидация, заметки, версии */}
      {rightPanelOpen && !focusMode.isFocused && (
        <ScriptRightPanel
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          blocks={blocks}
          format={scriptFormat === 'custom' ? 'russian' : scriptFormat}
          enableAutoFix={enableAutoFix}
          scenes={scenes}
          characters={scriptCharacters}
          timingSystem={currentScript?.timingSystem || 'page'}
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
          isDark={isDark}
          onClose={() => setShowHelpModal(false)}
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
    </div>
  )
}
