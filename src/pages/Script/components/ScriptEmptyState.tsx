import { useState } from 'react'
import { FileText, Upload, Plus } from 'lucide-react'

interface ScriptEmptyStateProps {
  isDark: boolean
  projectName?: string
  colors: {
    bg: string
    border: string
    textPrimary: string
    textSecondary: string
    textMuted: string
  }
  onImportClick: () => void
  onCreateClick: () => void
}

export default function ScriptEmptyState({ isDark, projectName, colors, onImportClick, onCreateClick }: ScriptEmptyStateProps) {
  const [importHover, setImportHover] = useState(false)
  const [createHover, setCreateHover] = useState(false)
  const { bg, border, textPrimary, textSecondary, textMuted } = colors

  return (
    <div className="flex-1 flex flex-col" style={{ background: bg }}>

      {/* Шапка */}
      <div className="shrink-0 flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: border }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <FileText size={16} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h1 className="text-sm font-bold" style={{ color: textPrimary }}>Сценарий</h1>
            {projectName && <p className="text-xs" style={{ color: textSecondary }}>{projectName}</p>}
          </div>
        </div>
      </div>

      {/* Центральный экран выбора */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16">

        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'rgba(99,102,241,0.12)', border: '2px solid rgba(99,102,241,0.25)' }}>
          <FileText size={28} style={{ color: '#818cf8' }} />
        </div>

        <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: textPrimary }}>
          Добавьте сценарий
        </h2>
        <p className="text-sm text-center mb-10 max-w-sm" style={{ color: textSecondary }}>
          Загрузите готовый файл или начните писать с нуля прямо в редакторе
        </p>

        {/* Две карточки выбора */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">

          {/* Загрузить файл */}
          <button
            onClick={onImportClick}
            onMouseEnter={() => setImportHover(true)}
            onMouseLeave={() => setImportHover(false)}
            className="relative flex flex-col items-start rounded-2xl p-6 text-left transition-all overflow-hidden opacity-60"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #1e1b4b 0%, #1a1a35 60%, #1e1b4b 100%)'
                : 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
              border: `1px solid ${importHover ? 'rgba(129,140,248,0.6)' : 'rgba(129,140,248,0.25)'}`,
              boxShadow: importHover
                ? '0 8px 32px rgba(99,102,241,0.25), 0 0 0 1px rgba(129,140,248,0.3)'
                : '0 2px 12px rgba(99,102,241,0.1)',
              transform: importHover ? 'translateY(-2px)' : 'translateY(0)',
            }}
          >
            {/* Декоративный круг */}
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }} />

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 relative"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
              <Upload size={20} className="text-white" />
            </div>

            <p className="font-bold text-base mb-1.5 relative" style={{ color: isDark ? '#f1f5f9' : '#1e1b4b' }}>
              Загрузить файл
            </p>
            <p className="text-xs leading-relaxed mb-4 relative" style={{ color: isDark ? '#94a3b8' : '#6366f1' }}>
              Импорт из Word, PDF или Final Draft. Сцены распознаются автоматически.
            </p>
            <div className="flex gap-2 flex-wrap relative">
              {['DOCX', 'PDF', 'FDX'].map(f => (
                <span key={f} className="text-xs px-2.5 py-1 rounded-lg font-mono font-bold"
                  style={{
                    background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)',
                    color: isDark ? '#a5b4fc' : '#4338ca',
                    border: '1px solid rgba(99,102,241,0.25)',
                  }}>{f}</span>
              ))}
            </div>
          </button>

          {/* Написать с нуля */}
          <button
            onClick={onCreateClick}
            onMouseEnter={() => setCreateHover(true)}
            onMouseLeave={() => setCreateHover(false)}
            className="relative flex flex-col items-start rounded-2xl p-6 text-left transition-all overflow-hidden"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #0f2a1e 0%, #1a1a35 60%, #0f2a1e 100%)'
                : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: `1px solid ${createHover ? 'rgba(52,211,153,0.6)' : 'rgba(52,211,153,0.25)'}`,
              boxShadow: createHover
                ? '0 8px 32px rgba(16,185,129,0.2), 0 0 0 1px rgba(52,211,153,0.3)'
                : '0 2px 12px rgba(16,185,129,0.08)',
              transform: createHover ? 'translateY(-2px)' : 'translateY(0)',
            }}
          >
            {/* Декоративный круг */}
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 relative"
              style={{ background: 'linear-gradient(135deg, #059669, #34d399)', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
              <Plus size={20} className="text-white" />
            </div>

            <p className="font-bold text-base mb-1.5 relative" style={{ color: isDark ? '#f1f5f9' : '#064e3b' }}>
              Написать с нуля
            </p>
            <p className="text-xs leading-relaxed mb-4 relative" style={{ color: isDark ? '#94a3b8' : '#059669' }}>
              Профессиональный редактор с авто-форматированием. Российский и голливудский стандарты.
            </p>
            <div className="flex gap-2 flex-wrap relative">
              {['ИНТ./ЭКСТ.', 'Персонаж', 'Диалог'].map(f => (
                <span key={f} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{
                    background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)',
                    color: isDark ? '#6ee7b7' : '#047857',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}>{f}</span>
              ))}
            </div>
          </button>

        </div>

        {/* Подсказка внизу */}
        <p className="text-xs mt-8" style={{ color: textMuted }}>
          Вставить текст сценария вручную можно прямо в редакторе
        </p>
      </div>
    </div>
  )
}
