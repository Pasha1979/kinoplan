import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'
import type { ScriptFormat } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { SceneHeader, SceneAction, SceneCharacter, SceneDialog } from './tiptap'

interface ScriptEditorTiptapProps {
  format: ScriptFormat
  projectType: ProjectType
  currentSeries: number
  fontFamily: string
  fontSize: number
  isDark: boolean
  genreCoefficient: number
  onSceneCountChange?: (count: number) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
  onBlocksChange?: (blocks: any[]) => void
  onScenesChange?: (scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number }>) => void
  focusSceneId?: string
}

export default function ScriptEditorTiptap({
  format,
  projectType,
  currentSeries,
  fontFamily,
  fontSize,
  isDark,
  onScenesChange,
}: ScriptEditorTiptapProps) {
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const editorBg = isDark ? '#111126' : '#fefefe'

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false, // Отключаем стандартный paragraph, используем наши ноды
      }),
      SceneHeader,
      SceneAction,
      SceneCharacter,
      SceneDialog,
      Placeholder.configure({
        placeholder: 'Начните писать сценарий...',
      }),
    ],
    content: '<div data-type="scene-header">1. ИНТ. ЛОКАЦИЯ — ДЕНЬ</div><div data-type="scene-action"></div>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
        style: `font-family: ${fontFamily}; font-size: ${fontSize}pt;`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const text = editor.getText()
      
      // Сохраняем в localStorage
      localStorage.setItem('kinoplan_tiptap_draft', html)
      
      // Парсим сцены для списка
      parseScenes(text)
    },
  })

  // Парсинг сцен из текста
  const parseScenes = (text: string) => {
    const lines = text.split('\n')
    const scenes: Array<{ id: string; number: string; type: string; location: string; time: string; cast: string[]; pages: number }> = []
    let sceneIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Проверяем шапку сцены: 1. ИНТ. ЛОКАЦИЯ — ДЕНЬ
      const headerMatch = line.match(/^(?:\d+(?:-\d+)?\.\s*)?([ИЭ]К?С?Т?\.?)\s+(.+)$/i)
      
      if (headerMatch) {
        sceneIndex++
        const sceneType = headerMatch[1].toUpperCase().startsWith('Э') ? 'ЭКСТ' : 'ИНТ'
        const locationPart = headerMatch[2]
        
        // Разделяем локацию и время
        const parts = locationPart.split(/[—–\-]/)
        const location = parts[0]?.trim().replace(/\.$/, '') || ''
        const time = parts[parts.length - 1]?.trim().replace(/\.$/, '') || 'ДЕНЬ'

        scenes.push({
          id: `scene-${sceneIndex}`,
          number: projectType === 'serial' ? `${currentSeries}-${sceneIndex}` : String(sceneIndex),
          type: sceneType,
          location,
          time,
          cast: [],
          pages: 0.5,
        })
      }
    }

    if (onScenesChange) {
      onScenesChange(scenes)
    }
  }

  // Загружаем сохранённый черновик при монтировании
  useEffect(() => {
    if (editor) {
      const saved = localStorage.getItem('kinoplan_tiptap_draft')
      if (saved) {
        editor.commands.setContent(saved)
      }
    }
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Область редактора */}
      <div
        className="flex-1 overflow-y-auto p-8"
        style={{
          background: editorBg,
          color: textPrimary,
        }}
      >
        <EditorContent
          editor={editor}
          className="h-full"
          style={{
            fontFamily,
            fontSize: `${fontSize}pt`,
            lineHeight: '1.5',
          }}
        />
      </div>

      {/* Статусбар */}
      <div
        className="shrink-0 flex items-center gap-6 px-6 py-2 border-t text-xs"
        style={{
          background: isDark ? '#1a1a2e' : '#f8f9fc',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
        }}
      >
        <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {editor.getText().length} симв.
        </span>
        <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {(editor.getText().length / 2500).toFixed(1)} стр.
        </span>
      </div>
    </div>
  )
}
