import { useState, useMemo, memo } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Info,
  ShieldCheck,
  StickyNote,
  GitBranch,
  Users,
  Clock,
  Film,
  FileText,
  ChevronDown,
  ChevronUp,
  Wand2,
} from 'lucide-react'
import type { Scene } from '../../../types/scene'
import type { Character } from '../../../store/scriptStore'
import type { TimingSystem } from '../../../types/scene'

type ErrorSeverity = 'error' | 'warning' | 'info'

interface ValidationIssue {
  id: string
  severity: ErrorSeverity
  category: 'format' | 'scene' | 'character' | 'timing'
  message: string
  suggestion?: string
  autoFixable: boolean
  lineNumber?: number
}

interface ScriptRightPanelProps {
  isDark: boolean
  textPrimary: string
  textSecondary: string
  // Format checking
  blocks: Array<{ id: string; type: string; content: string }>
  format: 'russian' | 'hollywood'
  enableAutoFix: boolean
  onApplyFix?: (blockId: string, suggestion: string) => void
  // Scene & character quality
  scenes: Scene[]
  characters: Character[]
  timingSystem: TimingSystem
}

/* ──────────────────────────────────────────────────────────────── */
/*  Format checking logic (copied from FormatAssistant)           */
/* ──────────────────────────────────────────────────────────────── */
function useFormatValidation(
  blocks: Array<{ id: string; type: string; content: string }>,
  format: 'russian' | 'hollywood'
): ValidationIssue[] {
  return useMemo(() => {
    const issues: ValidationIssue[] = []
    let lineNumber = 1

    blocks.forEach((block) => {
      const content = block.content.trim()

      if (block.type === 'scene_header') {
        const numberPattern = /^\d+(?:-\d+)?\./
        if (!numberPattern.test(content)) {
          issues.push({
            id: `fmt-${block.id}-num`,
            severity: 'error',
            category: 'format',
            message:
              'Заголовок сцены должен начинаться с номера (1., 2. или 1-1., 1-2.)',
            suggestion: `1. ${content}`,
            autoFixable: true,
            lineNumber,
          })
        }

        const scenePattern =
          format === 'russian'
            ? /^\d+(?:-\d+)?\.\s*(ИНТ|ЭКСТ|ИНТ\.\/ЭКСТ|ИНТ\.-ЭКСТ|ИНТ-ЭКСТ)\.?\s*.+$/i
            : /^\d+(?:-\d+)?\.\s*(INT|EXT|INT\.\/EXT|I\/E)\.?\s*.+$/i

        if (!scenePattern.test(content)) {
          issues.push({
            id: `fmt-${block.id}-fmt`,
            severity: 'warning',
            category: 'format',
            message:
              format === 'russian'
                ? 'Формат: НОМЕР. ИНТ/ЭКСТ. ЛОКАЦИЯ — ВРЕМЯ'
                : 'Format: NUMBER. INT/EXT. LOCATION — TIME',
            autoFixable: false,
            lineNumber,
          })
        }
      }

      if (block.type === 'character') {
        if (!/^[А-ЯA-Z\s]+$/.test(content)) {
          issues.push({
            id: `fmt-${block.id}-case`,
            severity: 'warning',
            category: 'format',
            message: 'Имя персонажа должно быть ЗАГЛАВНЫМИ буквами',
            suggestion: content.toUpperCase(),
            autoFixable: true,
            lineNumber,
          })
        }
        if (/\d/.test(content)) {
          issues.push({
            id: `fmt-${block.id}-num`,
            severity: 'error',
            category: 'format',
            message: 'Имя персонажа не должно содержать цифры',
            autoFixable: false,
            lineNumber,
          })
        }
      }

      if (block.type === 'parenthetical') {
        if (!/^\(.*\)$/.test(content)) {
          issues.push({
            id: `fmt-${block.id}-parens`,
            severity: 'error',
            category: 'format',
            message: 'Ремарка должна быть в скобках (текст)',
            suggestion: `(${content.replace(/[()]/g, '')})`,
            autoFixable: true,
            lineNumber,
          })
        }
        if (/^\(\s*\)$/.test(content)) {
          issues.push({
            id: `fmt-${block.id}-empty`,
            severity: 'warning',
            category: 'format',
            message: 'Ремарка не должна быть пустой',
            autoFixable: false,
            lineNumber,
          })
        }
      }

      if (block.type === 'transition') {
        if (!/:$/.test(content)) {
          issues.push({
            id: `fmt-${block.id}-colon`,
            severity: 'warning',
            category: 'format',
            message: 'Переход должен заканчиваться двоеточием',
            suggestion: `${content}:`,
            autoFixable: true,
            lineNumber,
          })
        }
      }

      lineNumber++
    })

    return issues
  }, [blocks, format])
}

/* ──────────────────────────────────────────────────────────────── */
/*  Scene quality checks                                         */
/* ──────────────────────────────────────────────────────────────── */
function useSceneQualityValidation(scenes: Scene[]): ValidationIssue[] {
  return useMemo(() => {
    const issues: ValidationIssue[] = []

    scenes.forEach((scene) => {
      if (!scene.cast || scene.cast.length === 0) {
        issues.push({
          id: `scene-${scene.id}-cast`,
          severity: 'warning',
          category: 'scene',
          message: `Сцена ${scene.number}: не указаны действующие лица`,
          autoFixable: false,
        })
      }
      if (!scene.location || scene.location.trim() === '') {
        issues.push({
          id: `scene-${scene.id}-loc`,
          severity: 'warning',
          category: 'scene',
          message: `Сцена ${scene.number}: не указана локация`,
          autoFixable: false,
        })
      }
      if (!scene.time || scene.time.trim() === '') {
        issues.push({
          id: `scene-${scene.id}-time`,
          severity: 'warning',
          category: 'scene',
          message: `Сцена ${scene.number}: не указано время суток`,
          autoFixable: false,
        })
      }

      // Персонажи в cast без реплик
      if (scene.cast && scene.cast.length > 0 && scene.dialogCharacters) {
        const dialogSet = new Set(scene.dialogCharacters.map((c) => c.toUpperCase()))
        scene.cast.forEach((name) => {
          if (!dialogSet.has(name.toUpperCase())) {
            issues.push({
              id: `scene-${scene.id}-cast-${name}`,
              severity: 'info',
              category: 'scene',
              message: `Сцена ${scene.number}: ${name} в cast, но без реплик`,
              autoFixable: false,
            })
          }
        })
      }
    })

    return issues
  }, [scenes])
}

/* ──────────────────────────────────────────────────────────────── */
/*  Character quality checks                                     */
/* ──────────────────────────────────────────────────────────────── */
function useCharacterValidation(characters: Character[]): ValidationIssue[] {
  return useMemo(() => {
    const issues: ValidationIssue[] = []

    // Дубликаты имён (case-insensitive)
    const nameMap = new Map<string, number>()
    characters.forEach((char) => {
      const key = char.name.toUpperCase().trim()
      nameMap.set(key, (nameMap.get(key) || 0) + 1)
    })

    nameMap.forEach((count, name) => {
      if (count > 1) {
        issues.push({
          id: `char-dup-${name}`,
          severity: 'warning',
          category: 'character',
          message: `Персонаж «${name}» встречается ${count} раз`,
          autoFixable: false,
        })
      }
    })

    return issues
  }, [characters])
}

/* ──────────────────────────────────────────────────────────────── */
/*  Timing validation                                            */
/* ──────────────────────────────────────────────────────────────── */
function useTimingValidation(
  scenes: Scene[],
  timingSystem: TimingSystem
): ValidationIssue[] {
  return useMemo(() => {
    const issues: ValidationIssue[] = []

    if (timingSystem === 'manual') {
      scenes.forEach((scene) => {
        const dur = scene.manualDuration ?? scene.duration ?? 0
        if (dur === 0) {
          issues.push({
            id: `time-${scene.id}-zero`,
            severity: 'warning',
            category: 'timing',
            message: `Сцена ${scene.number}: ручной хронометраж = 0`,
            autoFixable: false,
          })
        }
      })
    }

    return issues
  }, [scenes, timingSystem])
}

/* ──────────────────────────────────────────────────────────────── */
/*  Main component                                               */
/* ──────────────────────────────────────────────────────────────── */
function ScriptRightPanel({
  isDark,
  textPrimary,
  textSecondary,
  blocks,
  format,
  enableAutoFix,
  onApplyFix,
  scenes,
  characters,
  timingSystem,
}: ScriptRightPanelProps) {
  const [activeTab, setActiveTab] = useState<'validation' | 'notes' | 'versions'>(
    'validation'
  )

  /* ── Validation data ── */
  const formatIssues = useFormatValidation(blocks, format)
  const sceneIssues = useSceneQualityValidation(scenes)
  const characterIssues = useCharacterValidation(characters)
  const timingIssues = useTimingValidation(scenes, timingSystem)

  const allIssues = [
    ...formatIssues,
    ...sceneIssues,
    ...characterIssues,
    ...timingIssues,
  ]

  const errorCount = allIssues.filter((i) => i.severity === 'error').length
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length
  const totalCount = allIssues.length

  /* ── Health score ── */
  const maxPossible = 20 // условный потолок
  const healthScore = Math.max(
    0,
    Math.round(100 - (totalCount / maxPossible) * 100)
  )
  const healthColor =
    healthScore >= 80 ? '#22c55e' : healthScore >= 50 ? '#f59e0b' : '#ef4444'

  /* ── Styling ── */
  const panelBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const tabActiveBg = 'rgba(99,102,241,0.15)'
  const tabActiveColor = '#818cf8'

  /* ── Severity helpers ── */
  const severityColor = (s: ErrorSeverity) => {
    switch (s) {
      case 'error':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      case 'info':
        return '#3b82f6'
    }
  }

  const severityIcon = (s: ErrorSeverity) => {
    switch (s) {
      case 'error':
        return <AlertTriangle size={12} style={{ color: '#ef4444' }} />
      case 'warning':
        return <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
      case 'info':
        return <Info size={12} style={{ color: '#3b82f6' }} />
    }
  }

  /* ── Collapsible section ── */
  function Section({
    icon,
    title,
    count,
    children,
  }: {
    icon: React.ReactNode
    title: string
    count: number
    children: React.ReactNode
  }) {
    const [open, setOpen] = useState(count > 0)
    const hasItems = count > 0

    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: `1px solid ${border}`,
          background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        }}
      >
        <button
          className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center gap-2">
            <div style={{ color: textSecondary }}>{icon}</div>
            <span
              className="text-xs font-semibold"
              style={{ color: textPrimary }}
            >
              {title}
            </span>
            {hasItems && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: `${severityColor('error')}20`,
                  color: severityColor('error'),
                }}
              >
                {count}
              </span>
            )}
            {!hasItems && (
              <CheckCircle size={12} style={{ color: '#22c55e' }} />
            )}
          </div>
          {open ? (
            <ChevronDown size={14} style={{ color: textSecondary }} />
          ) : (
            <ChevronUp size={14} style={{ color: textSecondary }} />
          )}
        </button>

        {open && hasItems && (
          <div className="px-3 pb-3 space-y-1.5">{children}</div>
        )}
        {open && !hasItems && (
          <div
            className="px-3 pb-3 text-[11px]"
            style={{ color: textSecondary }}
          >
            Проблем не найдено
          </div>
        )}
      </div>
    )
  }

  /* ── Issue row ── */
  function IssueRow({ issue }: { issue: ValidationIssue }) {
    return (
      <div
        className="flex items-start gap-2 p-2 rounded-lg text-left transition-all"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
          border: `1px solid ${border}`,
        }}
      >
        {severityIcon(issue.severity)}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] leading-tight" style={{ color: textPrimary }}>
            {issue.message}
          </p>
          {issue.lineNumber && (
            <p
              className="text-[10px] mt-0.5"
              style={{ color: textSecondary }}
            >
              Строка {issue.lineNumber}
            </p>
          )}
          {enableAutoFix && issue.suggestion && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onApplyFix?.(issue.id, issue.suggestion!)
              }}
              className="mt-1.5 flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all"
              style={{
                background: 'rgba(99,102,241,0.12)',
                color: '#818cf8',
              }}
            >
              <Wand2 size={10} />
              Исправить
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ── Placeholder tabs ── */
  const PlaceholderTab = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
          style={{
            background: isDark
              ? 'rgba(99,102,241,0.1)'
              : 'rgba(99,102,241,0.05)',
          }}
        >
          {icon}
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: textSecondary }}>
          В разработке
        </p>
      </div>
    </div>
  )

  /* ───────────────────────────────────────────────────────────── */
  /*  Render                                                       */
  /* ───────────────────────────────────────────────────────────── */
  return (
    <div
      className="shrink-0 flex flex-col border-l overflow-hidden"
      style={{ width: 320, background: panelBg, borderColor: border }}
    >
      {/* Tabs */}
      <div
        className="flex items-center gap-1 px-2 py-2 border-b"
        style={{ borderColor: border, background: panelBg }}
      >
        {[
          {
            key: 'validation' as const,
            icon: <ShieldCheck size={14} />,
            label: 'Валидация',
            badge: totalCount,
          },
          {
            key: 'notes' as const,
            icon: <StickyNote size={14} />,
            label: 'Заметки',
            badge: 0,
          },
          {
            key: 'versions' as const,
            icon: <GitBranch size={14} />,
            label: 'Версии',
            badge: 0,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{
              background:
                activeTab === tab.key ? tabActiveBg : 'transparent',
              color:
                activeTab === tab.key
                  ? tabActiveColor
                  : textSecondary,
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge > 0 && activeTab === tab.key && (
              <span
                className="ml-0.5 text-[9px] px-1 py-0 rounded-full"
                style={{
                  background: healthColor,
                  color: '#fff',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Validation tab */}
      {activeTab === 'validation' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Health score */}
          <div
            className="p-3 rounded-xl"
            style={{
              background: isDark
                ? 'rgba(255,255,255,0.03)'
                : '#f8fafc',
              border: `1px solid ${border}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-semibold"
                style={{ color: textPrimary }}
              >
                Готовность сценария
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: healthColor }}
              >
                {healthScore}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${healthScore}%`,
                  background: healthColor,
                }}
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              {errorCount > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle size={10} style={{ color: '#ef4444' }} />
                  <span className="text-[10px]" style={{ color: '#ef4444' }}>
                    {errorCount} ошиб.
                  </span>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle size={10} style={{ color: '#f59e0b' }} />
                  <span className="text-[10px]" style={{ color: '#f59e0b' }}>
                    {warningCount} пред.
                  </span>
                </div>
              )}
              {totalCount === 0 && (
                <div className="flex items-center gap-1">
                  <CheckCircle size={10} style={{ color: '#22c55e' }} />
                  <span className="text-[10px]" style={{ color: '#22c55e' }}>
                    Всё в порядке
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sections */}
          <Section
            icon={<FileText size={14} />}
            title="Форматирование"
            count={formatIssues.length}
          >
            {formatIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </Section>

          <Section
            icon={<Film size={14} />}
            title="Сцены"
            count={sceneIssues.length}
          >
            {sceneIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </Section>

          <Section
            icon={<Users size={14} />}
            title="Персонажи"
            count={characterIssues.length}
          >
            {characterIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </Section>

          <Section
            icon={<Clock size={14} />}
            title="Хронометраж"
            count={timingIssues.length}
          >
            {timingIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </Section>
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <PlaceholderTab
          icon={<StickyNote size={24} style={{ color: isDark ? '#818cf8' : '#6366f1' }} />}
          title="Заметки к сцене"
        />
      )}

      {/* Versions tab */}
      {activeTab === 'versions' && (
        <PlaceholderTab
          icon={<GitBranch size={24} style={{ color: isDark ? '#818cf8' : '#6366f1' }} />}
          title="Версии сценария"
        />
      )}
    </div>
  )
}

export default memo(ScriptRightPanel)
