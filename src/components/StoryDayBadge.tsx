import { storyDayBadgeLabel } from '../utils/storyDay'

interface Props {
  mode?: string
  storyDay?: { kind: 'normal' | 'special'; raw: string } | null
  isDark: boolean
  /** компактный вид для плотных строк (каркас) */
  compact?: boolean
}

/** T-227: бейдж сценарного дня — «ДЕНЬ 32», «НОЧЬ 1», «ФЛЕШБЕК».
 *  Спец-дни (0/−N/+N/Х/ФБ/ФФ) — одним фиолетовым цветом. */
export default function StoryDayBadge({ mode, storyDay, isDark, compact }: Props) {
  const label = storyDayBadgeLabel({ mode, storyDay })
  if (!label) return null
  const special = storyDay?.kind === 'special'
  const bg = special
    ? (isDark ? 'rgba(167,139,250,0.22)' : 'rgba(139,92,246,0.12)')
    : (isDark ? 'rgba(52,211,153,0.16)' : 'rgba(5,150,105,0.10)')
  const color = special
    ? (isDark ? '#c4b5fd' : '#7c3aed')
    : (isDark ? '#6ee7b7' : '#047857')
  return (
    <span
      data-testid="story-day-badge"
      className={`${compact ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'} rounded font-semibold shrink-0`}
      style={{ background: bg, color }}
      title={special ? 'Специальный день — вне счётчика' : `Сценарный день: ${label}`}
    >
      {label}
    </span>
  )
}
