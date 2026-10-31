import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUiStore } from '../../store/uiStore'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/** Возвращает ref и скорректированную позицию поповера, чтобы не выходить за края экрана */
export function usePopoverPosition(x: number, y: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    })
  }, [x, y])

  return { ref, style: { position: 'fixed' as const, left: pos.left, top: pos.top, zIndex: 100 } }
}

/** Закрытие по клику вне, Escape и скроллу */
export function usePopoverClose(onClose: () => void) {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-popover]')) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const { theme } = useUiStore()
  const { ref, style } = usePopoverPosition(x, y)
  usePopoverClose(onClose)
  const isDark = theme === 'dark'

  return (
    <div
      ref={ref}
      style={style}
      data-popover
      className={`min-w-[200px] rounded-xl overflow-hidden border shadow-xl py-1.5 ${
        isDark ? 'bg-[#1e1e3a] border-white/12 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-300/50'
      }`}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : isDark
                ? 'text-gray-300 hover:bg-white/6'
                : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
