import { useRef, memo } from 'react'
import type { Editor } from '@tiptap/react'
import { EditorContent } from '@tiptap/react'
import { Film, AlignLeft, User, Users, MessageSquare, ArrowRight, Undo2, Redo2 } from 'lucide-react'
import { SmartTypePopup } from './SmartTypePopup'
import type { ScriptFormat } from '../store/scriptStore'
import { useUiStore } from '../store/uiStore'

import type { SmartTypeSuggestion } from '../hooks/useSmartType'

export interface ScriptEditorViewProps {
  editor: Editor | null
  precisePages: number
  isDark: boolean
  textPrimary: string
  editorBg: string
  smartType: {
    suggestions: SmartTypeSuggestion[]
    activeIndex: number
    isOpen: boolean
    closeSuggestions: () => void
    navigateSuggestions: (direction: 'up' | 'down') => void
    recordUsage: (suggestion: SmartTypeSuggestion) => void
  }
  currentType: string
  setBlockType: (type: string) => void
  format?: ScriptFormat
  fontFamily: string
  fontSize: number
  multiCursorCount?: number
}

export function ScriptEditorView({
  editor,
  precisePages,
  isDark,
  textPrimary,
  editorBg,
  smartType,
  currentType,
  setBlockType,
  format,
  fontFamily,
  fontSize,
  multiCursorCount = 0,
}: ScriptEditorViewProps) {
  const editorContentRef = useRef<HTMLDivElement | null>(null)

  // Подсветка диалогов выбранного персонажа теперь реализована через
  // ProseMirror Decoration-плагин в DialogueHighlightExtension
  if (!editor) {
    return null
  }

  const a4Mode = useUiStore((state) => state.a4Mode)

  const blockTypes = [
    { name: 'sceneHeader', label: 'Шапка', icon: Film, color: '#6366f1' },
    { name: 'sceneCast', label: 'Действующие', icon: Users, color: '#8b5cf6' },
    { name: 'sceneAction', label: 'Действие', icon: AlignLeft, color: '#9ca3af' },
    { name: 'sceneCharacter', label: 'Персонаж', icon: User, color: '#f97316' },
    { name: 'sceneParenthetical', label: 'Ремарка', icon: MessageSquare, color: '#eab308' },
    { name: 'sceneDialog', label: 'Диалог', icon: MessageSquare, color: '#22c55e' },
    { name: 'sceneTransition', label: 'Переход', icon: ArrowRight, color: '#ec4899' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative h-full">
      {/* Панель инструментов */}
      <div
        className="shrink-0 flex items-center gap-2 px-4 py-2 border-b"
        style={{
          background: isDark ? '#1a1a2e' : '#f8f9fc',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
        }}
      >
        {/* Undo / Redo */}
        <button
          onClick={() => editor.chain().undo().run()}
          disabled={!editor.can().undo()}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          style={{
            color: isDark ? '#9ca3af' : '#6b7280',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
          }}
          title="Отменить (Ctrl+Z)"
        >
          <Undo2 size={12} />
          Отменить
        </button>
        <button
          onClick={() => editor.chain().redo().run()}
          disabled={!editor.can().redo()}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          style={{
            color: isDark ? '#9ca3af' : '#6b7280',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
          }}
          title="Вернуть (Ctrl+Shift+Z)"
        >
          <Redo2 size={12} />
          Вернуть
        </button>

        <span style={{ color: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb' }}>|</span>

        <span className="text-xs mr-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          Тип блока:
        </span>
        {blockTypes.map((type) => {
          const Icon = type.icon
          const isActive = currentType === type.name
          return (
            <button
              key={type.name}
              onClick={() => setBlockType(type.name)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
              style={{
                background: isActive ? type.color : 'transparent',
                color: isActive ? '#fff' : isDark ? '#9ca3af' : '#6b7280',
                border: `1px solid ${isActive ? type.color : isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
              }}
            >
              <Icon size={12} />
              {type.label}
            </button>
          )
        })}
      </div>

      {/* Область редактора */}
      <div
        ref={editorContentRef}
        data-a4={a4Mode}
        className="flex-1 overflow-y-auto py-8 px-4"
        style={{
          background: a4Mode ? (isDark ? '#0a0a15' : '#e5e5e5') : editorBg,
          color: a4Mode ? '#000000' : textPrimary,
          ['--page-break-bg' as string]: a4Mode ? (isDark ? '#0a0a15' : '#e5e5e5') : 'transparent',
          ['--page-break-color' as string]: a4Mode ? (isDark ? '#9ca3af' : '#6b7280') : 'transparent',
        } as any}
      >
        {/* Контейнер страницы A4 — фиксированная ширина для правильного форматирования */}
        {a4Mode ? (
          <div
            className="mx-auto"
            style={{
              width: '210mm', // Стандарт A4
              minHeight: '297mm',
              backgroundColor: 'transparent',
              backgroundImage: `repeating-linear-gradient(
                to bottom,
                rgba(0,0,0,0.10) 0,
                rgba(0,0,0,0.03) 0.3mm,
                #ffffff 0.3mm,
                #ffffff 296.7mm,
                rgba(0,0,0,0.03) 296.7mm,
                rgba(0,0,0,0.10) 297mm,
                transparent 297mm,
                transparent 307mm
              )`,
              color: '#000000',
              padding: '2cm 2cm 2cm 3cm', // Поля: верх/низ 2cm, левое 3cm, правое 2cm (стандарт для сценариев)
            }}
          >
            <EditorContent
              editor={editor}
              className={`h-full tiptap-editor format-${format || 'russian'}`}
              style={{
                fontFamily,
                fontSize: `${fontSize}pt`,
                lineHeight: '1.5',
                color: '#000000',
              }}
            />
          </div>
        ) : (
          <div className="w-full" style={{ padding: '2cm 2cm 2cm 3cm' }}>
            <EditorContent
              editor={editor}
              className={`h-full tiptap-editor format-${format || 'russian'}`}
              style={{
                fontFamily,
                fontSize: `${fontSize}pt`,
                lineHeight: '1.5',
              }}
            />
          </div>
        )}
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
          {precisePages.toFixed(1)} стр.
        </span>
        {multiCursorCount > 1 && (
          <span
            style={{
              background: 'rgba(33,150,243,0.18)',
              border: '1px solid rgba(33,150,243,0.6)',
              color: '#2196F3',
              borderRadius: '4px',
              padding: '1px 7px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
            title="Multi-cursor активен (Escape — выйти)"
          >
            {multiCursorCount} selections
          </span>
        )}
      </div>

      {/* SmartType Popup */}
      <SmartTypePopup
        editor={editor}
        suggestions={smartType.suggestions}
        activeIndex={smartType.activeIndex}
        isOpen={smartType.isOpen}
        isDark={isDark}
        onSelect={(suggestion) => {
          if (!editor) return
          
          const { state } = editor
          const { selection } = state
          const { $from } = selection
          
          // Получаем текст текущей ноды и позицию внутри неё
          const currentNode = $from.node()
          const nodeText = currentNode?.textContent || ''
          const nodeStartPos = $from.start()
          const posInNode = selection.from - nodeStartPos
          
          // Получаем текущее слово
          const beforeCursor = nodeText.substring(0, posInNode)
          const match = beforeCursor.match(/[^\s]*$/)
          const currentWord = match ? match[0] : ''
          
          if (!currentWord) return
          
          // Вычисляем позиции для удаления
          const wordStartPos = selection.from - currentWord.length
          const wordEndPos = selection.from
          
          // Для времени автоматически добавляем точку
          const textToInsert = suggestion.type === 'time' 
            ? suggestion.text + '.' 
            : suggestion.text
          
          // Удаляем текущее слово и вставляем подсказку
          editor
            .chain()
            .focus()
            .deleteRange({ from: wordStartPos, to: wordEndPos })
            .insertContent(textToInsert)
            .run()

          smartType.recordUsage(suggestion)
          smartType.closeSuggestions()
        }}
        onClose={smartType.closeSuggestions}
        onNavigate={smartType.navigateSuggestions}
      />
    </div>
  )
}

export const MemoizedScriptEditorView = memo(ScriptEditorView)
