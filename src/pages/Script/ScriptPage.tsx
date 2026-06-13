import { useCallback, useMemo } from 'react'
import { useScriptPageLogic } from './useScriptPageLogic'
import { useScriptStore, type TitlePage } from '../../store/scriptStore'
import ScriptEmptyState from './components/ScriptEmptyState'
import ScriptHeader from './components/ScriptHeader'
import ScriptTabs from './components/ScriptTabs'
import ScriptStatusBar from './components/ScriptStatusBar'
import FormatSelectModal from './components/FormatSelectModal'
import TimingSettingsModal from './components/TimingSettingsModal'
import TitlePageEditor from '../../components/TitlePageEditor'
import FormatAssistant from '../../components/FormatAssistant'
import SceneNavigator from '../../components/SceneNavigator'
import ScriptEditorTiptap from '../../components/ScriptEditorTiptap'
import { extractBlocksFromHtml } from '../../utils/formatBlockExtractor'
import { Settings } from 'lucide-react'

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
    // save
    isSaving,
    handleSave,
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

  const handleContentChange = useCallback((html: string) => {
    if (currentScript?.id) {
      updateScript(currentScript.id, { content: html })
    }
  }, [currentScript?.id, updateScript])

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
      {/* Центральная область: редактор */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScriptHeader
          isDark={isDark}
          colors={{ sidebarBg, border, textPrimary, textSecondary }}
          selectedScene={selectedScene}
          currentScript={currentScript}
          isSaving={isSaving}
          enableAutoFix={enableAutoFix}
          rightPanelOpen={rightPanelOpen}
          formatLocked={formatLocked}
          onBack={() => setView('empty')}
          onSave={handleSave}
          onOpenSettings={() => setShowTimingSettingsModal(true)}
          onHelp={() => showToast('Мини-обучение: горячие клавиши и справка по модулю сценария будет реализовано позже', 'info')}
          onToggleAutoFix={() => setEnableAutoFix(!enableAutoFix)}
          onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
          onToggleFormatLock={toggleFormatLock}
        />

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
          <div className="flex-1 flex overflow-hidden">
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
              totalPages={scriptStats.pages}
              onSceneClick={handleSceneClick}
              onSceneReorder={handleSceneReorder}
              activeSceneId={selectedScene?.id || ''}
            />

            <div className="flex-1 h-full">
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
                focusSceneId={focusSceneId}
                onConvertReady={(fn) => { convertFormatRef.current = fn }}
                onReorderReady={(reorderFn) => { reorderEditorRef.current = reorderFn }}
                onUpdateNumbersReady={(updateFn) => { updateNumbersRef.current = updateFn }}
                formatLocked={formatLocked}
                initialContent={currentScript?.content}
                onContentChange={handleContentChange}
              />
            </div>
          </div>
        )}

        {/* Статусбар внизу — только для текстового редактора */}
        {activeTab === 'text' && (
          <ScriptStatusBar
            isDark={isDark}
            colors={{ sidebarBg, border, textPrimary, textSecondary }}
            scenesCount={scriptStats.scenes}
            seriesPages={scriptStats.pages}
            seriesDuration={seriesDuration}
            targetDuration={targetDuration}
          />
        )}

        {/* Format Assistant — панель проверки форматирования */}
        {activeTab === 'text' && (
          <FormatAssistant
            blocks={blocks}
            format={scriptFormat === 'custom' ? 'russian' : scriptFormat}
            isDark={isDark}
            enableAutoFix={enableAutoFix}
          />
        )}
      </div>

      {/* Правая панель: заметки / версии — В РАЗРАБОТКЕ */}
      {rightPanelOpen && (
        <div className="shrink-0 flex flex-col border-l overflow-hidden"
          style={{ width: 300, background: sidebarBg, borderColor: border }}>
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
        />
      )}
    </div>
  )
}
