import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import type { ScriptFormat, TimingSystem } from '../store/scriptStore'
import type { ProjectType } from '../types/project'
import { useScriptEditorLogic } from '../hooks/useScriptEditorLogic'
import { MemoizedScriptEditorView } from './ScriptEditorView'

interface ScriptEditorTiptapProps {
  format?: ScriptFormat
  projectType: ProjectType
  /** T-227: явный переключатель сценарных дней */
  storyDays?: boolean
  projectId?: string
  currentSeries: number
  fontFamily: string
  fontSize: number
  isDark: boolean
  genreCoefficient: number
  timingSystem: TimingSystem
  onSceneCountChange?: (count: number) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
  onScenesChange?: (scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number; charCount: number }>) => void
  focusSceneId?: string
  onConvertReady?: (convertFn: (from: ScriptFormat, to: ScriptFormat) => void) => void
  onReorderReady?: (reorderFn: (fromIndex: number, toIndex: number, newNumbers?: Array<{ id: string; number: string }>) => void) => void
  onFormatReady?: (formatFn: () => string) => void
  /** T-101 scrollspy: UUID сцены, в которой курсор */
  onActiveSceneChange?: (sceneId: string | null) => void
  smartTypeCharacters?: string[]
  smartTypeLocations?: string[]
  smartTypeTimes?: string[]
  formatLocked?: boolean
  autoExtractCharacters?: boolean
  initialContent?: string
  onContentChange?: (html: string) => void
  onEditorReady?: (editor: Editor | null) => void
  /** I-150: ПКМ «Закладка» в редакторе */
  onBookmarkScene?: (sceneId: string | null, sceneNumber: string | null, x: number, y: number) => void
  dialogueCharacter?: string | null
  povCharacter?: string | null
}

export default function ScriptEditorTiptap(props: ScriptEditorTiptapProps) {
  const logic = useScriptEditorLogic(props)

  useEffect(() => {
    props.onEditorReady?.(logic.editor)
  }, [logic.editor])

  return (
    <MemoizedScriptEditorView
      editor={logic.editor}
      precisePages={logic.precisePages}
      isDark={logic.isDark}
      textPrimary={logic.textPrimary}
      editorBg={logic.editorBg}
      smartType={logic.smartType}
      currentType={logic.currentType}
      setBlockType={logic.setBlockType}
      format={logic._format}
      fontFamily={props.fontFamily}
      fontSize={props.fontSize}
      multiCursorCount={logic.multiCursorCount}
      gotoOpen={logic.gotoOpen}
      setGotoOpen={logic.setGotoOpen}
      gotoScene={logic.gotoScene}
      onBookmarkScene={props.onBookmarkScene}
    />
  )
}
