import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export interface FilterOption {
  value: string
  label: string
}

interface FilterDropdownProps {
  icon?: React.ReactNode
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  /** Подсвечивать кнопку, когда выбрано не базовое значение */
  highlight?: boolean
}

export default function FilterDropdown({ icon, options, value, onChange, highlight }: FilterDropdownProps) {
  const { theme } = useUiStore()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const current = options.find((o) => o.value === value)
  const isDark = theme === 'dark'

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border transition-colors ${
          highlight
            ? 'border-orange-500/50 text-orange-400 bg-orange-500/10'
            : isDark
              ? 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        {icon}
        <span className="whitespace-nowrap">{current?.label ?? value}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute top-full right-0 mt-2 rounded-xl overflow-hidden z-50 min-w-[180px] border shadow-xl ${
            isDark ? 'bg-[#1e1e3a] border-white/12 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-300/50'
          }`}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt.value === value
                  ? 'text-orange-400 font-medium bg-orange-500/10'
                  : isDark
                    ? 'text-gray-300 hover:bg-white/6'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
