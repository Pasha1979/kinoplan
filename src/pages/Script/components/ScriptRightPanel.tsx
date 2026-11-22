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
  X,
} from 'lucide-react'
import type { Scene } from '../../../types/scene'
import type { Character } from '../../../store/scriptStore'
import type { TimingSystem } from '../../../types/scene'
import { validateFormatBlocks, type ValidationIssue, type ErrorSeverity } from '../../../utils/formatValidation'
import ContextMenu from '../../Home/ContextMenu'
import { Layers } from 'lucide-react'

export type { ValidationIssue }

/* ── Severity helpers (module-level — чистые) ── */
const severityColor = (s: ErrorSeverity) => {
  switch (s) {
    case 'error': return '#ef4444'
    case 'warning': return '#f59e0b'
    case 'info': return '#3b82f6'
  }
}

const severityIcon = (s: ErrorSeverity) => {
  switch (s) {
    case 'error': return <AlertTriangle size={12} style={{ color: '#ef4444' }} />
    case 'warning': return <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
    case 'info': return <Info size={12} style={{ color: '#3b82f6' }} />
  }
}

interface SectionProps {
  icon: React.ReactNode
  title: string
  count: number
  isDark: boolean
  border: string
  textPrimary: string
  textSecondary: string
  children: React.ReactNode
}

/* Сворачиваемая секция — вынесена из render: иначе каждый рендер панели
 * перемонтировал её и сбрасывал состояние «открыто/закрыто» */
function Section({ icon, title, count, isDark, border, textPrimary, textSecondary, children }: SectionProps) {
  const [open, setOpen] = useState(count > 0)
  const hasItems = count > 0

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
    >
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <div style={{ color: textSecondary }}>{icon}</div>
          <span className="text-xs font-semibold" style={{ color: textPrimary }}>{title}</span>
          {hasItems ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: `${severityColor('error')}20`, color: severityColor('error') }}>
              {count}
            </span>
          ) : (
            <CheckCircle size={12} style={{ color: '#22c55e' }} />
          )}
        </div>
        {open ? <ChevronDown size={14} style={{ color: textSecondary }} /> : <ChevronUp size={14} style={{ color: textSecondary }} />}
      </button>
      {open && hasItems && <div className="px-3 pb-3 space-y-1.5">{children}</div>}
      {open && !hasItems && (
        <div className="px-3 pb-3 text-[11px]" style={{ color: textSecondary }}>Проблем не найдено</div>
      )}
    </div>
  )
}

interface GroupRowProps {
  members: ValidationIssue[]
  label: string
  isDark: boolean
  border: string
  textPrimary: string
  textSecondary: string
  onMenu: (e: React.MouseEvent) => void
  renderIssue: (issue: ValidationIssue) => React.ReactNode
}

/* Свёрнутая группа одинаковых проблем — module-level по той же причине */
function GroupRow({ members, label, isDark, border, textPrimary, textSecondary, onMenu, renderIssue }: GroupRowProps) {
  const [open, setOpen] = useState(false)
  const sevColor = severityColor(members[0].severity)
  return (
    <div className="rounded-lg overflow-hidden"
      style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', border: `1px solid ${border}` }}>
      <div
        className="flex items-start gap-2 p-2 cursor-pointer"
        onClick={() => setOpen(!open)}
        onContextMenu={onMenu}
        title="Клик — развернуть · ПКМ — действия с группой"
      >
        <Layers size={12} className="mt-0.5 shrink-0" style={{ color: sevColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] leading-tight" style={{ color: textPrimary }}>{label}</p>
          <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>{members.length} одинаковых</p>
        </div>
        {open ? <ChevronUp size={12} style={{ color: textSecondary }} /> : <ChevronDown size={12} style={{ color: textSecondary }} />}
      </div>
      {open && <div className="px-2 pb-2 space-y-1.5">{members.map(renderIssue)}</div>}
    </div>
  )
}

interface ScriptRightPanelProps {
  isDark: boolean
  textPrimary: string
  textSecondary: string
  // Format checking
  blocks: Array<{ id: string; type: string; content: string }>
  format: 'russian' | 'hollywood'
  /** Сценарные дни: валидация режим+день в шапках (по типу проекта, Ч3 — переключатель) */
  storyDays?: boolean
  enableAutoFix: boolean
  onApplyFix?: (issue: ValidationIssue, suggestion?: string) => void
  /** Клик по ошибке → переход к сцене */
  onIssueClick?: (issue: ValidationIssue) => void
  /** ID пропущенных автором проблем валидации */
  dismissedIssueIds?: string[]
  /** Пропустить проблему (скрыть осознанно) */
  onDismissIssue?: (issueId: string) => void
  /** Пропустить сразу группу одинаковых проблем */
  onDismissIssues?: (issueIds: string[]) => void
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
  format: 'russian' | 'hollywood',
  storyDays: boolean
): ValidationIssue[] {
  return useMemo(() => validateFormatBlocks(blocks, format, { storyDays }), [blocks, format, storyDays])
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
          sceneId: scene.id,
          severity: 'warning',
          category: 'scene',
          message: `Сцена ${scene.number}: не указаны действующие лица`,
          autoFixable: false,
        })
      }
      if (!scene.location || scene.location.trim() === '') {
        issues.push({
          id: `scene-${scene.id}-loc`,
          sceneId: scene.id,
          severity: 'warning',
          category: 'scene',
          message: `Сцена ${scene.number}: не указана локация`,
          autoFixable: false,
        })
      }
      if (!scene.time || scene.time.trim() === '') {
        issues.push({
          id: `scene-${scene.id}-time`,
          sceneId: scene.id,
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
              sceneId: scene.id,
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
            sceneId: scene.id,
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
  storyDays = false,
  enableAutoFix,
  onApplyFix,
  scenes,
  characters,
  timingSystem,
  onIssueClick,
  dismissedIssueIds = [],
  onDismissIssue,
  onDismissIssues,
}: ScriptRightPanelProps) {
  const [activeTab, setActiveTab] = useState<'validation' | 'notes' | 'versions'>(
    'validation'
  )
  const [fixPopup, setFixPopup] = useState<{ issue: ValidationIssue; x: number; y: number } | null>(null)
  const [groupRules, setGroupRules] = useState<Set<string>>(new Set())
  const [groupPopup, setGroupPopup] = useState<{ ruleKey: string; members: ValidationIssue[]; x: number; y: number } | null>(null)

  /* ── Validation data ── */
  const formatIssues = useFormatValidation(blocks, format, storyDays)
  const sceneIssues = useSceneQualityValidation(scenes)
  const characterIssues = useCharacterValidation(characters)
  const timingIssues = useTimingValidation(scenes, timingSystem)

  const dismissedSet = useMemo(() => new Set(dismissedIssueIds), [dismissedIssueIds])

  /** Ключ правила валидации: одинаковые ошибки = один ключ.
   *  `scene-<uuid>-cast` → `cast` · `fmt-<block>-num` → `num` · `char-dup-X` → `char-dup` */
  const ruleKeyOf = (i: ValidationIssue): string => {
    if (i.sceneId) return i.id.replace(`${i.sceneId}-`, '')
    const parts = i.id.split('-')
    return i.category === 'character' ? parts.slice(0, -1).join('-') : parts[parts.length - 1]
  }

  /** Число единомышленников проблемы (для кнопки «сгруппировать») */
  const siblingsOf = (issue: ValidationIssue, pool: ValidationIssue[]) =>
    pool.filter((j) => ruleKeyOf(j) === ruleKeyOf(issue))

  const allIssues = [
    ...formatIssues,
    ...sceneIssues,
    ...characterIssues,
    ...timingIssues,
  ].filter((i) => !dismissedSet.has(i.id))

  const errorCount = allIssues.filter((i) => i.severity === 'error').length
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length
  const totalCount = allIssues.length
  const fixableIssues = allIssues.filter((i) => i.autoFixable && i.suggestion && onApplyFix)

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

  /* ── Issue row ── */
  function IssueRow({ issue }: { issue: ValidationIssue }) {
    const clickable = !!(issue.sceneId || issue.sceneNumber) && !!onIssueClick
    return (
      <div
        onClick={clickable ? () => onIssueClick(issue) : undefined}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setFixPopup({ issue, x: e.clientX, y: e.clientY })
        }}
        className="flex items-start gap-2 p-2 rounded-lg text-left transition-all"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
          border: `1px solid ${border}`,
          cursor: clickable ? 'pointer' : 'default',
        }}
        title={clickable ? 'Перейти к сцене · ПКМ — подробности' : 'ПКМ — подробности'}
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
                onApplyFix?.(issue)
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
        {onDismissIssue && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDismissIssue(issue.id)
            }}
            title="Пропустить — скрыть эту проблему"
            className="shrink-0 p-1 rounded-md transition-all"
            style={{ color: textSecondary }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fb923c'; e.currentTarget.style.background = 'rgba(251,146,60,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = textSecondary; e.currentTarget.style.background = 'transparent' }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    )
  }

  /** Рендер списка проблем секции с учётом включённых группировок */
  const renderIssues = (list: ValidationIssue[]) => {
    const grouped = new Map<string, ValidationIssue[]>()
    const rows: ValidationIssue[] = []
    list.forEach((i) => {
      const k = ruleKeyOf(i)
      if (groupRules.has(k)) {
        const arr = grouped.get(k) ?? []
        arr.push(i)
        grouped.set(k, arr)
      } else {
        rows.push(i)
      }
    })
    return (
      <>
        {rows.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
        {[...grouped.entries()].map(([k, members]) => (
          <GroupRow
            key={k}
            members={members}
            label={members[0].message.replace(/^Сцена [^:]+:\s*/, '')}
            isDark={isDark}
            border={border}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            onMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setGroupPopup({ ruleKey: k, members, x: e.clientX, y: e.clientY })
            }}
            renderIssue={(issue) => <IssueRow key={issue.id} issue={issue} />}
          />
        ))}
      </>
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

          {/* Исправить всё */}
          {fixableIssues.length > 0 && (
            <button
              onClick={() => fixableIssues.forEach((issue) => onApplyFix!(issue))}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(251,146,60,0.12))',
                border: '1px solid rgba(249,115,22,0.4)',
                color: '#fb923c',
              }}
            >
              <Wand2 size={13} />
              Исправить все ({fixableIssues.length})
            </button>
          )}

          {/* Sections */}
          <Section
            isDark={isDark}
            border={border}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            icon={<FileText size={14} />}
            title="Форматирование"
            count={formatIssues.filter((i) => !dismissedSet.has(i.id)).length}
          >
            {renderIssues(formatIssues.filter((i) => !dismissedSet.has(i.id)))}
          </Section>

          <Section
            isDark={isDark}
            border={border}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            icon={<Film size={14} />}
            title="Сцены"
            count={sceneIssues.filter((i) => !dismissedSet.has(i.id)).length}
          >
            {renderIssues(sceneIssues.filter((i) => !dismissedSet.has(i.id)))}
          </Section>

          <Section
            isDark={isDark}
            border={border}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            icon={<Users size={14} />}
            title="Персонажи"
            count={characterIssues.filter((i) => !dismissedSet.has(i.id)).length}
          >
            {renderIssues(characterIssues.filter((i) => !dismissedSet.has(i.id)))}
          </Section>

          <Section
            isDark={isDark}
            border={border}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            icon={<Clock size={14} />}
            title="Хронометраж"
            count={timingIssues.filter((i) => !dismissedSet.has(i.id)).length}
          >
            {renderIssues(timingIssues.filter((i) => !dismissedSet.has(i.id)))}
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

      {/* ── Попап «Подробнее об ошибке» (правый клик по проблеме) ── */}
      {fixPopup && (() => {
        const { issue, x, y } = fixPopup
        const variants = issue.suggestions?.length ? issue.suggestions : (issue.suggestion ? [issue.suggestion] : [])
        const canFix = !!(issue.autoFixable && variants.length && onApplyFix)
        const left = Math.min(x, window.innerWidth - 340)
        const top = Math.min(y, window.innerHeight - 280)
        const sevColor = severityColor(issue.severity)
        const catLabel =
          issue.category === 'format' ? 'Форматирование'
          : issue.category === 'scene' ? 'Сцена'
          : issue.category === 'character' ? 'Персонаж'
          : 'Хронометраж'
        return (
          <>
            <div
              className="fixed inset-0 z-[90]"
              onClick={() => setFixPopup(null)}
              onContextMenu={(e) => { e.preventDefault(); setFixPopup(null) }}
            />
            <div
              className="fixed z-[95] rounded-2xl overflow-hidden"
              style={{
                left: Math.max(8, left),
                top: Math.max(8, top),
                width: 320,
                background: isDark ? '#1b1b30' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(251,146,60,0.35)' : 'rgba(234,88,12,0.3)'}`,
                boxShadow: '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(251,146,60,0.08)',
              }}
            >
              {/* Шапка */}
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{
                  background: `linear-gradient(135deg, ${sevColor}22, transparent)`,
                  borderBottom: `1px solid ${border}`,
                }}
              >
                {severityIcon(issue.severity)}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: sevColor }}>
                    {catLabel} · {issue.severity === 'error' ? 'Ошибка' : issue.severity === 'warning' ? 'Предупреждение' : 'Заметка'}
                  </p>
                  <p className="text-xs font-semibold leading-tight" style={{ color: textPrimary }}>
                    {issue.message}
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 space-y-2.5">
                {/* Было */}
                {issue.content != null && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: textSecondary }}>
                      Сейчас в тексте
                    </p>
                    <div
                      className="rounded-lg px-2.5 py-2 text-[11px] font-mono leading-snug break-words"
                      style={{
                        background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)',
                        border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'}`,
                        color: textPrimary,
                      }}
                    >
                      {issue.content}
                    </div>
                  </div>
                )}

                {/* Станет */}
                {variants.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: textSecondary }}>
                      {variants.length > 1 ? 'Варианты исправления' : 'После исправления'}
                    </p>
                    <div className="space-y-1.5">
                      {variants.map((v, vi) => (
                        <button
                          key={vi}
                          disabled={!canFix}
                          onClick={() => {
                            onApplyFix!(issue, v)
                            setFixPopup(null)
                          }}
                          className="w-full text-left rounded-lg px-2.5 py-2 text-[11px] font-mono leading-snug break-words transition-all"
                          style={{
                            background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.07)',
                            border: `1px solid ${isDark ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.25)'}`,
                            color: textPrimary,
                            cursor: canFix ? 'pointer' : 'default',
                            opacity: canFix ? 1 : 0.85,
                          }}
                        >
                          {variants.length > 1 && (
                            <span className="block text-[9px] font-sans font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#22c55e' }}>
                              {canFix ? `Вариант ${vi + 1} — нажать чтобы применить` : `Вариант ${vi + 1}`}
                            </span>
                          )}
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!issue.suggestion && variants.length === 0 && (
                  <p className="text-[11px] leading-snug" style={{ color: textSecondary }}>
                    Автоматического исправления для этого предупреждения нет — поправьте вручную в тексте сценария.
                  </p>
                )}
                {issue.suggestion && !issue.autoFixable && enableAutoFix && (
                  <p className="text-[11px] leading-snug" style={{ color: textSecondary }}>
                    Авто-исправление для этого типа недоступно — проверьте предложенный вариант и исправьте вручную.
                  </p>
                )}

                {/* Кнопки */}
                <div className="flex items-center gap-2 pt-1">
                  {canFix && variants.length <= 1 && (
                    <button
                      onClick={() => {
                        onApplyFix(issue)
                        setFixPopup(null)
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: '#f97316', color: '#fff' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fb923c')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#f97316')}
                    >
                      <Wand2 size={13} />
                      Исправить
                    </button>
                  )}
                  {!canFix && (
                    <button
                      onClick={() => setFixPopup(null)}
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', color: textPrimary }}
                    >
                      Понятно
                    </button>
                  )}
                  {canFix && (
                    <button
                      onClick={() => setFixPopup(null)}
                      className="px-3 py-2 rounded-xl text-xs"
                      style={{ color: textSecondary }}
                    >
                      Отмена
                    </button>
                  )}
                </div>
                {onDismissIssue && (
                  <button
                    onClick={() => {
                      onDismissIssue(issue.id)
                      setFixPopup(null)
                    }}
                    className="w-full mt-1.5 py-1.5 rounded-xl text-[11px] transition-all"
                    style={{ color: textSecondary }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#fb923c'; e.currentTarget.style.background = 'rgba(251,146,60,0.08)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = textSecondary; e.currentTarget.style.background = 'transparent' }}
                  >
                    Пропустить — больше не показывать
                  </button>
                )}
                {/* Группировка одинаковых ошибок */}
                {(() => {
                  const key = ruleKeyOf(issue)
                  const siblings = siblingsOf(issue, allIssues)
                  if (groupRules.has(key)) {
                    return (
                      <button
                        onClick={() => {
                          setGroupRules((prev) => { const n = new Set(prev); n.delete(key); return n })
                          setFixPopup(null)
                        }}
                        className="w-full mt-1.5 py-1.5 rounded-xl text-[11px] transition-all flex items-center justify-center gap-1.5"
                        style={{ color: '#818cf8' }}
                      >
                        <Layers size={11} /> Отменить группировку
                      </button>
                    )
                  }
                  if (siblings.length < 2) return null
                  return (
                    <button
                      onClick={() => {
                        setGroupRules((prev) => new Set(prev).add(key))
                        setFixPopup(null)
                      }}
                      className="w-full mt-1.5 py-1.5 rounded-xl text-[11px] transition-all flex items-center justify-center gap-1.5"
                      style={{ color: '#818cf8' }}
                    >
                      <Layers size={11} /> Сгруппировать одинаковые ({siblings.length})
                    </button>
                  )
                })()}
              </div>
            </div>
          </>
        )
      })()}

      {/* Контекстное меню группы одинаковых ошибок */}
      {groupPopup && (
        <ContextMenu
          x={groupPopup.x}
          y={groupPopup.y}
          onClose={() => setGroupPopup(null)}
          header={
            <span>
              {groupPopup.members[0].message.replace(/^Сцена [^:]+:\s*/, '')}
              <span style={{ opacity: 0.6 }}> · {groupPopup.members.length} шт.</span>
            </span>
          }
          items={[
            {
              label: `Пропустить все — больше не показывать (${groupPopup.members.length})`,
              onClick: () => {
                if (onDismissIssues) onDismissIssues(groupPopup.members.map((i) => i.id))
                else groupPopup.members.forEach((i) => onDismissIssue?.(i.id))
                setGroupPopup(null)
              },
            },
            {
              label: 'Отменить группировку',
              onClick: () => {
                setGroupRules((prev) => { const n = new Set(prev); n.delete(groupPopup.ruleKey); return n })
                setGroupPopup(null)
              },
            },
          ]}
        />
      )}
    </div>
  )
}

export default memo(ScriptRightPanel)
