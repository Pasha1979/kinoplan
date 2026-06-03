import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, FileText, ClipboardList, Users, TrendingUp, AlertCircle, CheckCircle2, Circle, Clock, Zap, ChevronDown, Info } from 'lucide-react'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import type { ShootingDayType } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTaskStore } from '../../store/taskStore'
import { computeAlerts } from '../../store/alertStore'
import type { AlertLevel } from '../../store/alertStore'

const ALERT_CONFIG: Record<AlertLevel, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  critical: {
    color: '#f87171',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
    icon: <AlertCircle size={15} />,
  },
  warning: {
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.2)',
    icon: <AlertCircle size={15} />,
  },
  info: {
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.08)',
    border: 'rgba(56,189,248,0.2)',
    icon: <Info size={15} />,
  },
}

function SmartAlerts({ project, isDark, navigate }: {
  project: Parameters<typeof computeAlerts>[0]
  isDark: boolean
  navigate: (path: string) => void
}) {
  const alerts = computeAlerts(project)
  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const [open, setOpen] = useState(criticalCount > 0)
  const warningCount  = alerts.filter(a => a.level === 'warning').length

  const cardBg = isDark ? '#1a1a35' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  return (
    <div className="rounded-2xl overflow-hidden mb-8"
      style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      {/* Заголовок — кнопка разворачивания */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle size={16} className="text-orange-400" />
          <span className="font-bold text-sm" style={{ color: textPrimary }}>Smart Alerts</span>
          {/* Превью первого алерта в свёрнутом виде + счётчики */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {!open && alerts.length > 0 && (
              <span className="text-xs max-w-xs truncate" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                {alerts[0].title}
              </span>
            )}
            {criticalCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
              >🔴 {criticalCount}</span>
            )}
            {warningCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
              >🟡 {warningCount}</span>
            )}
            {criticalCount === 0 && warningCount === 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
              >✓ Всё в порядке</span>
            )}
          </div>
        </div>
        <ChevronDown size={15} style={{
          color: textSecondary,
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s',
        }} />
      </button>

      {/* Состояние «всё в порядке» */}
      {!open && criticalCount === 0 && warningCount === 0 && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <CheckCircle2 size={14} className="text-green-400" />
            <span className="text-sm text-green-400">Проект в порядке — критичных проблем нет</span>
          </div>
        </div>
      )}

      {/* Список алертов */}
      {open && (
        <div className="px-6 pb-5 space-y-2.5">
          {alerts.map(alert => {
            const cfg = ALERT_CONFIG[alert.level]
            return (
              <div key={alert.id}
                className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <span className="shrink-0 mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: cfg.color }}>{alert.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: textSecondary }}>{alert.description}</p>
                  {alert.module && (
                    <p className="text-xs mt-1" style={{ color: isDark ? '#374151' : '#d1d5db' }}>Модуль: {alert.module}</p>
                  )}
                </div>
                {alert.action && (
                  <button
                    onClick={() => navigate(alert.action!.path)}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                    style={{ background: cfg.border, color: cfg.color, border: `1px solid ${cfg.border}` }}
                  >
                    {alert.action.label}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Виджет «Сегодня» ──────────────────────────────────────────────────────
interface TodayEvent {
  id: string
  time: string
  title: string
  type: 'shoot' | 'meeting' | 'casting' | 'fitting' | 'scouting' | 'rehearsal'
  location?: string
}

const TODAY_TYPE_CONFIG: Record<TodayEvent['type'], { color: string; bg: string; icon: string }> = {
  shoot:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  icon: '🎬' },
  meeting:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: '📋' },
  casting:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🎭' },
  fitting:   { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', icon: '👗' },
  scouting:  { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: '📍' },
  rehearsal: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  icon: '🎙' },
}

function TodayWidget({ shootingDays, isDark }: {
  shootingDays: import('../../store/projectStore').ShootingDay[]
  isDark: boolean
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayShoot = shootingDays.find(d => d.date === todayStr)
  const events: TodayEvent[] = []

  const cardBg = isDark ? '#1a1a35' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  const todayLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="rounded-2xl overflow-hidden mb-5"
      style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <div>
            <span className="font-bold text-sm" style={{ color: textPrimary }}>Сегодня</span>
            <span className="text-xs ml-2" style={{ color: textSecondary }}>{todayLabel}</span>
          </div>
        </div>
        {todayShoot && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}
          >🎬 Съёмочный день</span>
        )}
      </div>
      <div className="px-6 pb-5 space-y-2">
        {events.map(ev => {
          const cfg = TODAY_TYPE_CONFIG[ev.type]
          return (
            <div key={ev.id} className="flex items-center gap-3 rounded-xl px-4 py-2.5"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}
            >
              <span className="text-base shrink-0">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{ev.title}</p>
                {ev.location && <p className="text-xs" style={{ color: textSecondary }}>{ev.location}</p>}
              </div>
              <span className="text-xs font-bold shrink-0" style={{ color: cfg.color }}>{ev.time}</span>
            </div>
          )
        })}
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <span className="text-2xl">📅</span>
            <p className="text-sm font-medium" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Функция в разработке</p>
            <p className="text-xs text-center" style={{ color: isDark ? '#374151' : '#d1d5db' }}>События из календаря появятся в следующем обновлении</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Onboarding ──────────────────────────────────────────────────────────────
function OnboardingBanner({ isDark, navigate, projectId }: {
  isDark: boolean
  navigate: (p: string) => void
  projectId: string
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const steps = [
    { icon: '📝', title: 'Загрузите сценарий', desc: 'Импортируйте .fdx или .pdf — система разобьёт сцены автоматически', action: () => navigate(`/project/${projectId}/script`), btn: 'К сценарию' },
    { icon: '🎭', title: 'Заполните кастинг', desc: 'Добавьте актёров на роли и отслеживайте статусы', action: () => navigate(`/project/${projectId}/casting`), btn: 'К кастингу' },
    { icon: '📍', title: 'Добавьте локации', desc: 'Прикрепите фото, адреса и документы по каждому объекту', action: () => navigate(`/project/${projectId}/locations`), btn: 'К локациям' },
    { icon: '📅', title: 'Составьте расписание', desc: 'Создайте стрипборд и распределите сцены по дням', action: () => navigate(`/project/${projectId}/schedule`), btn: 'К расписанию' },
  ]

  const cardBg = isDark ? '#1a1a35' : '#ffffff'
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  return (
    <div className="rounded-2xl overflow-hidden mb-8"
      style={{ background: cardBg, border: '1px solid rgba(56,189,248,0.3)', boxShadow: '0 0 0 2px rgba(56,189,248,0.08)' }}
    >
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">👋</span>
          <div>
            <p className="font-bold text-sm" style={{ color: '#38bdf8' }}>С чего начать?</p>
            <p className="text-xs" style={{ color: textSecondary }}>Пройдите 4 шага чтобы запустить проект</p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: textSecondary, background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}
        >Скрыть</button>
      </div>
      <div className="px-6 pb-5 grid grid-cols-2 gap-3">
        {steps.map((step, i) => (
          <button key={i} onClick={step.action}
            className="text-left rounded-xl p-4 transition-all hover:scale-[1.02]"
            style={{ background: isDark ? 'rgba(56,189,248,0.06)' : 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">{step.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold mb-0.5" style={{ color: textPrimary }}>{step.title}</p>
                <p className="text-xs leading-snug" style={{ color: textSecondary }}>{step.desc}</p>
                <p className="text-xs font-semibold mt-2" style={{ color: '#38bdf8' }}>{step.btn} →</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Радар-диаграмма пре-продакшна ───────────────────────────────────────────
function RadarChart({ data, isDark }: {
  data: { label: string; value: number; color: string }[]
  isDark: boolean
}) {
  const SIZE = 280
  const cx = SIZE / 2; const cy = SIZE / 2; const r = 100
  const n = data.length
  const levels = [25, 50, 75, 100]

  const angleOf = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2

  const pointAt = (i: number, radius: number) => ({
    x: cx + radius * Math.cos(angleOf(i)),
    y: cy + radius * Math.sin(angleOf(i)),
  })

  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const axisColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
  const textColor = isDark ? '#9ca3af' : '#6b7280'

  const dataPoints = data.map((d, i) => pointAt(i, (d.value / 100) * r))
  const polyPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'

  return (
    <svg width={SIZE} height={SIZE} style={{ overflow: 'visible' }}>
      {/* Уровни сетки с подписями % */}
      {levels.map(lvl => {
        const pts = data.map((_, i) => pointAt(i, (lvl / 100) * r))
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
        const labelPt = pointAt(0, (lvl / 100) * r)
        return (
          <g key={lvl}>
            <path d={path} fill="none" stroke={gridColor} strokeWidth={1} />
            <text x={(labelPt.x + cx) / 2} y={(labelPt.y + cy) / 2 - 4}
              textAnchor="middle" fontSize={8} fill={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
            >{lvl}%</text>
          </g>
        )
      })}
      {/* Оси */}
      {data.map((_, i) => {
        const outer = pointAt(i, r)
        return <line key={i} x1={cx} y1={cy} x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)} stroke={axisColor} strokeWidth={1.5} />
      })}
      {/* Заполненный полигон */}
      <path d={polyPath} fill="rgba(249,115,22,0.18)" stroke="rgba(249,115,22,0.7)" strokeWidth={2.5} strokeLinejoin="round" />
      {/* Точки с % подписью */}
      {dataPoints.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill={data[i].color} stroke={isDark ? '#1a1a35' : '#fff'} strokeWidth={2} />
          {data[i].value > 0 && (
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={9}
              fill={data[i].color} fontWeight={700}
            >{data[i].value}%</text>
          )}
        </g>
      ))}
      {/* Подписи осей */}
      {data.map((d, i) => {
        const pt = pointAt(i, r + 22)
        const anchor = pt.x < cx - 8 ? 'end' : pt.x > cx + 8 ? 'start' : 'middle'
        return (
          <text key={i} x={pt.x.toFixed(1)} y={pt.y.toFixed(1)}
            textAnchor={anchor} dominantBaseline="central"
            fontSize={12} fill={textColor} fontWeight={600}
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}

const STATUS_LABELS: Record<string, string> = {
  preproduction: 'Пре-продакшн',
  shooting: 'В съёмке',
  postproduction: 'Пост-продакшн',
  completed: 'Завершён',
}

function ShootingChart({ total, shot, scheduled, isDark }: {
  total: number; shot: number; scheduled: number; isDark: boolean
}) {
  const r = 72
  const cx = 96
  const cy = 96
  const stroke = 14
  const circ = 2 * Math.PI * r

  const safeTotal = total || 1
  const shotPct   = Math.min(shot / safeTotal, 1)
  const schedPct  = Math.min(scheduled / safeTotal, 1)
  const freePct   = Math.max(1 - schedPct, 0)

  // Сегменты: снято (оранжевый) → запланировано (фиолетовый) → не запланировано (серый)
  const shotLen   = circ * shotPct
  const schedLen  = circ * (schedPct - shotPct)
  const freeLen   = circ * freePct

  const gap = 0
  const rotate = -90 // начало с 12 часов

  if (shot === 0 && scheduled === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6 w-full">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={isDark ? '#4b5563' : '#d1d5db'} strokeWidth={1.5}>
            <circle cx={12} cy={12} r={10}/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-center" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Съёмки ещё не начались</p>
        <p className="text-xs text-center" style={{ color: isDark ? '#374151' : '#d1d5db' }}>Заполните расписание в модуле «Планирование»</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 192, height: 192 }}>
        <svg width={192} height={192}>
          <g transform={`rotate(${rotate} ${cx} ${cy})`}>
            {/* Фоновое кольцо */}
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}
              strokeWidth={stroke}
            />
            {/* Не запланировано (серый) — рисуем первым */}
            {freeLen > 0 && (
              <circle cx={cx} cy={cy} r={r} fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}
                strokeWidth={stroke}
                strokeDasharray={`${freeLen - gap} ${circ - freeLen + gap}`}
                strokeDashoffset={-(shotLen + schedLen)}
                strokeLinecap="round"
              />
            )}
            {/* Запланировано (фиолетовый) */}
            {schedLen > 0 && (
              <circle cx={cx} cy={cy} r={r} fill="none"
                stroke="#a78bfa"
                strokeWidth={stroke}
                strokeDasharray={`${schedLen - gap} ${circ - schedLen + gap}`}
                strokeDashoffset={-shotLen}
                strokeLinecap="round"
              />
            )}
            {/* Снято (оранжевый) */}
            {shotLen > 0 && (
              <circle cx={cx} cy={cy} r={r} fill="none"
                stroke="#f97316"
                strokeWidth={stroke}
                strokeDasharray={`${shotLen - gap} ${circ - shotLen + gap}`}
                strokeDashoffset={0}
                strokeLinecap="round"
              />
            )}
          </g>
        </svg>
        {/* Центральный текст */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color: isDark ? '#fff' : '#111' }}>{shot}</span>
          <span className="text-xs mt-0.5" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>из {total} дней</span>
        </div>
      </div>

      {/* Легенда */}
      <div className="flex flex-col gap-2.5 mt-4 w-full">
        {[
          { color: '#f97316', label: 'Снято', value: shot },
          { color: '#a78bfa', label: 'Запланировано', value: scheduled - shot },
          { color: isDark ? 'rgba(255,255,255,0.18)' : '#d1d5db', label: 'Не запланировано', value: Math.max(total - scheduled, 0) },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{item.label}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: isDark ? '#e5e7eb' : '#111' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Week at a Glance ────────────────────────────────────────────────────────

const DAY_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']

const DAY_TYPE_CONFIG: Record<ShootingDayType, { label: string; color: string; bg: string; darkBg: string }> = {
  // Съёмочные
  shoot:           { label: 'Съёмка',       color: '#f97316', bg: 'rgba(249,115,22,0.15)',  darkBg: 'rgba(249,115,22,0.2)' },
  conflict:        { label: 'Конфликт',     color: '#f87171', bg: 'rgba(248,113,113,0.15)', darkBg: 'rgba(248,113,113,0.2)' },
  // Пре-продакшн — люди
  rehearsal:       { label: 'Репетиция',    color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', darkBg: 'rgba(167,139,250,0.2)' },
  stunt_rehearsal: { label: 'Трюки',        color: '#c084fc', bg: 'rgba(192,132,252,0.15)', darkBg: 'rgba(192,132,252,0.2)' },
  casting_session: { label: 'Кастинг',      color: '#facc15', bg: 'rgba(250,204,21,0.15)',  darkBg: 'rgba(250,204,21,0.2)' },
  fitting:         { label: 'Примерка',     color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  darkBg: 'rgba(74,222,128,0.2)' },
  // Пре-продакшн — подготовка
  scouting:        { label: 'Скаутинг',     color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  darkBg: 'rgba(251,146,60,0.2)' },
  tech_survey:     { label: 'Осмотр',       color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', darkBg: 'rgba(148,163,184,0.2)' },
  vfx_prep:        { label: 'VFX-подг.',    color: '#67e8f9', bg: 'rgba(103,232,249,0.15)', darkBg: 'rgba(103,232,249,0.2)' },
  table_read:      { label: 'Читка',        color: '#818cf8', bg: 'rgba(129,140,248,0.15)', darkBg: 'rgba(129,140,248,0.2)' },
  meeting:         { label: 'Собрание',     color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  darkBg: 'rgba(251,191,36,0.2)' },
  // Логистика / прочее
  travel:          { label: 'Переезд',      color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',  darkBg: 'rgba(56,189,248,0.2)' },
  holiday:         { label: 'Праздник',     color: '#86efac', bg: 'rgba(134,239,172,0.15)', darkBg: 'rgba(134,239,172,0.2)' },
  day_off:         { label: 'Выходной',     color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  darkBg: 'rgba(107,114,128,0.15)' },
}

function WeekAtAGlance({ shootingDays, isDark }: {
  shootingDays: import('../../store/projectStore').ShootingDay[]
  isDark: boolean
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const found = shootingDays.find(s => s.date === iso)
    return { date: d, iso, data: found ?? null }
  })

  const textPrimary   = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'
  const cardBg        = isDark ? '#1a1a35' : '#ffffff'
  const border        = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  const emptyBg       = isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb'

  return (
    <div className="rounded-2xl p-6"
      style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-sm" style={{ color: textPrimary }}>Ближайшие 7 дней</h3>
        <span className="text-xs" style={{ color: textSecondary }}>
          {days.filter(d => d.data?.type === 'shoot').length} съёмочных
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map(({ date, iso, data }) => {
          const isToday = iso === today.toISOString().slice(0, 10)
          const cfg = data ? DAY_TYPE_CONFIG[data.type] : null
          const dayNum = date.getDate()
          const dayName = DAY_SHORT[date.getDay()]
          const isWeekend = date.getDay() === 0 || date.getDay() === 6

          return (
            <div key={iso}
              className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-1 transition-all"
              title={data ? `${data.title ?? cfg!.label}${data.location ? ` · ${data.location}` : ''}${data.notes ? `\n${data.notes}` : ''}` : 'Нет данных'}
              style={{
                background: cfg ? (isDark ? cfg.darkBg : cfg.bg) : emptyBg,
                border: isToday ? `2px solid ${cfg?.color ?? '#f97316'}` : '2px solid transparent',
                cursor: data ? 'pointer' : 'default',
              }}
            >
              <span className="text-xs font-semibold" style={{ color: isWeekend ? (isDark ? '#6b7280' : '#d1d5db') : textSecondary }}>
                {dayName}
              </span>
              <span className="text-base font-black" style={{ color: cfg ? cfg.color : (isWeekend ? (isDark ? '#4b5563' : '#d1d5db') : textPrimary) }}>
                {dayNum}
              </span>
              {cfg && (
                <span className="text-xs font-semibold text-center leading-tight" style={{ color: cfg.color, fontSize: '9px' }}>
                  {cfg.label.toUpperCase()}
                </span>
              )}
              {data?.location && (
                <span className="text-center leading-tight" style={{ color: cfg!.color, fontSize: '8px', opacity: 0.8 }}>
                  {data.location.length > 8 ? data.location.slice(0, 7) + '…' : data.location}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4" style={{ borderTop: `1px solid ${border}` }}>
        {(Object.entries(DAY_TYPE_CONFIG) as [ShootingDayType, typeof DAY_TYPE_CONFIG[ShootingDayType]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
            <span className="text-xs" style={{ color: textSecondary }}>{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Task Board мини ──────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG = {
  todo:       { icon: <Circle size={13} />,       color: '#6b7280', label: 'Новая' },
  inProgress: { icon: <Clock size={13} />,        color: '#38bdf8', label: 'В работе' },
  done:       { icon: <CheckCircle2 size={13} />, color: '#4ade80', label: 'Готово' },
  overdue:    { icon: <AlertCircle size={13} />,  color: '#f87171', label: 'Просрочена' },
}

function TaskBoardMini({ projectId, isDark }: { projectId: string; isDark: boolean }) {
  const { getProjectTasks } = useTaskStore()
  const all = getProjectTasks(projectId)
  const tasks = [...all]
    .sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
      if (a.deadline) return -1
      if (b.deadline) return 1
      return 0
    })
    .slice(0, 5)

  const textPrimary   = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'
  const cardBg        = isDark ? '#1a1a35' : '#ffffff'
  const border        = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  const rowBg         = isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb'

  return (
    <div className="rounded-2xl p-6"
      style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm" style={{ color: textPrimary }}>Задачи</h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: textSecondary }}>
          {all.filter(t => t.status !== 'done').length} активных
        </span>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task) => {
            const cfg = TASK_STATUS_CONFIG[task.status]
            const isOverdue = task.status === 'overdue'
            return (
              <div key={task.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                style={{ background: isOverdue ? 'rgba(248,113,113,0.08)' : rowBg }}
              >
                <span className="mt-0.5 shrink-0" style={{ color: cfg.color }}>{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight truncate" style={{ color: textPrimary }}>{task.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
                    {task.module}{task.assignee ? ` · ${task.assignee}` : ''}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="text-2xl">📋</span>
          <p className="text-sm font-medium" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Функция в разработке</p>
          <p className="text-xs text-center" style={{ color: isDark ? '#374151' : '#d1d5db' }}>Управление задачами появится в следующем обновлении</p>
        </div>
      )}
    </div>
  )
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

const ACTIVITY_TYPE_CONFIG = {
  schedule:   { color: '#a78bfa', icon: '📅' },
  callsheet:  { color: '#4ade80', icon: '📋' },
  casting:    { color: '#f97316', icon: '🎭' },
  conflict:   { color: '#f87171', icon: '⚠️' },
  script:     { color: '#38bdf8', icon: '📝' },
  general:    { color: '#6b7280', icon: '💬' },
}

function ActivityFeed({ projectId, isDark }: { projectId: string; isDark: boolean }) {
  const { getProjectActivity } = useTaskStore()
  const events = getProjectActivity(projectId).slice(0, 6)

  const textPrimary   = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'
  const cardBg        = isDark ? '#1a1a35' : '#ffffff'
  const border        = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'

  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60) return 'только что'
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
    return `${Math.floor(diff / 86400)} д назад`
  }

  return (
    <div className="rounded-2xl p-6"
      style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} className="text-orange-400" />
        <h3 className="font-bold text-sm" style={{ color: textPrimary }}>Последние события</h3>
      </div>

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((ev) => {
            const cfg = ACTIVITY_TYPE_CONFIG[ev.type]
            return (
              <div key={ev.id} className="flex items-start gap-3">
                <span className="text-base shrink-0 leading-none mt-0.5">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug" style={{ color: textPrimary }}>{ev.text}</p>
                  <p className="text-xs mt-0.5" style={{ color: textSecondary }}>{timeAgo(ev.timestamp)}</p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="text-2xl">⚡</span>
          <p className="text-sm font-medium" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Функция в разработке</p>
          <p className="text-xs text-center" style={{ color: isDark ? '#374151' : '#d1d5db' }}>Activity Feed появится в следующем обновлении</p>
        </div>
      )}
    </div>
  )
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь']

function MiniCalendar({ startDate, endDate, isDark }: {
  startDate?: string; endDate?: string; isDark: boolean
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Первый день текущего месяца
  const [viewYear, setViewYear] = React.useState(today.getFullYear())
  const [viewMonth, setViewMonth] = React.useState(today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1)
  // Понедельник = 0
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const start = startDate ? new Date(startDate) : null
  const end   = endDate   ? new Date(endDate)   : null
  if (start) start.setHours(0,0,0,0)
  if (end)   end.setHours(0,0,0,0)

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Дополняем до полных недель
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday    = (d: number) => new Date(viewYear, viewMonth, d).getTime() === today.getTime()
  const isStart    = (d: number) => start && new Date(viewYear, viewMonth, d).getTime() === start.getTime()
  const isEnd      = (d: number) => end   && new Date(viewYear, viewMonth, d).getTime() === end.getTime()
  const isInRange  = (d: number) => {
    if (!start || !end) return false
    const t = new Date(viewYear, viewMonth, d).getTime()
    return t > start.getTime() && t < end.getTime()
  }

  const cardBg = isDark ? '#1a1a35' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'
  const cellHover = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="rounded-2xl p-7" style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}>
      {/* Шапка */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-base" style={{ color: textPrimary }}>Календарь проекта</h2>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: textSecondary }}
            onMouseEnter={e => (e.currentTarget.style.background = cellHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >‹</button>
          <span className="text-sm font-semibold px-2 capitalize" style={{ color: textPrimary }}>
            {MONTHS_RU[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: textSecondary }}
            onMouseEnter={e => (e.currentTarget.style.background = cellHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >›</button>
        </div>
      </div>

      {/* Дни недели */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: textSecondary }}>{d}</div>
        ))}
      </div>

      {/* Ячейки */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const inRange = isInRange(day)
          const startDay = isStart(day)
          const endDay = isEnd(day)
          const todayDay = isToday(day)
          const isWeekend = ((i % 7) === 5 || (i % 7) === 6)

          return (
            <div key={i} className="flex items-center justify-center" style={{ height: 36 }}>
              <div
                className="w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all"
                style={{
                  background: startDay || endDay
                    ? 'linear-gradient(135deg, #f97316, #dc2626)'
                    : todayDay
                    ? isDark ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.12)'
                    : inRange
                    ? isDark ? 'rgba(167,139,250,0.15)' : 'rgba(167,139,250,0.1)'
                    : 'transparent',
                  color: startDay || endDay
                    ? '#fff'
                    : todayDay
                    ? '#f97316'
                    : inRange
                    ? '#a78bfa'
                    : isWeekend
                    ? isDark ? '#6b7280' : '#d1d5db'
                    : textPrimary,
                  fontWeight: startDay || endDay || todayDay ? '700' : '400',
                  outline: todayDay && !startDay && !endDay ? `2px solid rgba(249,115,22,0.4)` : 'none',
                }}
              >{day}</div>
            </div>
          )
        })}
      </div>

      {/* Легенда */}
      {(start || end) && (
        <div className="flex flex-wrap gap-4 mt-5 pt-4" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
          {start && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-xs" style={{ color: textSecondary }}>Начало: {start.toLocaleDateString('ru-RU')}</span>
            </div>
          )}
          {end && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs" style={{ color: textSecondary }}>Конец: {end.toLocaleDateString('ru-RU')}</span>
            </div>
          )}
          {start && end && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
              <span className="text-xs" style={{ color: textSecondary }}>
                {Math.round((end.getTime() - start.getTime()) / 86400000)} дней производства
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


export default function DashboardPage() {
  const navigate = useNavigate()
  const { currentProjectId, projects } = useNormalizedProjectStore()
  const { theme } = useUiStore()
  const project = currentProjectId ? projects[currentProjectId] : null

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Проект не выбран
      </div>
    )
  }

  const overallProgress = Math.round(
    (project.scriptProgress + project.castingProgress + project.locationsProgress + project.scheduleProgress) / 4
  )

  const isShooting = project.status === 'shooting'

  // Дни до старта / финиша
  const daysLabel = (() => {
    const now = new Date(); now.setHours(0,0,0,0)
    if (project.startDate) {
      const start = new Date(project.startDate); start.setHours(0,0,0,0)
      const diff = Math.round((start.getTime() - now.getTime()) / 86400000)
      if (diff > 0) return { text: `До старта ${diff} дн.`, color: '#38bdf8' }
    }
    if (project.endDate) {
      const end = new Date(project.endDate); end.setHours(0,0,0,0)
      const diff = Math.round((end.getTime() - now.getTime()) / 86400000)
      if (diff > 0) return { text: `До финиша ${diff} дн.`, color: '#a78bfa' }
      if (diff <= 0) return { text: 'Завершён', color: '#4ade80' }
    }
    return null
  })()

  // Вызывные — заглушка пока нет модуля
  const callSheetsLabel = project.callSheetsSent > 0
    ? `${project.callSheetsConfirmed}/${project.callSheetsSent} вызывных`
    : null

  const moduleCards = [
    {
      icon: <FileText size={22} />,
      label: 'Сценарий',
      value: project.scriptProgress,
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      detail: `${project.scriptProgress}% написано`,
      path: `/project/${project.id}/script`,
      ready: false,
    },
    {
      icon: <Calendar size={22} />,
      label: 'Планирование',
      value: project.scheduleProgress,
      color: 'from-purple-500 to-purple-600',
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      detail: `${project.plannedShootingDays} дней запланировано`,
      path: `/project/${project.id}/schedule`,
      ready: false,
    },
    {
      icon: <ClipboardList size={22} />,
      label: 'Вызывные',
      value: 0,
      color: 'from-green-500 to-green-600',
      textColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      detail: 'Вызывных пока нет',
      path: `/project/${project.id}/callsheets`,
      ready: false,
    },
    {
      icon: <Users size={22} />,
      label: 'Пре-продакшн',
      value: project.castingProgress,
      color: 'from-orange-500 to-orange-600',
      textColor: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
      detail: `Кастинг ${project.castingProgress}%`,
      path: `/project/${project.id}/preproduction`,
      ready: false,
    },
  ]

  const isDark = theme === 'dark'

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: isDark ? '#13132a' : '#f4f4f8' }}>

      {/* Верхняя панель */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-8 py-3 border-b"
        style={{
          background: isDark ? 'rgba(20,20,40,0.9)' : 'rgba(255,255,255,0.9)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          {/* Кнопка возврата к списку проектов */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
            style={{
              color: isDark ? '#9ca3af' : '#6b7280',
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
          >
            ← К проектам
          </button>
          <span style={{ color: isDark ? '#4b5563' : '#d1d5db' }}>|</span>
          <h1 className="font-bold text-base shrink-0" style={{ color: isDark ? '#fff' : '#111' }}>{project.name}</h1>
          <span className="text-xs shrink-0 mx-1" style={{ color: isDark ? '#4b5563' : '#c4c4c4' }}>|</span>
          <span className="text-xs shrink-0" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>{STATUS_LABELS[project.status]}</span>
          {project.plannedShootingDays > 0 && (<>
            <span className="text-xs shrink-0 mx-1" style={{ color: isDark ? '#4b5563' : '#c4c4c4' }}>|</span>
            <span className="text-xs shrink-0" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>🎬 {project.plannedShootingDays} дн.</span>
          </>)}
          {project.shootingGroups > 1 && (<>
            <span className="text-xs shrink-0 mx-1" style={{ color: isDark ? '#4b5563' : '#c4c4c4' }}>|</span>
            <span className="text-xs shrink-0" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>👥 {project.shootingGroups} гр.</span>
          </>)}
          {project.type === 'serial' && project.episodesCount && (<>
            <span className="text-xs shrink-0 mx-1" style={{ color: isDark ? '#4b5563' : '#c4c4c4' }}>|</span>
            <span className="text-xs shrink-0" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>🎥 {project.episodesCount}×{project.episodeDuration} мин</span>
          </>)}
          {project.type !== 'serial' && project.totalDuration && (<>
            <span className="text-xs shrink-0 mx-1" style={{ color: isDark ? '#4b5563' : '#c4c4c4' }}>|</span>
            <span className="text-xs shrink-0" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>⏱ {project.totalDuration} мин</span>
          </>)}
          {project.dailyOutput > 0 && (<>
            <span className="text-xs shrink-0 mx-1" style={{ color: isDark ? '#4b5563' : '#c4c4c4' }}>|</span>
            <span className="text-xs shrink-0" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>{project.dailyOutput} мин/день</span>
          </>)}
        </div>
        <div className="flex items-center gap-2.5">

          {/* Дни до старта / финиша */}
          {daysLabel && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: `${daysLabel.color}18`, border: `1px solid ${daysLabel.color}33` }}
            >
              <Calendar size={13} style={{ color: daysLabel.color }} />
              <span className="text-sm font-semibold" style={{ color: daysLabel.color }}>{daysLabel.text}</span>
            </div>
          )}

          {/* Вызывные X/Y */}
          {callSheetsLabel && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}
            >
              <ClipboardList size={13} className="text-green-400" />
              <span className="text-sm font-semibold text-green-400">{callSheetsLabel}</span>
            </div>
          )}

          {/* Бейдж критичных алертов */}
          {(() => {
            const criticals = computeAlerts(project).filter(a => a.level === 'critical').length
            return criticals > 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <AlertCircle size={13} className="text-red-400" />
                <span className="text-sm font-bold text-red-400">{criticals} критичных</span>
              </div>
            ) : null
          })()}

          {/* % готовности */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}
          >
            <TrendingUp size={14} className="text-orange-400" />
            <span className="text-orange-400 font-bold text-sm">{overallProgress}%</span>
            <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>готовности</span>
          </div>

        </div>
      </header>

      <div className="max-w-5xl mx-auto" style={{ padding: '32px 32px 48px' }}>

        {/* Onboarding — только если проект совсем новый */}
        {overallProgress === 0 && (
          <OnboardingBanner isDark={isDark} navigate={navigate} projectId={project.id} />
        )}

        {/* Виджет «Сегодня» */}
        <TodayWidget shootingDays={project.shootingDays} isDark={isDark} />

        {/* Smart Alerts */}
        <SmartAlerts project={project} isDark={isDark} navigate={navigate} />

        {/* Баннер «ЗАВТРА СЪЁМКА» */}
        {isShooting && (
          <div className="rounded-2xl p-5 flex items-start gap-4 mb-8"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(239,68,68,0.15)' }}
            >
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-red-400 font-bold text-sm uppercase tracking-wide mb-1">Завтра съёмочный день</p>
              <p className="text-sm" style={{ color: isDark ? '#d1d5db' : '#6b7280' }}>
                Вызывной ещё не создан. Перейдите в раздел «Вызывные» для создания.
              </p>
            </div>
            <button onClick={() => navigate(`/project/${project.id}/callsheets`)}
              className="shrink-0 px-4 py-2 rounded-xl text-red-300 text-sm transition-colors hover:bg-red-500/20"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              Создать вызывной →
            </button>
          </div>
        )}

        {/* Карточки модулей */}
        <section style={{ marginBottom: '32px' }}>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-5"
            style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
          >Модули проекта</h2>
          {(() => {
            const minVal = Math.min(...moduleCards.map(c => c.value))
            const weakCard = moduleCards.find(c => c.value === minVal && minVal < 50)
            return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {moduleCards.map((card) => {
              const isWeak = weakCard?.label === card.label
              return (
              <button key={card.label} onClick={() => navigate(card.path)}
                className="rounded-2xl p-6 text-left transition-all duration-200 group"
                style={{
                  background: isDark ? '#1a1a35' : '#ffffff',
                  border: isWeak
                    ? '1px solid rgba(239,68,68,0.4)'
                    : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                  boxShadow: isWeak
                    ? '0 0 0 3px rgba(239,68,68,0.08)'
                    : isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(249,115,22,0.4)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = isDark
                    ? '0 8px 24px rgba(0,0,0,0.3)'
                    : '0 8px 24px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)'
                }}
              >
                <div className={`w-12 h-12 rounded-xl ${card.bgColor} border ${card.borderColor} flex items-center justify-center mb-5 ${card.textColor}`}>
                  {card.icon}
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>
                  {card.label}
                </p>
                <p className="text-xs mb-3" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>{card.detail}</p>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: isDark ? '#4b5563' : '#d1d5db' }}>Готовность</span>
                  <span className="text-sm font-bold" style={{
                    color: card.value >= 70 ? '#4ade80' : card.value >= 30 ? '#fbbf24' : '#f87171'
                  }}>{card.value}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6' }}
                >
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${card.value}%`,
                      background: card.value >= 70 ? '#4ade80' : card.value >= 30 ? '#fbbf24' : '#f87171'
                    }}
                  />
                </div>
                {!card.ready && (
                  <p className="mt-3 text-xs" style={{ color: isDark ? '#374151' : '#d1d5db' }}>В разработке</p>
                )}
                {isWeak && (
                  <p className="mt-2 text-xs font-semibold" style={{ color: '#f87171' }}>⚠ Требует внимания</p>
                )}
              </button>
            )})
          }
          </div>
            )
          })()}
        </section>

        {/* ЗОНА 3 — двухколоночный основной контент */}
        <section style={{ marginBottom: '32px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

            {/* Левая колонка (2/3): таймлайн + ход съёмок */}
            <div className="lg:col-span-2 flex flex-col gap-6 self-stretch">

              {/* «Ближайшие 7 дней» */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
                >Ближайшие 7 дней</h2>
                <WeekAtAGlance shootingDays={project.shootingDays} isDark={isDark} />
              </div>

              {/* Ход съёмок */}
              <div className="flex flex-col flex-1">
                <h2 className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
                >Ход съёмок</h2>

                {project.shotDays === 0 && project.scheduledDays === 0 ? (
                  /* Компактная карточка «Что сделать дальше» когда съёмки не начались */
                  <div className="rounded-2xl p-5 flex flex-col flex-1"
                    style={{
                      background: isDark ? '#1a1a35' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                      boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(249,115,22,0.12)' }}
                      >
                        <span style={{ fontSize: 16 }}>🎬</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Съёмки ещё не начались</p>
                        <p className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Заполните расписание чтобы отслеживать прогресс</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { step: '1', label: 'Загрузите сценарий', icon: '📄', path: `/project/${project.id}/script` },
                        { step: '2', label: 'Составьте КПП', icon: '📅', path: `/project/${project.id}/schedule` },
                        { step: '3', label: 'Создайте вызывной', icon: '📋', path: `/project/${project.id}/callsheets` },
                      ].map(item => (
                        <button key={item.step} onClick={() => navigate(item.path)}
                          className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 transition-all"
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`,
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(249,115,22,0.4)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}
                        >
                          <span style={{ fontSize: 20 }}>{item.icon}</span>
                          <span className="text-xs text-center font-medium leading-tight" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (

                <div className="rounded-2xl p-7"
                  style={{
                    background: isDark ? '#1a1a35' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                    boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
                  }}
                >
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="shrink-0">
                      <ShootingChart
                        total={project.plannedShootingDays}
                        shot={project.shotDays}
                        scheduled={project.scheduledDays}
                        isDark={isDark}
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <h3 className="font-bold text-base mb-1" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>
                        {project.plannedShootingDays} съёмочных дней
                      </h3>
                      <p className="text-sm mb-6" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                        {project.shootingGroups > 1 ? `${project.shootingGroups} съёмочные группы · ` : ''}
                        Выработка {project.dailyOutput} мин/день
                      </p>
                      <div className="space-y-4">
                        {[
                          { label: 'Снято', value: project.shotDays, color: '#f97316',
                            pct: project.plannedShootingDays ? Math.round(project.shotDays / project.plannedShootingDays * 100) : 0 },
                          { label: 'Запланировано в расписании', value: project.scheduledDays, color: '#a78bfa',
                            pct: project.plannedShootingDays ? Math.round(project.scheduledDays / project.plannedShootingDays * 100) : 0 },
                          { label: 'Требуется ещё', value: Math.max(project.plannedShootingDays - project.scheduledDays, 0),
                            color: isDark ? 'rgba(255,255,255,0.25)' : '#9ca3af',
                            pct: project.plannedShootingDays ? Math.round(Math.max(project.plannedShootingDays - project.scheduledDays, 0) / project.plannedShootingDays * 100) : 0 },
                        ].map((row) => (
                          <div key={row.label}>
                            <div className="flex justify-between items-baseline mb-1.5">
                              <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{row.label}</span>
                              <span className="text-sm font-bold" style={{ color: isDark ? '#e5e7eb' : '#111' }}>
                                {row.value} дн. <span className="font-normal text-xs" style={{ color: isDark ? '#4b5563' : '#d1d5db' }}>({row.pct}%)</span>
                              </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${row.pct}%`, background: row.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                )}{/* конец тернара shotDays===0 */}
              </div>

            </div>{/* /левая колонка */}

            {/* Правая колонка (1/3): задачи + события */}
            <div className="flex flex-col gap-6">
              <TaskBoardMini projectId={project.id} isDark={isDark} />
              <ActivityFeed  projectId={project.id} isDark={isDark} />
            </div>

          </div>
        </section>

        {/* ЗОНА 4 — Радар + Календарь */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Радар пре-продакшна */}
          <div className="rounded-2xl p-6"
            style={{
              background: isDark ? '#1a1a35' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
              boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Готовность пре-продакшна</h2>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(249,115,22,0.12)' }}>
                <span className="text-lg font-black text-orange-400">{overallProgress}</span>
                <span className="text-xs text-orange-400 font-bold">%</span>
              </div>
            </div>
            <div className="flex justify-center">
              <RadarChart
                isDark={isDark}
                data={[
                  { label: 'Сценарий',    value: project.scriptProgress,    color: '#60a5fa' },
                  { label: 'Кастинг',     value: project.castingProgress,   color: '#fb923c' },
                  { label: 'Локации',     value: project.locationsProgress, color: '#4ade80' },
                  { label: 'Расписание',  value: project.scheduleProgress,  color: '#a78bfa' },
                  { label: 'Костюмы',     value: 20,  color: '#f472b6' },
                  { label: 'Грим',        value: 10,  color: '#f59e0b' },
                  { label: 'Реквизит',    value: 35,  color: '#34d399' },
                  { label: 'VFX',         value: 5,   color: '#38bdf8' },
                ]}
              />
            </div>
          </div>

          {/* Календарь */}
          <MiniCalendar startDate={project.startDate} endDate={project.endDate} isDark={isDark} />

        </div>

      </div>
    </div>
  )
}
