import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Save, X } from 'lucide-react'
import { useScriptStore, type ScriptFormat, type TimingSystem } from '../../store/scriptStore'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'

export default function CreateScriptPage() {
  const navigate = useNavigate()
  const { addScript } = useScriptStore()
  const { getCurrentProject } = useProjectStore()
  const { theme } = useUiStore()
  const project = getCurrentProject()
  const isDark = theme === 'dark'

  const [title, setTitle] = useState(project?.name || '')
  const [format, setFormat] = useState<ScriptFormat>('russian')
  const [fontFamily, setFontFamily] = useState('Courier New')
  const [fontSize, setFontSize] = useState(12)
  const [timingSystem, setTimingSystem] = useState<TimingSystem>('page')
  const [genreCoefficient, setGenreCoefficient] = useState('auto')

  const bg = isDark ? '#0f0f20' : '#f8fafc'
  const cardBg = isDark ? '#1a1a35' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const textSecondary = isDark ? '#94a3b8' : '#64748b'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'
  const activeBg = isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)'
  const activeBorder = isDark ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.4)'
  const activeText = isDark ? '#a5b4fc' : '#4f46e5'

  const handleCreate = () => {
    if (!title.trim()) {
      alert('Введите название сценария')
      return
    }

    if (!project) {
      alert('Проект не выбран')
      return
    }

    const coefficient = genreCoefficient === 'auto' ? 1.0 : parseFloat(genreCoefficient)

    const newScript = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: title.trim(),
      version: 'Черновик v1',
      format,
      scenes: [],
      characters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timingSystem,
      genreCoefficient: coefficient,
      fontFamily,
      fontSize,
    }

    addScript(newScript)
    navigate(`/project/${project.id}/script`)
  }

  const handleCancel = () => {
    navigate(`/project/${project?.id}/script`)
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: bg }}>
      {/* Шапка */}
      <div className="shrink-0 flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: border }}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
              color: isDark ? '#e5e7eb' : '#374151',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            }}
          >
            <ChevronLeft size={14} />
            Отмена
          </button>
          <div>
            <h1 className="text-sm font-bold" style={{ color: textPrimary }}>Создание сценария</h1>
            {project && <p className="text-xs" style={{ color: textSecondary }}>{project.name}</p>}
          </div>
        </div>
      </div>

      {/* Форма */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-3xl">
          <div className="rounded-3xl p-10" style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.4)' : '0 20px 60px rgba(0,0,0,0.08)' }}>
            
            {/* Название */}
            <div className="mb-8">
              <label className="block text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                Название сценария
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Мой новый фильм"
                className="w-full px-5 py-4 rounded-xl text-base outline-none transition-all"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: textPrimary,
                }}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = activeBorder}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = inputBorder}
              />
            </div>

            {/* Формат сценария */}
            <div className="mb-8">
              <label className="block text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                Формат сценария
              </label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'hollywood' as ScriptFormat, label: 'Голливудский (WGA)' },
                  { value: 'russian' as ScriptFormat, label: 'Российский (КИТ)' },
                  { value: 'russian' as ScriptFormat, label: 'Пользовательский' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFormat(option.value)}
                    className="px-5 py-4 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: format === option.value ? activeBg : inputBg,
                      border: `1px solid ${format === option.value ? activeBorder : inputBorder}`,
                      color: format === option.value ? activeText : textPrimary,
                      boxShadow: format === option.value ? '0 4px 20px rgba(99,102,241,0.25)' : 'none',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Шрифт */}
            <div className="mb-8">
              <label className="block text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                Шрифт
              </label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'Courier New', label: 'Courier New' },
                  { value: 'Courier Prime', label: 'Courier Prime' },
                  { value: 'Другой', label: 'Другой' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFontFamily(option.value)}
                    className="px-5 py-4 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: fontFamily === option.value ? activeBg : inputBg,
                      border: `1px solid ${fontFamily === option.value ? activeBorder : inputBorder}`,
                      color: fontFamily === option.value ? activeText : textPrimary,
                      boxShadow: fontFamily === option.value ? '0 4px 20px rgba(99,102,241,0.25)' : 'none',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Размер шрифта */}
            <div className="mb-8">
              <label className="block text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                Размер шрифта
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  min={10}
                  max={16}
                  className="w-32 px-5 py-4 rounded-xl text-base outline-none transition-all"
                  style={{
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: textPrimary,
                  }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = activeBorder}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = inputBorder}
                />
                <span className="text-sm font-medium" style={{ color: textSecondary }}>pt</span>
              </div>
            </div>

            {/* Система хронометража */}
            <div className="mb-8">
              <label className="block text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                Система хронометража
              </label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: 'page' as TimingSystem, label: 'Постраничный (1 стр = 55 сек)' },
                  { value: 'character' as TimingSystem, label: 'Посимвольный' },
                  { value: 'flexible' as TimingSystem, label: 'Гибкий' },
                  { value: 'manual' as TimingSystem, label: 'Ручной' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTimingSystem(option.value)}
                    className="px-5 py-4 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: timingSystem === option.value ? activeBg : inputBg,
                      border: `1px solid ${timingSystem === option.value ? activeBorder : inputBorder}`,
                      color: timingSystem === option.value ? activeText : textPrimary,
                      boxShadow: timingSystem === option.value ? '0 4px 20px rgba(99,102,241,0.25)' : 'none',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Жанровый коэффициент */}
            <div className="mb-10">
              <label className="block text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                Жанровый коэффициент
              </label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: 'auto', label: 'Авто' },
                  { value: '0.9', label: 'Мюзикл (0.9)' },
                  { value: '1.15', label: 'Комедия (1.15)' },
                  { value: '1.0', label: 'Драма (1.0)' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setGenreCoefficient(option.value)}
                    className="px-5 py-4 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: genreCoefficient === option.value ? activeBg : inputBg,
                      border: `1px solid ${genreCoefficient === option.value ? activeBorder : inputBorder}`,
                      color: genreCoefficient === option.value ? activeText : textPrimary,
                      boxShadow: genreCoefficient === option.value ? '0 4px 20px rgba(99,102,241,0.25)' : 'none',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex items-center justify-end gap-4 pt-4" style={{ borderTop: `1px solid ${border}` }}>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                  color: isDark ? '#e5e7eb' : '#475569',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}
              >
                <X size={16} />
                Отмена
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  color: '#ffffff',
                  border: '1px solid rgba(99,102,241,0.3)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 25px rgba(99,102,241,0.5)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)' }}
              >
                <Save size={16} />
                Создать сценарий
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
