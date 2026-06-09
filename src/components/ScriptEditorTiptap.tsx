import type { ScriptFormat, TimingSystem } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { useScriptEditorLogic } from '../hooks/useScriptEditorLogic'
import { ScriptEditorView } from './ScriptEditorView'

interface ScriptEditorTiptapProps {
  format?: ScriptFormat
  projectType: ProjectType
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
  onReorderReady?: (reorderFn: (fromIndex: number, toIndex: number) => void) => void
  onUpdateNumbersReady?: (updateFn: (scenes: Array<{ id: string; number: string }>) => void) => void
  smartTypeCharacters?: string[]
  smartTypeLocations?: string[]
  smartTypeTimes?: string[]
}

export default function ScriptEditorTiptap(props: ScriptEditorTiptapProps) {
  const logic = useScriptEditorLogic(props)

  return (
    <ScriptEditorView
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
    />
  )
}
