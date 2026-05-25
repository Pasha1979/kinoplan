import { useState } from 'react'
import { X, Film, Tv, Megaphone, Music, Folder, Sparkles, ChevronDown } from 'lucide-react'
import type { Project, ProjectType } from '../../store/projectStore'

interface CreateProjectModalProps {
  onClose: () => void
  onCreate: (project: Project) => void
}

const TYPE_OPTIONS: { value: ProjectType; label: string; sub: string; icon: React.ReactNode }[] = [
  { value: 'film',   label: 'Фильм',    sub: 'Полный метр',    icon: <Film size={18} />      },
  { value: 'serial', label: 'Сериал',   sub: 'Сериал / минисериал', icon: <Tv size={18} />   },
  { value: 'ad',     label: 'Реклама',  sub: 'Рекламный ролик', icon: <Megaphone size={18} /> },
  { value: 'clip',   label: 'Клип',     sub: 'Музыкальный клип', icon: <Music size={18} />   },
  { value: 'other',  label: 'Другое',   sub: 'Иной формат',    icon: <Folder size={18} />    },
]

// SVG логотипы облачных сервисов
const CloudIcons: Record<string, React.ReactNode> = {
  none: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  yandex: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.4 2H13c-3.9 0-6.3 2-6.3 5.3 0 2.7 1.3 4.3 3.8 5.9L7 22h3.2l3.3-8.4h1.1V22H17.6V2h-3.2zm0 9.3h-1c-1.9 0-3-1.1-3-3.2C10.4 5.9 11.5 4.4 13.5 4.4h.9v6.9z"/>
    </svg>
  ),
  vk: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.19 1.365 1.26 2.179 1.815.615.422 1.082.33 1.082.33l2.172-.03s1.136-.071.597-1.09c-.044-.078-.312-.658-1.607-1.862-1.355-1.259-1.173-1.055.459-3.229.999-1.332 1.398-2.146 1.273-2.494-.12-.331-.855-.243-.855-.243l-2.443.015s-.181-.025-.315.055c-.132.078-.216.26-.216.26s-.386 1.03-.9 1.904c-1.086 1.843-1.52 1.94-1.698 1.824-.413-.267-.31-1.075-.31-1.648 0-1.793.272-2.54-.529-2.733-.266-.065-.461-.107-1.141-.115-.872-.008-1.609.004-2.027.208-.278.136-.492.439-.362.456.161.022.526.098.72.362.25.341.242 1.107.242 1.107s.144 2.11-.336 2.372c-.329.18-.781-.187-1.751-1.865-.498-.858-.874-1.808-.874-1.808s-.072-.176-.202-.27c-.156-.115-.375-.151-.375-.151l-2.322.015s-.348.01-.476.161c-.114.135-.009.414-.009.414s1.819 4.256 3.878 6.402c1.889 1.97 4.034 1.84 4.034 1.84h.972z"/>
    </svg>
  ),
  later: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 3"/>
    </svg>
  ),
}

const CLOUD_OPTIONS = [
  { value: 'none',   label: 'На устройстве',  sub: 'Только локально' },
  { value: 'yandex', label: 'Яндекс.Диск',    sub: 'Облачная копия' },
  { value: 'vk',     label: 'VK Cloud',        sub: 'Облачная копия' },
  { value: 'later',  label: 'Настроить позже', sub: 'Выбрать потом' },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        {hint && <span className="text-xs text-gray-600">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/4 border border-white/8 rounded-2xl px-4 py-3 text-white text-sm placeholder-gray-600
        focus:outline-none focus:border-orange-500/60 focus:bg-white/6
        hover:border-white/15 transition-all duration-200"
      style={{ colorScheme: 'dark' }}
    />
  )
}

export default function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ProjectType>('film')
  const [episodesCount, setEpisodesCount] = useState('')
  const [episodeDuration, setEpisodeDuration] = useState('')
  const [totalDuration, setTotalDuration] = useState('')
  const [dailyOutput, setDailyOutput] = useState('')
  const [shootingGroups, setShootingGroups] = useState<1 | 2 | 3>(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cloudStorage, setCloudStorage] = useState<Project['cloudStorage']>('none')
  const [description, setDescription] = useState('')
  const [descOpen, setDescOpen] = useState(false)

  const calcDays = (): number => {
    const daily = parseFloat(dailyOutput)
    if (!daily || daily <= 0) return 0
    if (type === 'serial') {
      const eps = parseFloat(episodesCount)
      const dur = parseFloat(episodeDuration)
      if (!eps || !dur) return 0
      return Math.ceil((eps * dur) / (daily * shootingGroups))
    } else {
      const total = parseFloat(totalDuration)
      if (!total) return 0
      return Math.ceil(total / (daily * shootingGroups))
    }
  }

  const plannedDays = calcDays()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const now = new Date().toISOString()
    const project: Project = {
      id: `project_${Date.now()}`,
      name: name.trim(), type, status: 'preproduction',
      episodesCount: type === 'serial' ? parseInt(episodesCount) || undefined : undefined,
      episodeDuration: type === 'serial' ? parseInt(episodeDuration) || undefined : undefined,
      totalDuration: type !== 'serial' ? parseInt(totalDuration) || undefined : undefined,
      dailyOutput: parseFloat(dailyOutput) || 0,
      shootingGroups, plannedShootingDays: plannedDays,
      startDate: startDate || undefined, endDate: endDate || undefined,
      cloudStorage, createdAt: now, updatedAt: now,
      scriptProgress: 0, castingProgress: 0, locationsProgress: 0, scheduleProgress: 0,
      shotDays: 0, scheduledDays: 0,
      callSheetsSent: 0, callSheetsConfirmed: 0, shootingDays: [],
      locationsTotal: 0, locationsApproved: 0, locationsInScout: 0,
      shotMinutes: 0, totalMinutes: 0, conflicts: 0,
    }
    onCreate(project)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(5,5,15,0.85)', backdropFilter: 'blur(20px)', padding: '32px' }}
    >
      <div
        className="relative w-full mx-auto flex flex-col"
        style={{
          maxWidth: '880px',
          maxHeight: 'calc(100vh - 64px)',
          background: 'linear-gradient(160deg, #1e1e42 0%, #16162e 100%)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '28px',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 60px 120px rgba(0,0,0,0.9)',
          overflow: 'hidden',
        }}
      >
        {/* Свечение */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(249,115,22,0.15) 0%, transparent 70%)', filter: 'blur(30px)' }}
        />

        {/* ── ШАПКА ── */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/8"
          style={{ padding: '36px 48px 28px' }}
        >
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Новый проект</h2>
            <p className="text-sm text-gray-500 mt-2">Заполните основные параметры производства</p>
          </div>
          <button onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-2xl text-gray-500 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── СКРОЛЛИРУЕМЫЙ КОНТЕНТ ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '36px 48px' }}>
          <form id="create-form" onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

              {/* Название */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Название проекта</label>
                <div className="relative">
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Например: «Север», «Побег», «Горизонт»"
                    autoFocus
                    className="w-full rounded-2xl text-white text-xl font-medium placeholder-gray-700 focus:outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: `1px solid ${name ? 'rgba(249,115,22,0.55)' : 'rgba(255,255,255,0.1)'}`,
                      padding: '18px 24px',
                    }}
                  />
                  {name && <div className="absolute right-5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-orange-400" />}
                </div>
              </div>

              {/* Описание — скрытое, разворачивается по клику */}
              <div>
                <button
                  type="button"
                  onClick={() => setDescOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm font-medium transition-colors"
                  style={{ color: descOpen ? '#fb923c' : '#6b7280' }}
                >
                  <ChevronDown
                    size={16}
                    style={{ transform: descOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
                  />
                  {descOpen ? 'Скрыть описание' : '+ Добавить описание проекта'}
                </button>

                <div style={{
                  display: 'grid',
                  gridTemplateRows: descOpen ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.3s ease',
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Краткое описание: жанр, история, особенности производства..."
                      rows={4}
                      className="w-full rounded-2xl text-white text-sm placeholder-gray-700 focus:outline-none transition-all duration-200 resize-none"
                      style={{
                        marginTop: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        padding: '16px 20px',
                        lineHeight: '1.6',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Разделитель */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

              {/* Тип проекта */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Тип проекта</label>
                <div className="grid grid-cols-5 gap-3">
                  {TYPE_OPTIONS.map((opt) => {
                    const active = type === opt.value
                    return (
                      <button key={opt.value} type="button" onClick={() => setType(opt.value)}
                        className="flex flex-col items-center justify-center gap-3 rounded-2xl border transition-all duration-200"
                        style={{
                          padding: '20px 12px',
                          background: active ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
                          borderColor: active ? 'rgba(249,115,22,0.6)' : 'rgba(255,255,255,0.09)',
                          color: active ? '#fb923c' : '#6b7280',
                        }}
                      >
                        {opt.icon}
                        <span className="text-sm font-semibold">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Разделитель */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

              {/* Хронометраж + Планирование — две колонки */}
              <div className="grid grid-cols-2 gap-8">
                {/* Хронометраж */}
                <div style={{ padding: '28px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">Хронометраж</p>
                  {type === 'serial' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <Field label="Количество серий">
                        <Input value={episodesCount} onChange={setEpisodesCount} type="number" placeholder="8" />
                      </Field>
                      <Field label="Минут в одной серии">
                        <Input value={episodeDuration} onChange={setEpisodeDuration} type="number" placeholder="45" />
                      </Field>
                    </div>
                  ) : (
                    <Field label={type === 'film' ? 'Хронометраж фильма (минут)' : 'Хронометраж (минут)'}>
                      <Input value={totalDuration} onChange={setTotalDuration} type="number"
                        placeholder={type === 'film' ? '100' : type === 'ad' ? '2' : '4'} />
                    </Field>
                  )}
                </div>

                {/* Планирование */}
                <div style={{ padding: '28px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">Планирование съёмок</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Field label="Выработка в день" hint="мин. экранного времени">
                      <Input value={dailyOutput} onChange={setDailyOutput} type="number" placeholder="5" />
                    </Field>
                    <Field label="Съёмочных групп">
                      <div className="flex gap-3">
                        {([1, 2, 3] as const).map((n) => (
                          <button key={n} type="button" onClick={() => setShootingGroups(n)}
                            className="flex-1 rounded-2xl text-base font-bold border transition-all duration-200"
                            style={{
                              padding: '14px',
                              background: shootingGroups === n ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
                              borderColor: shootingGroups === n ? 'rgba(249,115,22,0.6)' : 'rgba(255,255,255,0.09)',
                              color: shootingGroups === n ? '#fb923c' : '#6b7280',
                            }}
                          >{n}</button>
                        ))}
                      </div>
                    </Field>
                    <div className="flex items-center justify-between rounded-2xl"
                      style={{
                        padding: '16px 20px',
                        background: plannedDays > 0 ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${plannedDays > 0 ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Sparkles size={16} className={plannedDays > 0 ? 'text-orange-400' : 'text-gray-700'} />
                        <span className="text-sm text-gray-400">Расчётных дней</span>
                      </div>
                      <span className={`text-3xl font-bold ${plannedDays > 0 ? 'text-orange-400' : 'text-gray-700'}`}>
                        {plannedDays > 0 ? plannedDays : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Разделитель */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

              {/* Даты */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Даты производства</label>
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Дата начала съёмок">
                    <Input value={startDate} onChange={setStartDate} type="date" />
                  </Field>
                  <Field label="Дата завершения">
                    <Input value={endDate} onChange={setEndDate} type="date" />
                  </Field>
                </div>
              </div>

              {/* Разделитель */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

              {/* Хранение */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Хранение данных</label>
                <div className="grid grid-cols-4 gap-3">
                  {CLOUD_OPTIONS.map((opt) => {
                    const active = cloudStorage === opt.value
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setCloudStorage(opt.value as Project['cloudStorage'])}
                        className="flex flex-col items-center gap-3 rounded-2xl border text-center transition-all duration-200"
                        style={{
                          padding: '20px 12px',
                          background: active ? 'rgba(249,115,22,0.14)' : 'rgba(255,255,255,0.04)',
                          borderColor: active ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.08)',
                          color: active ? '#fb923c' : '#6b7280',
                        }}
                      >
                        {CloudIcons[opt.value]}
                        <div>
                          <p className={`text-sm font-semibold ${active ? 'text-orange-300' : 'text-gray-300'}`}>{opt.label}</p>
                          <p className="text-xs text-gray-600 mt-1">{opt.sub}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>
          </form>
        </div>

        {/* ── КНОПКИ — прилипают к низу ── */}
        <div className="shrink-0 border-t border-white/8"
          style={{ padding: '24px 48px', background: 'rgba(14,14,30,0.8)', display: 'flex', gap: '16px' }}
        >
          <button type="button" onClick={onClose}
            className="rounded-2xl text-base text-gray-400 hover:text-white font-medium transition-colors"
            style={{
              padding: '16px 32px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Отмена
          </button>
          <button type="submit" form="create-form" disabled={!name.trim()}
            className="flex-1 rounded-2xl text-white text-base font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            style={{
              padding: '16px 32px',
              background: name.trim() ? 'linear-gradient(135deg, #f97316, #dc2626)' : 'rgba(255,255,255,0.06)',
              boxShadow: name.trim() ? '0 8px 32px rgba(249,115,22,0.35)' : 'none',
            }}
          >
            <Film size={18} />
            Создать проект
          </button>
        </div>

      </div>
    </div>
  )
}
