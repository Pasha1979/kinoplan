import { useMemo, useState } from 'react'
import { Calendar, Plus, Printer, Trash2 } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useNormalizedProjectStore } from '../../store/useProjectStore'
import { useToastStore } from '../../store/toastStore'
import type { Scene } from '../../types/scene'
import type { ShootingDay } from '../../types/project'
import { buildCallsheetHtml, printHtmlAsPdf } from '../../utils/exportScenes'

/**
 * T-77: стрипборд — сцены-полосы раскладываются по съёмочным дням.
 * Данные: normalized.scenes (проекция из сценария) → project.shootingDays (persist).
 * Дашборд (TodayWidget/WeekAtAGlance) читает те же shootingDays.
 */

// Стандартные цвета полос стрипборда
function stripColor(scene: Scene): string {
  const t = (scene.time || '').toUpperCase()
  if (t.includes('НОЧЬ')) return scene.type === 'ИНТ' ? '#1e3a5f' : '#0f4c3a' // синий/зелёный ночь
  if (t.includes('ВЕЧЕР') || t.includes('ЗАКАТ')) return '#5b3a6e'
  if (t.includes('УТРО') || t.includes('РАССВЕТ')) return '#7a5a1e'
  return scene.type === 'ЭКСТ' ? '#8a6d1a' : '#6b7280' // день: ЭКСТ жёлтый, ИНТ серый
}

function stripTextColor(scene: Scene): string {
  const t = (scene.time || '').toUpperCase()
  return t.includes('ДЕНЬ') || t.includes('НЕПРЕРЫВ') ? '#fff' : '#e5e7eb'
}

export default function SchedulePage() {
  const { theme } = useUiStore()
  const isDark = theme === 'dark'
  const { projects, scenes, currentProjectId, updateProject } = useNormalizedProjectStore()
  const showToast = useToastStore((s) => s.showToast)
  const [dragSceneId, setDragSceneId] = useState<string | null>(null)

  const project = currentProjectId ? projects[currentProjectId] : null

  const projectScenes = useMemo(
    () => Object.values(scenes)
      .filter((s) => s.projectId === currentProjectId)
      .sort((a, b) => a.number.localeCompare(b.number, 'ru', { numeric: true })),
    [scenes, currentProjectId]
  )
  const sceneById = useMemo(() => new Map(projectScenes.map((s) => [s.id, s])), [projectScenes])

  const days: ShootingDay[] = useMemo(() => project?.shootingDays ?? [], [project?.shootingDays])
  const assigned = useMemo(() => new Set(days.flatMap((d) => d.sceneNumbers ?? [])), [days])
  const pool = useMemo(() => projectScenes.filter((s) => !assigned.has(s.id)), [projectScenes, assigned])

  const setDays = (next: ShootingDay[]) => {
    if (project) updateProject(project.id, { shootingDays: next })
  }

  const addDay = () => {
    const date = new Date()
    date.setDate(date.getDate() + days.length)
    setDays([...days, { date: date.toISOString().slice(0, 10), type: 'shoot', sceneNumbers: [] }])
  }

  const removeDay = (idx: number) => {
    const next = days.map((d, i) => (i === idx ? { ...d, sceneNumbers: [] } : d))
    // сцены дня возвращаются в пул — день удаляем
    setDays(next.filter((_, i) => i !== idx))
  }

  const setDayDate = (idx: number, date: string) => {
    setDays(days.map((d, i) => (i === idx ? { ...d, date } : d)))
  }

  const moveStrip = (sceneId: string, targetDayIdx: number | null) => {
    const next = days.map((d) => ({ ...d, sceneNumbers: (d.sceneNumbers ?? []).filter((id) => id !== sceneId) }))
    if (targetDayIdx !== null) {
      next[targetDayIdx] = { ...next[targetDayIdx], sceneNumbers: [...(next[targetDayIdx].sceneNumbers ?? []), sceneId] }
    }
    setDays(next)
  }

  const onDrop = (dayIdx: number | null) => (e: React.DragEvent) => {
    e.preventDefault()
    if (dragSceneId) moveStrip(dragSceneId, dayIdx)
    setDragSceneId(null)
  }
  const onDragOver = (e: React.DragEvent) => e.preventDefault()

  const printCallsheet = (dayIdx: number) => {
    const day = days[dayIdx]
    const dayScenes = (day.sceneNumbers ?? []).map((id) => sceneById.get(id)).filter(Boolean) as Scene[]
    if (dayScenes.length === 0) {
      showToast('В дне нет сцен — добавьте полосы', 'error')
      return
    }
    printHtmlAsPdf(buildCallsheetHtml(project?.name || 'Проект', dayIdx + 1, day, dayScenes))
  }

  const strip = (s: Scene) => (
    <div
      key={s.id}
      draggable
      onDragStart={() => setDragSceneId(s.id)}
      onDragEnd={() => setDragSceneId(null)}
      className="px-2 py-1 rounded text-[11px] font-medium cursor-grab shrink-0 select-none"
      style={{ background: stripColor(s), color: stripTextColor(s), minWidth: 110 }}
      title={`${s.type}. ${s.location} — ${s.time} · ${s.cast?.length ?? 0} чел.`}
    >
      {s.number}. {s.location}
    </div>
  )

  const dropZoneStyle: React.CSSProperties = {
    border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}>
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: isDark ? '#818cf8' : '#6366f1' }} />
          <span className="text-sm font-semibold" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Стрипборд</span>
          <span className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
            {projectScenes.length} сцен · {pool.length} не распланировано
          </span>
        </div>
        <button
          onClick={addDay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: '#6366f1', color: '#fff' }}
        >
          <Plus size={13} /> День
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {projectScenes.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
            Сцен нет — откройте сценарий, чтобы они подтянулись в расписание
          </div>
        )}

        {/* Пул нераспланированных сцен */}
        <div className="rounded-xl p-3" style={dropZoneStyle} onDrop={onDrop(null)} onDragOver={onDragOver}>
          <div className="text-[11px] font-semibold mb-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            НЕ РАСПЛАНИРОВАНО · {pool.length}
          </div>
          <div className="flex flex-wrap gap-1.5">{pool.map(strip)}</div>
        </div>

        {/* Съёмочные дни */}
        {days.map((day, idx) => {
          const dayScenes = (day.sceneNumbers ?? []).map((id) => sceneById.get(id)).filter(Boolean) as Scene[]
          const pages = dayScenes.reduce((a, s) => a + (s.pages || 0), 0)
          return (
            <div key={idx} className="rounded-xl p-3" style={dropZoneStyle} onDrop={onDrop(idx)} onDragOver={onDragOver}>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-[11px] font-bold" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>
                  ДЕНЬ {idx + 1}
                </span>
                <input
                  type="date"
                  value={day.date}
                  onChange={(e) => setDayDate(idx, e.target.value)}
                  className="text-[11px] rounded px-1.5 py-0.5"
                  style={{ background: isDark ? '#1a1a2e' : '#fff', color: isDark ? '#e5e7eb' : '#111827', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'}` }}
                />
                <span className="text-[11px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                  {dayScenes.length} сцен · {pages.toFixed(1)} стр.
                </span>
                <div className="flex-1" />
                <button onClick={() => printCallsheet(idx)} className="flex items-center gap-1 px-2 py-1 rounded text-[11px]" style={{ color: isDark ? '#9ca3af' : '#6b7280', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}` }} title="Вызывной лист (PDF)">
                  <Printer size={12} /> Вызывной
                </button>
                <button onClick={() => removeDay(idx)} className="p-1 rounded" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} title="Удалить день (сцены вернутся в пул)">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-6">
                {dayScenes.length === 0 && (
                  <span className="text-[11px]" style={{ color: isDark ? '#4b5563' : '#9ca3af' }}>перетащите полосы сцен</span>
                )}
                {dayScenes.map(strip)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
