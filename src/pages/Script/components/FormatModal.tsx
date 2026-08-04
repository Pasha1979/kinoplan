import { useMemo } from 'react'
import { Wand2, X, ArrowRight, FileText, Scissors } from 'lucide-react'
import { splitMergedText, formatScreenplayToBlocks, needsSplitting } from '../../../utils/smartFormat'
import type { ScreenplayBlock } from '../../../utils/parseScreenplayText'

interface FormatModalProps {
  isDark: boolean
  rawText: string
  onApply: (formattedHtml: string) => void
  onClose: () => void
}

const BLOCK_LABELS: Record<string, string> = {
  sceneHeader: 'Шапка',
  sceneCast: 'Действующие лица',
  sceneAction: 'Действие',
  sceneCharacter: 'Персонаж',
  sceneParenthetical: 'Ремарка',
  sceneDialog: 'Диалог',
  sceneTransition: 'Переход',
}

const BLOCK_COLORS: Record<string, string> = {
  sceneHeader: '#8b5cf6',
  sceneCast: '#8b5cf6',
  sceneAction: '#6b7280',
  sceneCharacter: '#f59e0b',
  sceneParenthetical: '#ec4899',
  sceneDialog: '#10b981',
  sceneTransition: '#3b82f6',
}

export default function FormatModal({ isDark, rawText, onApply, onClose }: FormatModalProps) {
  const splitting = useMemo(() => needsSplitting(rawText), [rawText])
  const splitText = useMemo(() => (splitting ? splitMergedText(rawText) : rawText), [rawText, splitting])
  const blocks = useMemo<ScreenplayBlock[]>(() => formatScreenplayToBlocks(rawText), [rawText])

  const surfaceBg = isDark ? '#1e1e3a' : '#ffffff'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const accent = '#6366f1'
  const textPrimary = isDark ? '#e5e7eb' : '#1f2937'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const codeBg = isDark ? 'rgba(0,0,0,0.3)' : '#f3f4f6'

  const handleApply = () => {
    const html = blocks.map(b => {
      const attr = b.type.replace(/([A-Z])/g, '-$1').toLowerCase()
      const escaped = b.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<div data-type="${attr}">${escaped}</div>`
    }).join('\n')
    onApply(html)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl"
        style={{ background: surfaceBg, border: `1px solid ${borderColor}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${accent}20` }}>
              <Wand2 size={18} style={{ color: accent }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: textPrimary }}>Автоформатирование</h2>
              <p className="text-xs" style={{ color: textSecondary }}>
                {splitting ? 'Слитый текст обнаружен — будет разбит на строки' : 'Текст уже разбит — блоки будут распознаны'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: textSecondary }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
              {/* Step 1: Split preview */}
              {splitting && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ background: `${accent}20`, color: accent }}>1</div>
                    <Scissors size={14} style={{ color: textSecondary }} />
                    <span className="text-sm font-medium" style={{ color: textPrimary }}>Разбивка слитого текста</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs mb-1.5" style={{ color: textSecondary }}>До:</p>
                      <pre className="text-xs rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap" style={{ background: codeBg, color: textSecondary, border: `1px solid ${borderColor}` }}>
                        {rawText.slice(0, 500)}{rawText.length > 500 ? '...' : ''}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs mb-1.5" style={{ color: textSecondary }}>После:</p>
                      <pre className="text-xs rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap" style={{ background: codeBg, color: textPrimary, border: `1px solid ${accent}40` }}>
                        {splitText.slice(0, 500)}{splitText.length > 500 ? '...' : ''}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Block recognition */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ background: `${accent}20`, color: accent }}>{splitting ? '2' : '1'}</div>
                  <FileText size={14} style={{ color: textSecondary }} />
                  <span className="text-sm font-medium" style={{ color: textPrimary }}>Распознанные блоки ({blocks.length})</span>
                </div>
                <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
                  {blocks.length === 0 ? (
                    <p className="text-sm p-4 text-center" style={{ color: textSecondary }}>Блоки не обнаружены</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {blocks.map((block, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-3 py-2"
                          style={{
                            borderBottom: i < blocks.length - 1 ? `1px solid ${borderColor}` : 'none',
                            background: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
                          }}
                        >
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 mt-0.5"
                            style={{
                              background: `${BLOCK_COLORS[block.type] || '#6b7280'}20`,
                              color: BLOCK_COLORS[block.type] || '#6b7280',
                            }}
                          >
                            {BLOCK_LABELS[block.type] || block.type}
                          </span>
                          <span className="text-xs" style={{ color: textPrimary }}>
                            {block.content.slice(0, 120)}{block.content.length > 120 ? '...' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0" style={{ borderColor }}>
          <span className="text-xs" style={{ color: textSecondary }}>
            {blocks.length > 0 ? `${blocks.length} блоков будет создано` : 'Нет блоков для форматирования'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
              style={{ color: textSecondary, border: `1px solid ${borderColor}` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              Отмена
            </button>
            <button
              onClick={handleApply}
              disabled={blocks.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
              style={{ background: accent, color: '#fff' }}
              onMouseEnter={e => !e.currentTarget.disabled && ((e.currentTarget as HTMLElement).style.background = '#4f46e5')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = accent)}
            >
              <Wand2 size={13} />
              Применить форматирование
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
