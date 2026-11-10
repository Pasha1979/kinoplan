import { memo, useMemo, useState } from 'react'
import { Users, MapPin, FileText, ListTree, Plus, Trash2, Sparkles, X } from 'lucide-react'
import type { Scene } from '../../../types/scene'
import type {
  DevCharacter, DevCharacterType, DevLocation, DevSynopsis, ProjectDevelopment,
} from '../../../types/development'

const CHAR_TYPES: Record<DevCharacterType, { l: string; c: string }> = {
  main:      { l: 'Главный',        c: '#fb923c' },
  secondary: { l: 'Второстепенный', c: '#818cf8' },
  episodic:  { l: 'Эпизодный',      c: '#9ca3af' },
}

interface DevelopmentViewProps {
  isDark: boolean
  scenes: Array<Scene & { _episode?: number }>
  isSerial?: boolean
  episodesCount?: number
  development: ProjectDevelopment | undefined
  onDevelopmentChange: (dev: ProjectDevelopment) => void
}

const uid = () => `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const emptyDev: ProjectDevelopment = { characters: [], locations: [], synopsis: {} }

function DevelopmentView({ isDark, scenes, isSerial, episodesCount, development, onDevelopmentChange }: DevelopmentViewProps) {
  const [tab, setTab] = useState<'chars' | 'locs' | 'synopsis' | 'episodes'>('chars')
  const [editChar, setEditChar] = useState<DevCharacter | 'new' | null>(null)
  const [editLoc, setEditLoc] = useState<DevLocation | 'new' | null>(null)

  const dev = development ?? emptyDev
  const setDev = (patch: Partial<ProjectDevelopment>) => onDevelopmentChange({ ...dev, ...patch })

  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const fieldBg = isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'

  /* Авто-импорт: персонажи из cast + dialogCharacters, локации из шапок */
  const charNamesInText = useMemo(() => {
    const map = new Map<string, string[]>()
    scenes.forEach((sc) => {
      const names = [...(sc.cast || []), ...(sc.dialogCharacters || [])]
      names.forEach((n) => {
        const key = n.trim().toUpperCase()
        if (!key) return
        const cur = map.get(key) ?? []
        if (!cur.includes(sc.id)) cur.push(sc.id)
        map.set(key, cur)
      })
    })
    return map
  }, [scenes])

  const locNamesInText = useMemo(() => {
    const map = new Map<string, string[]>()
    scenes.forEach((sc) => {
      const key = (sc.location || '').trim().toUpperCase()
      if (!key) return
      const cur = map.get(key) ?? []
      if (!cur.includes(sc.id)) cur.push(sc.id)
      map.set(key, cur)
    })
    return map
  }, [scenes])

  const importChars = () => {
    const existing = new Set(dev.characters.map((c) => c.name.toUpperCase()))
    const fresh: DevCharacter[] = [...dev.characters]
    charNamesInText.forEach((sceneIds, name) => {
      if (existing.has(name)) {
        const cur = fresh.find((c) => c.name.toUpperCase() === name)
        if (cur) cur.sceneIds = sceneIds
      } else {
        fresh.push({ id: uid(), name, type: 'secondary', sceneIds })
      }
    })
    setDev({ characters: fresh })
  }

  const importLocs = () => {
    const existing = new Set(dev.locations.map((l) => l.name.toUpperCase()))
    const fresh: DevLocation[] = [...dev.locations]
    locNamesInText.forEach((sceneIds, name) => {
      if (existing.has(name)) {
        const cur = fresh.find((l) => l.name.toUpperCase() === name)
        if (cur) cur.sceneIds = sceneIds
      } else {
        fresh.push({ id: uid(), name, sceneIds })
      }
    })
    setDev({ locations: fresh })
  }

  const charSceneCount = (c: DevCharacter) => (c.sceneIds ?? charNamesInText.get(c.name.toUpperCase()) ?? []).length
  const locSceneCount = (l: DevLocation) => (l.sceneIds ?? locNamesInText.get(l.name.toUpperCase()) ?? []).length

  const SubTab = ({ k, icon, label }: { k: typeof tab; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setTab(k)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        background: tab === k ? 'rgba(249,115,22,0.15)' : 'transparent',
        color: tab === k ? '#fb923c' : textSecondary,
      }}
    >
      {icon}{label}
    </button>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Шапка + под-вкладки */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold" style={{ color: textPrimary }}>Разработка</h2>
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ececf0' }}>
            <SubTab k="chars" icon={<Users size={13} />} label="Персонажи" />
            <SubTab k="locs" icon={<MapPin size={13} />} label="Локации" />
            <SubTab k="synopsis" icon={<FileText size={13} />} label="Синопсис" />
            <SubTab k="episodes" icon={<ListTree size={13} />} label="Посерийник" />
          </div>
        </div>

        {/* ── Персонажи ── */}
        {tab === 'chars' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditChar('new')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}
              >
                <Plus size={12} /> Персонаж
              </button>
              <button
                onClick={importChars}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: textSecondary, border: `1px solid ${border}` }}
                title="Собрать персонажей из текста сценария (cast + реплики)"
              >
                <Sparkles size={12} /> Импорт из текста ({charNamesInText.size})
              </button>
              <span className="text-[10px]" style={{ color: textSecondary }}>
                {dev.characters.length} в библии
              </span>
            </div>

            {dev.characters.length === 0 ? (
              <Empty text="Пока пусто — добавь персонажа вручную или импортируй из текста сценария" isDark={isDark} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {dev.characters.map((c) => {
                  const t = CHAR_TYPES[c.type]
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5"
                      style={{ background: cardBg, border: `1px solid ${border}`, borderTop: `2px solid ${t.c}` }}
                      onClick={() => setEditChar(c)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-sm font-bold" style={{ color: textPrimary }}>{c.name}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${t.c}22`, color: t.c }}>{t.l}</span>
                            {c.episodeTag != null && isSerial && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>С{c.episodeTag}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] shrink-0" style={{ color: textSecondary }}>{charSceneCount(c)} сцен</span>
                      </div>
                      {c.description && <p className="text-[11px] leading-snug mb-2 line-clamp-3" style={{ color: textSecondary }}>{c.description}</p>}
                      {c.arc && (
                        <p className="text-[10px] italic leading-snug line-clamp-2" style={{ color: '#fb923c' }}>
                          ↳ {c.arc}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Локации ── */}
        {tab === 'locs' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditLoc('new')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
              >
                <Plus size={12} /> Локация
              </button>
              <button
                onClick={importLocs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: textSecondary, border: `1px solid ${border}` }}
                title="Собрать локации из шапок сцен"
              >
                <Sparkles size={12} /> Импорт из текста ({locNamesInText.size})
              </button>
              <span className="text-[10px]" style={{ color: textSecondary }}>{dev.locations.length} в библии</span>
            </div>

            {dev.locations.length === 0 ? (
              <Empty text="Локации появятся после импорта из текста или ручного добавления" isDark={isDark} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {dev.locations.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5"
                    style={{ background: cardBg, border: `1px solid ${border}`, borderTop: '2px solid #34d399' }}
                    onClick={() => setEditLoc(l)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-sm font-bold" style={{ color: textPrimary }}>{l.name}</div>
                      <span className="text-[10px] shrink-0" style={{ color: textSecondary }}>{locSceneCount(l)} сцен</span>
                    </div>
                    {l.description && <p className="text-[11px] leading-snug line-clamp-3" style={{ color: textSecondary }}>{l.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Синопсис ── */}
        {tab === 'synopsis' && (
          <SynopsisTab
            syn={dev.synopsis}
            onChange={(s) => setDev({ synopsis: s })}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            fieldBg={fieldBg}
            border={border}
          />
        )}

        {/* ── Посерийник — отдельный заход ── */}
        {tab === 'episodes' && (
          <div className="rounded-xl p-8 text-center" style={{ background: cardBg, border: `1px solid ${border}` }}>
            <ListTree size={28} className="mx-auto mb-3" style={{ color: '#fb923c' }} />
            <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>Посерийник</p>
            <p className="text-xs" style={{ color: textSecondary }}>План по сериям — логлайн, статус, сцены. Отдельный заход.</p>
            {isSerial && <p className="text-[10px] mt-2" style={{ color: textSecondary }}>В проекте {episodesCount || 8} серий</p>}
          </div>
        )}
      </div>

      {/* ── Модал персонажа ── */}
      {editChar && (
        <CharModal
          char={editChar === 'new' ? { id: uid(), name: '', type: 'secondary' } : editChar}
          isNew={editChar === 'new'}
          isSerial={isSerial}
          episodesCount={episodesCount}
          isDark={isDark}
          sceneCount={editChar === 'new' ? 0 : charSceneCount(editChar)}
          onClose={() => setEditChar(null)}
          onDelete={editChar === 'new' ? undefined : () => {
            setDev({ characters: dev.characters.filter((c) => c.id !== (editChar as DevCharacter).id) })
            setEditChar(null)
          }}
          onSave={(c) => {
            const exists = dev.characters.some((x) => x.id === c.id)
            setDev({ characters: exists ? dev.characters.map((x) => (x.id === c.id ? c : x)) : [...dev.characters, c] })
            setEditChar(null)
          }}
        />
      )}

      {/* ── Модал локации ── */}
      {editLoc && (
        <LocModal
          loc={editLoc === 'new' ? { id: uid(), name: '' } : editLoc}
          isNew={editLoc === 'new'}
          isDark={isDark}
          sceneCount={editLoc === 'new' ? 0 : locSceneCount(editLoc)}
          onClose={() => setEditLoc(null)}
          onDelete={editLoc === 'new' ? undefined : () => {
            setDev({ locations: dev.locations.filter((l) => l.id !== (editLoc as DevLocation).id) })
            setEditLoc(null)
          }}
          onSave={(l) => {
            const exists = dev.locations.some((x) => x.id === l.id)
            setDev({ locations: exists ? dev.locations.map((x) => (x.id === l.id ? l : x)) : [...dev.locations, l] })
            setEditLoc(null)
          }}
        />
      )}
    </div>
  )
}

/* ── Пустое состояние ── */
function Empty({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: isDark ? '#13132a' : '#fff', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}` }}>
      <p className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{text}</p>
    </div>
  )
}

/* ── Вкладка Синопсис ── */
function SynopsisTab({ syn, onChange, isDark, textPrimary, textSecondary, fieldBg, border }: {
  syn: DevSynopsis; onChange: (s: DevSynopsis) => void;
  isDark: boolean; textPrimary: string; textSecondary: string; fieldBg: string; border: string
}) {
  const F = ({ label, hint, field, rows }: { label: string; hint?: string; field: keyof DevSynopsis; rows: number }) => (
    <div className="rounded-xl p-4" style={{ background: isDark ? '#13132a' : '#fff', border: `1px solid ${border}` }}>
      <div className="flex items-baseline gap-2 mb-1">
        <div className="text-[10px] font-bold" style={{ color: '#fb923c' }}>{label}</div>
        {hint && <div className="text-[9px]" style={{ color: textSecondary }}>{hint}</div>}
      </div>
      <textarea
        value={syn[field] ?? ''}
        onChange={(e) => onChange({ ...syn, [field]: e.target.value })}
        rows={rows}
        placeholder={hint}
        className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
        style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }}
      />
    </div>
  )
  return (
    <div className="space-y-4">
      <F label="ЛОГЛАЙН" hint="герой + желание + препятствие — одно предложение" field="logline" rows={2} />
      <F label="СИНОПСИС" hint="краткое содержание — 1 абзац" field="synopsis" rows={5} />
      <F label="ЗАМЕТКИ" hint="мир, темы, тон, референсы" field="notes" rows={6} />
    </div>
  )
}

/* ── Модал персонажа ── */
function CharModal({ char, isNew, isSerial, episodesCount, isDark, sceneCount, onClose, onSave, onDelete }: {
  char: DevCharacter; isNew: boolean; isSerial?: boolean; episodesCount?: number; isDark: boolean; sceneCount: number
  onClose: () => void; onSave: (c: DevCharacter) => void; onDelete?: () => void
}) {
  const [name, setName] = useState(char.name)
  const [type, setType] = useState<DevCharacterType>(char.type)
  const [desc, setDesc] = useState(char.description ?? '')
  const [arc, setArc] = useState(char.arc ?? '')
  const [ep, setEp] = useState<number | ''>(char.episodeTag ?? '')
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const fieldBg = isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="rounded-2xl p-5 space-y-3" style={{ background: isDark ? '#1a1a33' : '#fff', border: `1px solid rgba(249,115,22,0.35)`, borderTop: '3px solid #fb923c', width: 440, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: '#fb923c' }}>{isNew ? 'Новый персонаж' : 'Персонаж'}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X size={15} style={{ color: textSecondary }} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>ИМЯ (капслок)</div>
            <input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="ИВАН"
              className="w-full rounded-lg px-3 py-2 text-xs outline-none font-bold"
              style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
          </div>
          <div>
            <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>ТИП</div>
            <select value={type} onChange={(e) => setType(e.target.value as DevCharacterType)}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }}>
              {Object.entries(CHAR_TYPES).map(([v, t]) => <option key={v} value={v}>{t.l}</option>)}
            </select>
          </div>
        </div>

        {isSerial && (
          <div>
            <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>СЕРИЯ (персонаж «на серию»)</div>
            <select value={ep === '' ? '' : ep} onChange={(e) => setEp(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }}>
              <option value="">Весь проект</option>
              {Array.from({ length: episodesCount || 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Серия {n}</option>)}
            </select>
          </div>
        )}

        <div>
          <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>ОПИСАНИЕ</div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Кто он, драматическая функция…"
            className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
            style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
        </div>

        <div>
          <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>АРКА (откуда → куда)</div>
          <textarea value={arc} onChange={(e) => setArc(e.target.value)} rows={2} placeholder="Из труса — в героя…"
            className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
            style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button onClick={onDelete} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: '#ef4444' }}>
                <Trash2 size={11} /> Удалить
              </button>
            )}
            <span className="text-[10px]" style={{ color: textSecondary }}>{sceneCount} сцен</span>
          </div>
          <button
            onClick={() => { if (!name.trim()) return; onSave({ ...char, name: name.trim(), type, description: desc, arc, episodeTag: ep === '' ? undefined : ep }) }}
            className="px-4 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: '#fb923c', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}
            disabled={!name.trim()}
          >
            {isNew ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Модал локации ── */
function LocModal({ loc, isNew, isDark, sceneCount, onClose, onSave, onDelete }: {
  loc: DevLocation; isNew: boolean; isDark: boolean; sceneCount: number
  onClose: () => void; onSave: (l: DevLocation) => void; onDelete?: () => void
}) {
  const [name, setName] = useState(loc.name)
  const [desc, setDesc] = useState(loc.description ?? '')
  const textPrimary = isDark ? '#e5e7eb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const fieldBg = isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="rounded-2xl p-5 space-y-3" style={{ background: isDark ? '#1a1a33' : '#fff', border: `1px solid rgba(52,211,153,0.35)`, borderTop: '3px solid #34d399', width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: '#34d399' }}>{isNew ? 'Новая локация' : 'Локация'}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X size={15} style={{ color: textSecondary }} /></button>
        </div>
        <div>
          <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>НАЗВАНИЕ</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="КВАРТИРА ИВАНА"
            className="w-full rounded-lg px-3 py-2 text-xs outline-none font-bold"
            style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
        </div>
        <div>
          <div className="text-[10px] font-bold mb-1" style={{ color: textSecondary }}>ОПИСАНИЕ</div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Характер, особенности…"
            className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
            style={{ background: fieldBg, border: `1px solid ${border}`, color: textPrimary }} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button onClick={onDelete} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: '#ef4444' }}>
                <Trash2 size={11} /> Удалить
              </button>
            )}
            <span className="text-[10px]" style={{ color: textSecondary }}>{sceneCount} сцен</span>
          </div>
          <button
            onClick={() => { if (!name.trim()) return; onSave({ ...loc, name: name.trim(), description: desc }) }}
            className="px-4 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: '#34d399', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}
            disabled={!name.trim()}
          >
            {isNew ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(DevelopmentView)
