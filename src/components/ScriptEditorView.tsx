import { useRef, memo, useState, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { EditorContent } from '@tiptap/react'
import { Film, AlignLeft, User, Users, MessageSquare, ArrowRight, Undo2, Redo2, Copy, Split, ArrowUpToLine, ArrowDownToLine, Trash2, ChevronRight, ChevronLeft, LayoutTemplate } from 'lucide-react'
import { SmartTypePopup } from './SmartTypePopup'
import { useUiStore } from '../store/uiStore'
import type { ScriptFormat } from '../store/scriptStore'
import ContextMenu from '../pages/Home/ContextMenu'
import { allSceneRanges, sceneAtPos, duplicateScene, splitScene, mergeScenes, deleteScene, insertSceneFromHtml, sceneHtmlAt } from '../utils/sceneOps'
import { BUILTIN_SCENE_TEMPLATES } from '../utils/sceneTemplates'


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
  /** T-137: поле «перейти к сцене №» (Ctrl+G) */
  gotoOpen?: boolean
  setGotoOpen?: (v: boolean) => void
  gotoScene?: (number: string) => boolean
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
  gotoOpen = false,
  setGotoOpen,
  gotoScene,
}: ScriptEditorViewProps) {
  const editorContentRef = useRef<HTMLDivElement | null>(null)
  const a4Mode = useUiStore((s) => s.a4Mode)

  // Блок B: контекстное меню редактора (ПКМ) — операции со сценой + тип блока
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; pos: number; inScene: boolean; hasPrev: boolean; hasNext: boolean } | null>(null)
  const [ctxSub, setCtxSub] = useState<'main' | 'blocks' | 'templates'>('main')
  const [tplNamePos, setTplNamePos] = useState<number | null>(null) // T-143: ввод имени шаблона
  const customTemplates = useUiStore((s) => s.customSceneTemplates)
  const addCustomSceneTemplate = useUiStore((s) => s.addCustomSceneTemplate)

  // Подсветка диалогов выбранного персонажа теперь реализована через
  // ProseMirror Decoration-плагин в DialogueHighlightExtension
  if (!editor) {
    return null
  }

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
        className="shrink-0 flex items-center gap-2 px-4 py-2 border-b flex-wrap"
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

      {/* Область редактора — сплошной документ, без имитации листов */}
      <div
        ref={editorContentRef}
        className="flex-1 overflow-y-auto py-8 px-4"
        style={{
          background: editorBg,
          color: textPrimary,
        }}
      >
        <div
          className="mx-auto"
          onContextMenu={(e) => {
            e.preventDefault()
            const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
            const pos = coords?.pos ?? editor.state.selection.from
            editor.chain().focus().setTextSelection(pos).run()
            const hit = sceneAtPos(editor.state.doc, pos)
            const total = allSceneRanges(editor.state.doc).length
            setCtxMenu({
              x: e.clientX, y: e.clientY, pos,
              inScene: !!hit,
              hasPrev: !!hit && hit.index > 0,
              hasNext: !!hit && hit.index < total - 1,
            })
            setCtxSub('main')
          }}
          style={a4Mode ? {
            // T-59: «лист A4» — белая бумага на холсте, геометрия как у PageCounter
            width: '210mm',
            minHeight: '297mm',
            padding: '2cm 2cm 2cm 3cm',
            background: '#ffffff',
            color: '#1a1a1a',
            boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.12)',
            borderRadius: '2px',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
          } : {
            // Линейный режим — текст на всю ширину холста
            width: '100%',
            padding: '0 16px',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          <EditorContent
            editor={editor}
            className={`h-full tiptap-editor format-${format || 'russian'}`}
            style={{
              fontFamily,
              fontSize: `${fontSize}pt`,
              lineHeight: '1.5',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          />
        </div>
      </div>

      {/* T-137: Ctrl+G — переход к сцене по номеру */}
      {gotoOpen && (
        <GotoSceneInput
          isDark={isDark}
          onGo={(num) => { if (gotoScene?.(num)) setGotoOpen?.(false) }}
          onClose={() => setGotoOpen?.(false)}
        />
      )}

      {/* T-143: ввод имени нового шаблона */}
      {tplNamePos !== null && (
        <GotoSceneInput
          isDark={isDark}
          label="Имя шаблона"
          placeholder="Моя сцена"
          onGo={(name) => {
            const html = name.trim() ? sceneHtmlAt(editor, tplNamePos) : null
            if (html) addCustomSceneTemplate({ name: name.trim(), html })
            setTplNamePos(null)
          }}
          onClose={() => setTplNamePos(null)}
        />
      )}

      {/* Блок B: контекстное меню — операции со сценой и смена типа блока */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => { setCtxMenu(null); setCtxSub('main') }}
          items={
            ctxSub === 'blocks'
              ? [
                  { label: '← Тип блока', icon: <ChevronLeft size={14} />, keepOpen: true, onClick: () => setCtxSub('main') },
                  ...blockTypes.map((t) => {
                    const Icon = t.icon
                    return {
                      label: t.name === currentType ? `✓ ${t.label}` : t.label,
                      icon: <Icon size={14} />,
                      onClick: () => setBlockType(t.name),
                    }
                  }),
                ]
              : ctxSub === 'templates'
                ? [
                    { label: '← Назад', icon: <ChevronLeft size={14} />, keepOpen: true, onClick: () => setCtxSub('main') },
                    ...BUILTIN_SCENE_TEMPLATES.map((t) => ({
                      label: t.name,
                      icon: <LayoutTemplate size={14} />,
                      onClick: () => insertSceneFromHtml(editor, ctxMenu.pos, t.html),
                    })),
                    ...customTemplates.map((t) => ({
                      label: `★ ${t.name}`,
                      icon: <LayoutTemplate size={14} />,
                      onClick: () => insertSceneFromHtml(editor, ctxMenu.pos, t.html),
                    })),
                    ...(ctxMenu.inScene ? [{
                      label: 'Сохранить эту сцену как шаблон…',
                      icon: <Copy size={14} />,
                      onClick: () => setTplNamePos(ctxMenu.pos),
                    }] : []),
                  ]
              : [
                  { label: 'Тип блока', icon: <ChevronRight size={14} />, keepOpen: true, onClick: () => setCtxSub('blocks') },
                  { label: 'Сцена из шаблона', icon: <LayoutTemplate size={14} />, keepOpen: true, onClick: () => setCtxSub('templates') },
                  ...(ctxMenu.inScene ? [
                    { label: 'Дублировать сцену', icon: <Copy size={14} />, onClick: () => duplicateScene(editor, ctxMenu.pos) },
                    { label: 'Разделить сцену здесь', icon: <Split size={14} />, onClick: () => splitScene(editor, ctxMenu.pos) },
                    ...(ctxMenu.hasPrev ? [{ label: 'Объединить с предыдущей', icon: <ArrowUpToLine size={14} />, onClick: () => mergeScenes(editor, ctxMenu.pos, 'prev') }] : []),
                    ...(ctxMenu.hasNext ? [{ label: 'Объединить со следующей', icon: <ArrowDownToLine size={14} />, onClick: () => mergeScenes(editor, ctxMenu.pos, 'next') }] : []),
                    { label: 'Удалить сцену', icon: <Trash2 size={14} />, danger: true, onClick: () => deleteScene(editor, ctxMenu.pos) },
                  ] : []),
                ]
          }
        />
      )}

      {/* Статусбар */}
      <div
        className="shrink-0 flex items-center gap-6 px-6 py-2 border-t text-xs"
        style={{
          background: isDark ? '#1a1a2e' : '#f8f9fc',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
        }}
      >
        <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }} title="Знаков с пробелами (как в редакциях: без служебных разрывов)">
          {editor.getText({ blockSeparator: '' }).length.toLocaleString('ru-RU')} зн. с пр.
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

/** Мини-поле ввода поверх редактора — Enter подтверждает, Escape закрывает */
function GotoSceneInput({ isDark, label = 'К сцене №', placeholder = '5 или 5-А', onGo, onClose }: { isDark: boolean; label?: string; placeholder?: string; onGo: (n: string) => void; onClose: () => void }) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border px-3 py-2 shadow-xl"
      style={{
        background: isDark ? '#1e1e3a' : '#ffffff',
        borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb',
      }}
    >
      <span className="text-xs whitespace-nowrap" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
        {label}
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onGo(value)
          if (e.key === 'Escape') onClose()
        }}
        placeholder={placeholder}
        className="w-24 bg-transparent text-sm outline-none"
        style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}
        data-testid="goto-scene-input"
      />
    </div>
  )
}
