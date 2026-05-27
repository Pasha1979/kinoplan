import { useState, useMemo } from 'react'
import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp, Wand2 } from 'lucide-react'

export type ErrorSeverity = 'error' | 'warning' | 'info'
export type ErrorRule = 
  | 'scene_number_missing'
  | 'scene_format_invalid'
  | 'character_not_uppercase'
  | 'character_has_numbers'
  | 'parenthetical_no_parens'
  | 'parenthetical_empty'
  | 'transition_no_colon'
  | 'extra_blank_lines'
  | 'dialog_after_action'
  | 'orphan_parenthetical'

export interface FormatError {
  id: string
  blockId: string
  lineNumber: number
  severity: ErrorSeverity
  rule: ErrorRule
  message: string
  suggestion?: string
  autoFixable: boolean
}

interface FormatAssistantProps {
  blocks: Array<{ id: string; type: string; content: string }>
  format: 'russian' | 'hollywood'
  isDark: boolean
  enableAutoFix: boolean
  onErrorClick?: (blockId: string) => void
  onApplyFix?: (blockId: string, suggestion: string) => void
}

export function useFormatChecker({
  blocks,
  format,
  enableAutoFix: _enableAutoFix,
}: Omit<FormatAssistantProps, 'isDark' | 'onErrorClick' | 'onApplyFix'>) {
  const errors = useMemo<FormatError[]>(() => {
    const foundErrors: FormatError[] = []
    let lineNumber = 1

    blocks.forEach((block, index) => {
      const content = block.content.trim()
      
      // Проверка заголовка сцены
      if (block.type === 'scene_header') {
        if (!/^\d+\./.test(content)) {
          foundErrors.push({
            id: `err-${block.id}-num`,
            blockId: block.id,
            lineNumber,
            severity: 'error',
            rule: 'scene_number_missing',
            message: 'Заголовок сцены должен начинаться с номера (1., 2.)',
            suggestion: `1. ${content}`,
            autoFixable: true,
          })
        }
        
        const scenePattern = format === 'russian' 
          ? /^\d+\.\s*(ИНТ|ЭКСТ|ИНТ\.\/ЭКСТ|ИНТ\.\-ЭКСТ)\.?\s*.+$/i
          : /^\d+\.\s*(INT|EXT|INT\.\/EXT|I\/E)\.?\s*.+$/i
          
        if (!scenePattern.test(content)) {
          foundErrors.push({
            id: `err-${block.id}-fmt`,
            blockId: block.id,
            lineNumber,
            severity: 'warning',
            rule: 'scene_format_invalid',
            message: format === 'russian' 
              ? 'Формат: НОМЕР. ИНТ/ЭКСТ. ЛОКАЦИЯ — ВРЕМЯ'
              : 'Format: NUMBER. INT/EXT. LOCATION — TIME',
            autoFixable: false,
          })
        }
      }

      // Проверка имени персонажа
      if (block.type === 'character') {
        if (!/^[А-ЯA-Z\s]+$/.test(content)) {
          foundErrors.push({
            id: `err-${block.id}-case`,
            blockId: block.id,
            lineNumber,
            severity: 'warning',
            rule: 'character_not_uppercase',
            message: 'Имя персонажа должно быть ЗАГЛАВНЫМИ буквами',
            suggestion: content.toUpperCase(),
            autoFixable: true,
          })
        }
        
        if (/\d/.test(content)) {
          foundErrors.push({
            id: `err-${block.id}-num`,
            blockId: block.id,
            lineNumber,
            severity: 'error',
            rule: 'character_has_numbers',
            message: 'Имя персонажа не должно содержать цифры',
            autoFixable: false,
          })
        }
      }

      // Проверка ремарки
      if (block.type === 'parenthetical') {
        if (!/^\(.*\)$/.test(content)) {
          foundErrors.push({
            id: `err-${block.id}-parens`,
            blockId: block.id,
            lineNumber,
            severity: 'error',
            rule: 'parenthetical_no_parens',
            message: 'Ремарка должна быть в скобках (текст)',
            suggestion: `(${content.replace(/[()]/g, '')})`,
            autoFixable: true,
          })
        }
        
        if (/^\(\s*\)$/.test(content)) {
          foundErrors.push({
            id: `err-${block.id}-empty`,
            blockId: block.id,
            lineNumber,
            severity: 'warning',
            rule: 'parenthetical_empty',
            message: 'Ремарка не должна быть пустой',
            autoFixable: false,
          })
        }
      }

      // Проверка перехода
      if (block.type === 'transition') {
        if (!/:$/.test(content)) {
          foundErrors.push({
            id: `err-${block.id}-colon`,
            blockId: block.id,
            lineNumber,
            severity: 'warning',
            rule: 'transition_no_colon',
            message: 'Переход должен заканчиваться двоеточием',
            suggestion: `${content}:`,
            autoFixable: true,
          })
        }
      }

      // Проверка сиротской ремарки (не под персонажем)
      if (block.type === 'parenthetical') {
        const prevBlock = blocks[index - 1]
        if (!prevBlock || prevBlock.type !== 'character') {
          foundErrors.push({
            id: `err-${block.id}-orphan`,
            blockId: block.id,
            lineNumber,
            severity: 'error',
            rule: 'orphan_parenthetical',
            message: 'Ремарка должна идти сразу после имени персонажа',
            autoFixable: false,
          })
        }
      }

      lineNumber++
    })

    return foundErrors.slice(0, 100) // Лимит 100 ошибок
  }, [blocks, format])

  const errorCount = errors.filter(e => e.severity === 'error').length
  const warningCount = errors.filter(e => e.severity === 'warning').length
  const infoCount = errors.filter(e => e.severity === 'info').length
  const autoFixableCount = errors.filter(e => e.autoFixable).length

  return { errors, errorCount, warningCount, infoCount, autoFixableCount }
}

export default function FormatAssistant({
  blocks,
  format,
  isDark,
  enableAutoFix,
  onErrorClick,
  onApplyFix,
}: FormatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')

  const { errors, errorCount, warningCount, infoCount, autoFixableCount } = useFormatChecker({
    blocks,
    format,
    enableAutoFix,
  })

  const filteredErrors = errors.filter(e => filter === 'all' || e.severity === filter)
  const totalCount = errorCount + warningCount + infoCount

  const panelBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'error': return '#ef4444'
      case 'warning': return '#f59e0b'
      case 'info': return '#3b82f6'
    }
  }

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'error': return <AlertTriangle size={14} style={{ color: '#ef4444' }} />
      case 'warning': return <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
      case 'info': return <Info size={14} style={{ color: '#3b82f6' }} />
    }
  }

  if (totalCount === 0) {
    return (
      <div 
        className="shrink-0 flex items-center justify-center px-4 py-2 border-t"
        style={{ background: panelBg, borderColor: border }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle size={14} style={{ color: '#22c55e' }} />
          <span className="text-xs" style={{ color: textSecondary }}>
            Форматирование в порядке
          </span>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="shrink-0 border-t flex flex-col"
      style={{ 
        background: panelBg, 
        borderColor: border,
        maxHeight: isOpen ? '200px' : 'auto',
      }}
    >
      {/* Шапка панели */}
      <div 
        className="flex items-center justify-between px-4 py-2 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} style={{ color: '#ef4444' }} />
            <span className="text-xs font-medium" style={{ color: '#ef4444' }}>
              {errorCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
            <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
              {warningCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Info size={14} style={{ color: '#3b82f6' }} />
            <span className="text-xs font-medium" style={{ color: '#3b82f6' }}>
              {infoCount}
            </span>
          </div>
          {enableAutoFix && autoFixableCount > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              <Wand2 size={12} style={{ color: '#818cf8' }} />
              <span className="text-xs" style={{ color: '#818cf8' }}>
                {autoFixableCount} можно исправить
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: textSecondary }}>
            {isOpen ? 'Скрыть' : 'Показать'} ошибки
          </span>
          {isOpen ? <ChevronDown size={14} style={{ color: textSecondary }} /> : <ChevronUp size={14} style={{ color: textSecondary }} />}
        </div>
      </div>

      {/* Раскрываемая панель с ошибками */}
      {isOpen && (
        <>
          {/* Фильтры */}
          <div className="flex items-center gap-1 px-4 py-2 border-t" style={{ borderColor: border }}>
            {(['all', 'error', 'warning', 'info'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-2 py-1 rounded text-xs font-medium transition-all"
                style={{
                  background: filter === f ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: filter === f ? '#818cf8' : textSecondary,
                }}
              >
                {f === 'all' ? 'Все' : f === 'error' ? 'Ошибки' : f === 'warning' ? 'Предупр.' : 'Инфо'}
              </button>
            ))}
          </div>

          {/* Список ошибок */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {filteredErrors.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: textSecondary }}>
                Нет ошибок выбранного типа
              </p>
            ) : (
              <div className="space-y-2">
                {filteredErrors.map((error) => (
                  <div
                    key={error.id}
                    className="rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`,
                    }}
                    onClick={() => onErrorClick?.(error.blockId)}
                  >
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(error.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: textPrimary }}>
                            Строка {error.lineNumber}
                          </span>
                          <span 
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ 
                              background: `${getSeverityColor(error.severity)}20`,
                              color: getSeverityColor(error.severity),
                            }}
                          >
                            {error.severity === 'error' ? 'Ошибка' : error.severity === 'warning' ? 'Предупр.' : 'Инфо'}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: textSecondary }}>
                          {error.message}
                        </p>
                        
                        {/* Предложение исправления */}
                        {enableAutoFix && error.suggestion && (
                          <div className="mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onApplyFix?.(error.blockId, error.suggestion!)
                              }}
                              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all hover:bg-opacity-20"
                              style={{
                                background: 'rgba(99,102,241,0.15)',
                                color: '#818cf8',
                              }}
                            >
                              <Wand2 size={12} />
                              Исправить: «{error.suggestion}»
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
