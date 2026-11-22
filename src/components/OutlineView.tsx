import { useMemo, useState } from 'react'
import {
  DndContext, closestCorners, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, Clock, Bookmark } from 'lucide-react'
import type { Scene } from '../types/scene'
import { formatDuration } from '../utils/sceneTiming'
import StoryDayBadge from './StoryDayBadge'
import { SceneTextEditor } from '../pages/Script/components/SceneDetailModal'
import { useUiStore } from '../store/uiStore'

interface OutlineViewProps {
  scenes: Scene[]
  /** фрагмент HTML сцены для встроенного редактора */
  getSceneHtml: (scene: Scene, index: number) => string
  /** сохранение отредактированного HTML сцены в документ */
  onSaveSceneHtml: (scene: Scene, html: string) => void
  scriptFormat: 'russian' | 'hollywood' | 'custom'
  isDark: boolean
  /** «шапки+синопсис» — показывать строку описания */
  withSynopsis: boolean
  onToggleSynopsis: () => void
  onClose: () => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

const TYPE_COLOR: Record<string, string> = {
  'ИНТ': '#818cf8', 'ЭКСТ': '#34d399', 'ЭКСТ.': '#34d399',
}

function OutlineRow({
  scene, index, isActive, isExpanded, isDark, withSynopsis, textPrimary, textSecondary,
  scriptFormat, getSceneHtml, onSaveSceneHtml,
  onSelect, onToggleExpand,
}: {
  scene: Scene
  index: number
  isActive: boolean
  isExpanded: boolean
  isDark: boolean
  withSynopsis: boolean
  textPrimary: string
  textSecondary: string
  scriptFormat: 'russian' | 'hollywood' | 'custom'
  getSceneHtml: (scene: Scene, index: number) => string
  onSaveSceneHtml: (scene: Scene, html: string) => void
  onSelect: () => void
  onToggleExpand: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id })
  const bookmarkColor = useUiStore((s) => s.bookmarkColor)
  const syn = scene.synopsis || scene.autoSynopsis || ''
  const isAuto = !scene.synopsis && !!scene.autoSynopsis
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onDoubleClick={onToggleExpand}
      className="flex flex-col px-4 py-2 cursor-grab select-none border-l-2 transition-colors"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: isActive
          ? (isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)')
          : 'transparent',
        borderLeftColor: isActive ? '#818cf8' : (scene.colorTag || 'transparent'),
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[13px] font-bold shrink-0" style={{ color: TYPE_COLOR[scene.type] || '#a5b4fc' }}>
          {scene.number}.
        </span>
        <span className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>
          {scene.type}. {scene.location}{scene.sublocation ? `.${scene.sublocation}` : ''} — {scene.time}
        </span>
        <StoryDayBadge mode={scene.mode} storyDay={scene.storyDay} isDark={isDark} compact />
        {scene.isBookmarked && (
          <Bookmark size={11} fill="currentColor" className="shrink-0" style={{ color: bookmarkColor }} />
        )}
        <span className="ml-auto flex items-center gap-3 shrink-0 text-[11px]" style={{ color: textSecondary }}>
          {scene.cast && scene.cast.length > 0 && (
            <span className="truncate max-w-[180px]">{scene.cast.slice(0, 3).join(', ')}{scene.cast.length > 3 ? ` +${scene.cast.length - 3}` : ''}</span>
          )}
          {scene.pages != null && <span>{scene.pages.toFixed(1)} стр</span>}
          {scene.duration != null && (
            <span className="flex items-center gap-1"><Clock size={11} />{formatDuration(scene.duration)}</span>
          )}
        </span>
      </div>
      {withSynopsis && syn && !isExpanded && (
        <div className="text-[11px] leading-snug mt-0.5 pl-8 truncate" style={{ color: textSecondary, fontStyle: isAuto ? 'italic' : undefined }}>
          {isAuto ? `${syn} · авто` : syn}
        </div>
      )}
      {isExpanded && (
        <div
          className="mt-1.5 cursor-default"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <SceneTextEditor
            key={`${scene.id}-${index}`}
            initialHtml={getSceneHtml(scene, index)}
            sceneNumber={scene.number}
            scriptFormat={scriptFormat}
            isDark={isDark}
            maxHeight={320}
            onSaveHtml={(html) => onSaveSceneHtml(scene, html)}
          />
        </div>
      )}
    </div>
  )
}

/** T-136: «Каркас сцен» — документ, свёрнутый до шапок (± синопсис).
 *  Двойной клик разворачивает сцену встроенным редактором — сцены
 *  разворачиваются независимо, сворачиваются только по даблклику.
 *  Перестановка — драг или Alt+↑/↓ по выделенной строке. */
export default function OutlineView({
  scenes, getSceneHtml, onSaveSceneHtml, scriptFormat,
  isDark, withSynopsis, onToggleSynopsis, onClose, onReorder,
}: OutlineViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const textPrimary = isDark ? '#e2e8f0' : '#1f2937'
  const textSecondary = isDark ? '#94a3b8' : '#6b7280'
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = useMemo(() => scenes.map((s) => s.id), [scenes])
  const activeScene = scenes.find((s) => s.id === activeId)

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    onReorder(ids.indexOf(active.id as string), ids.indexOf(over.id as string))
  }

  const moveSelected = (dir: -1 | 1) => {
    const idx = scenes.findIndex((s) => s.id === selectedId)
    if (idx < 0) return
    const to = idx + dir
    if (to < 0 || to >= scenes.length) return
    onReorder(idx, to)
  }

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col overflow-hidden outline-none"
      style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}
      tabIndex={0}
      onKeyDown={(e) => {
        // не ловим клавиши из встроенного редактора сцены
        if ((e.target as HTMLElement).closest('.tiptap-editor')) return
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault()
          moveSelected(e.key === 'ArrowUp' ? -1 : 1)
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const idx = scenes.findIndex((s) => s.id === selectedId)
          const next = Math.max(0, Math.min(scenes.length - 1, idx + (e.key === 'ArrowUp' ? -1 : 1)))
          setSelectedId(scenes[next]?.id ?? null)
        } else if (e.key === 'Enter' && selectedId) {
          toggleExpand(selectedId)
        } else if (e.key === 'Escape') {
          if (expandedIds.size > 0) setExpandedIds(new Set())
          else onClose()
        }
      }}
    >
      {/* Шапка режима */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
        <span className="text-[13px] font-bold" style={{ color: textPrimary }}>Каркас сцен</span>
        <span className="text-[11px]" style={{ color: textSecondary }}>{scenes.length} сцен</span>
        <div className="ml-auto flex items-center rounded-lg overflow-hidden"
          style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}` }}>
          {[
            { v: false, l: 'Шапки' },
            { v: true, l: 'Шапки + синопсис' },
          ].map(({ v, l }) => (
            <button
              key={l}
              onClick={() => { if (v !== withSynopsis) onToggleSynopsis() }}
              className="px-3 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: withSynopsis === v ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: withSynopsis === v ? '#818cf8' : textSecondary,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ color: textSecondary }}
          title="Закрыть каркас (Esc)"
        >
          <X size={15} />
        </button>
      </div>

      {/* Список-скелет */}
      <div className="flex-1 overflow-y-auto py-2">
        {scenes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: textSecondary }}>
            Нет сцен — напишите первую шапку в тексте
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active }) => setActiveId(active.id as string)} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {scenes.map((scene, i) => (
                <OutlineRow
                  key={scene.id}
                  scene={scene}
                  index={i}
                  isActive={selectedId === scene.id}
                  isExpanded={expandedIds.has(scene.id)}
                  isDark={isDark}
                  withSynopsis={withSynopsis}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  scriptFormat={scriptFormat}
                  getSceneHtml={getSceneHtml}
                  onSaveSceneHtml={onSaveSceneHtml}
                  onSelect={() => setSelectedId(scene.id)}
                  onToggleExpand={() => toggleExpand(scene.id)}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeScene && (
                <div className="px-4 py-2 rounded-lg shadow-xl"
                  style={{ background: isDark ? '#1e1e3a' : '#fff', border: '1px solid rgba(99,102,241,0.4)' }}>
                  <span className="text-[13px] font-bold" style={{ color: TYPE_COLOR[activeScene.type] || '#a5b4fc' }}>{activeScene.number}. </span>
                  <span className="text-[13px] font-semibold" style={{ color: textPrimary }}>
                    {activeScene.type}. {activeScene.location} — {activeScene.time}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Подсказка */}
      <div className="px-5 py-2 text-[10px] shrink-0" style={{ color: textSecondary, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}` }}>
        Двойной клик — редактировать сцену в каркасе · ↑/↓ — выбор · Alt+↑/↓ — переместить сцену · драг — перестановка · Esc — свернуть все/выйти
      </div>
    </div>
  )
}
