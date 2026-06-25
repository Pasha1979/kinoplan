import { useEffect, useRef, useState } from 'react'
import { Search, X, ChevronUp, ChevronDown, Replace } from 'lucide-react'
import type { SearchBlockFilter, SearchBlockType } from '../hooks/useScriptSearch'

const FILTER_CHIPS: { value: SearchBlockType; label: string }[] = [
  { value: 'sceneHeader', label: 'Шапки' },
  { value: 'sceneCast', label: 'Действ. лица' },
  { value: 'sceneAction', label: 'Действие' },
  { value: 'sceneCharacter', label: 'Персонажи' },
  { value: 'sceneDialog', label: 'Диалог' },
  { value: 'sceneParenthetical', label: 'Ремарки' },
  { value: 'sceneTransition', label: 'Переходы' },
]

interface SearchBarProps {
  isDark: boolean
  query: string
  setQuery: (q: string) => void
  filter: SearchBlockFilter
  setFilter: (f: SearchBlockFilter) => void
  matches: { from: number; to: number }[]
  currentIndex: number
  isReplaceOpen: boolean
  replaceText: string
  setReplaceText: (t: string) => void
  onSearch: (q: string, f?: SearchBlockFilter) => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onReplaceCurrent: () => void
  onReplaceAll: () => void
  onToggleReplace: () => void
}

export default function SearchBar({
  isDark,
  query, setQuery,
  filter, setFilter,
  matches, currentIndex,
  isReplaceOpen,
  replaceText, setReplaceText,
  onSearch, onNext, onPrev, onClose,
  onReplaceCurrent, onReplaceAll, onToggleReplace,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  const bg = isDark ? '#1e1e3a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'
  const textColor = isDark ? '#f1f5f9' : '#111827'
  const subText = isDark ? '#94a3b8' : '#6b7280'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb'
  const chipActiveBg = isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)'

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Закрытие дропдауна при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (matches.length > 0) {
        e.shiftKey ? onPrev() : onNext()
      } else {
        onSearch(query, filter)
      }
    }
    if (e.key === 'Escape') onClose()
  }

  const toggleChip = (val: SearchBlockType) => {
    const newFilter = filter.includes(val)
      ? filter.filter(f => f !== val)
      : [...filter, val]
    setFilter(newFilter)
    if (query) onSearch(query, newFilter)
  }

  const clearFilter = () => {
    setFilter([])
    if (query) onSearch(query, [])
  }

  return (
    <div
      className="shrink-0 flex flex-col border-b px-4 py-2 gap-1.5"
      style={{ background: bg, borderColor: border }}
    >
      {/* Строка поиска */}
      <div className="flex items-center gap-2">
        {/* Кнопка раскрыть замену */}
        <button
          onClick={onToggleReplace}
          className="w-6 h-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
          style={{ color: subText }}
          title="Найти и заменить"
        >
          <Replace size={14} />
        </button>

        <Search size={14} style={{ color: subText }} className="flex-shrink-0" />

        {/* Поле ввода */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Найти..."
          className="flex-1 text-sm outline-none rounded px-2 py-1"
          style={{ background: inputBg, color: textColor, border: `1px solid ${border}` }}
        />

        {/* Кнопка фильтра */}
        <div ref={filterRef} className="relative flex-shrink-0">
          <button
            onClick={() => setFilterOpen(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: filter.length > 0 ? chipActiveBg : inputBg,
              color: filter.length > 0 ? '#818cf8' : subText,
              border: `1px solid ${filter.length > 0 ? 'rgba(99,102,241,0.4)' : border}`,
            }}
            title="Фильтры поиска"
          >
            {filter.length === 0 ? 'Везде' : `Выбрано: ${filter.length}`}
            <ChevronDown size={11} style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
          </button>

          {/* Дропдаун панель */}
          {filterOpen && (
            <div
              className="absolute top-full mt-1 right-0 z-50 rounded-lg p-2 flex flex-col gap-1 shadow-lg"
              style={{ background: bg, border: `1px solid ${border}`, minWidth: 160 }}
            >
              {/* Везде */}
              <button
                onClick={() => { clearFilter(); setFilterOpen(false) }}
                className="text-left px-2 py-1 rounded text-xs font-medium transition-all"
                style={{
                  background: filter.length === 0 ? chipActiveBg : 'transparent',
                  color: filter.length === 0 ? '#818cf8' : subText,
                }}
              >
                ✓ Везде
              </button>
              <div style={{ height: 1, background: border, margin: '2px 0' }} />
              {FILTER_CHIPS.map(chip => {
                const active = filter.includes(chip.value)
                return (
                  <button
                    key={chip.value}
                    onClick={() => toggleChip(chip.value)}
                    className="text-left px-2 py-1 rounded text-xs font-medium transition-all"
                    style={{
                      background: active ? chipActiveBg : 'transparent',
                      color: active ? '#818cf8' : subText,
                    }}
                  >
                    {active ? '✓' : '  '} {chip.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Счётчик */}
        <span className="text-xs flex-shrink-0" style={{ color: subText, minWidth: 52 }}>
          {matches.length === 0
            ? (query ? 'Не найдено' : '')
            : `${currentIndex + 1} / ${matches.length}`}
        </span>

        {/* Навигация */}
        <button onClick={onPrev} disabled={matches.length === 0}
          className="w-7 h-7 flex items-center justify-center rounded disabled:opacity-30 hover:opacity-80"
          style={{ color: subText }} title="Предыдущее">
          <ChevronUp size={15} />
        </button>
        <button onClick={onNext} disabled={matches.length === 0}
          className="w-7 h-7 flex items-center justify-center rounded disabled:opacity-30 hover:opacity-80"
          style={{ color: subText }} title="Следующее">
          <ChevronDown size={15} />
        </button>

        {/* Найти */}
        <button
          onClick={() => onSearch(query, filter)}
          disabled={!query.trim()}
          className="px-3 py-1 rounded text-xs font-medium disabled:opacity-40 transition-all flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          Найти
        </button>

        {/* Закрыть */}
        <button onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded hover:opacity-80 flex-shrink-0"
          style={{ color: subText }} title="Закрыть (Escape)">
          <X size={15} />
        </button>
      </div>

      {/* Строка замены */}
      {isReplaceOpen && (
        <div className="flex items-center gap-2 pl-8">
          <input
            type="text"
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
            placeholder="Заменить на..."
            className="flex-1 text-sm outline-none rounded px-2 py-1"
            style={{ background: inputBg, color: textColor, border: `1px solid ${border}` }}
          />
          <button
            onClick={onReplaceCurrent}
            disabled={!replaceText || matches.length === 0}
            className="px-3 py-1 rounded text-xs font-medium disabled:opacity-40 flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            Заменить
          </button>
          <button
            onClick={onReplaceAll}
            disabled={!replaceText || matches.length === 0}
            className="px-3 py-1 rounded text-xs font-medium disabled:opacity-40 flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            Заменить всё
          </button>
        </div>
      )}
    </div>
  )
}
