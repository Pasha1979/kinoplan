import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [pos, setPos] = useState({ top: 0, right: 0, minWidth: 180 })
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const r = rootRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, right: window.innerWidth - r.right, minWidth: Math.max(180, r.width) })
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
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
        className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm border transition-colors w-full ${
          highlight
            ? 'border-orange-500/50 text-orange-400 bg-orange-500/10'
            : isDark
              ? 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20 hover:shadow-lg hover:shadow-orange-500/25'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        {icon}
        <span className="whitespace-nowrap">{current?.label ?? value}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className={`fixed rounded-xl overflow-hidden border backdrop-blur-md min-w-[180px] ${
            isDark
              ? 'bg-[#13132a]/85 border-orange-500/30 shadow-[0_0_35px_rgba(249,115,22,0.35)]'
              : 'bg-white/90 border-orange-300 shadow-[0_0_35px_rgba(249,115,22,0.25)]'
          }`}
          style={{ top: pos.top, right: pos.right, minWidth: pos.minWidth, zIndex: 999 }}
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
        </div>,
        document.body
      )}
    </div>
  )
}
