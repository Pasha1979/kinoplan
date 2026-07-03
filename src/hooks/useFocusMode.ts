import { useState, useCallback, useEffect, useRef } from 'react'

export function useFocusMode() {
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLElement | null>(null)

  const enter = useCallback(async () => {
    const el = document.documentElement
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      } else if ((el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
        await (el as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen()
      }
    } catch {
      // Если fullscreen заблокирован — просто ставим флаг (fallback)
    }
    setIsFocused(true)
  }, [])

  const exit = useCallback(() => {
    setIsFocused(false)
    const doc = document as Document & {
      webkitExitFullscreen?: () => void
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else if ((doc as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
      doc.webkitExitFullscreen?.()
    }
  }, [])

  const toggle = useCallback(() => {
    if (isFocused) exit()
    else enter()
  }, [isFocused, enter, exit])

  // Слушаем выход из fullscreen через браузерную кнопку / Escape браузера
  useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement)
      if (!isFs && isFocused) {
        setIsFocused(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    }
  }, [isFocused])

  return { isFocused, enter, exit, toggle, containerRef }
}
