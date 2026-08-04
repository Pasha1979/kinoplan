import { useState, useCallback, useRef, useEffect } from 'react'

export type SplitPanel = 'left' | 'right'

export function useSplitScreen(defaultSeries = 1) {
  const [isActive, setIsActive] = useState(false)
  const [activePanel, setActivePanel] = useState<SplitPanel>('left')

  // Независимые focusSceneId для каждой панели
  const [leftFocusSceneId, setLeftFocusSceneId] = useState<string | undefined>()
  const [rightFocusSceneId, setRightFocusSceneId] = useState<string | undefined>()

  // Независимый выбор серии для правой панели
  const [rightSeries, setRightSeries] = useState(defaultSeries)

  // Ширина левой панели в процентах (для divider)
  const [leftWidthPct, setLeftWidthPct] = useState(50)
  const isDraggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  const enable = useCallback(() => {
    setIsActive(true)
    setActivePanel('left')
  }, [])

  const disable = useCallback(() => {
    setIsActive(false)
    setActivePanel('left')
    setLeftFocusSceneId(undefined)
    setRightFocusSceneId(undefined)
    setLeftWidthPct(50)
    setRightSeries(defaultSeries)
  }, [defaultSeries])

  const toggle = useCallback(() => {
    setIsActive(prev => {
      if (prev) {
        setActivePanel('left')
        setLeftFocusSceneId(undefined)
        setRightFocusSceneId(undefined)
        setLeftWidthPct(50)
        setRightSeries(defaultSeries)
      }
      return !prev
    })
  }, [defaultSeries])

  // Навигация к сцене — идёт в активную панель
  const navigateToScene = useCallback((sceneId: string) => {
    if (activePanel === 'left') {
      setLeftFocusSceneId(sceneId)
    } else {
      setRightFocusSceneId(sceneId)
    }
  }, [activePanel])

  // Сброс focusSceneId после того как редактор обработал навигацию
  const clearLeftFocus = useCallback(() => setLeftFocusSceneId(undefined), [])
  const clearRightFocus = useCallback(() => setRightFocusSceneId(undefined), [])

  // Перетаскивание divider
  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true

    const container = containerRef.current
    if (!container) return

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return
      const rect = container.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftWidthPct(Math.min(75, Math.max(25, pct)))
    }
    const onMouseUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      dragCleanupRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Очистка listener'ов при unmount во время drag
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
    }
  }, [])

  return {
    isActive,
    activePanel,
    setActivePanel,
    leftFocusSceneId,
    rightFocusSceneId,
    leftWidthPct,
    containerRef,
    rightSeries,
    setRightSeries,
    enable,
    disable,
    toggle,
    navigateToScene,
    clearLeftFocus,
    clearRightFocus,
    onDividerMouseDown,
  }
}
