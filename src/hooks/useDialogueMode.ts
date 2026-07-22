import { useState, useCallback, useMemo } from 'react'
import type { Scene } from '../store/scriptStore'

export function useDialogueMode(scenes: Scene[]) {
  const [activeCharacter, setActiveCharacter] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [povMode, setPovMode] = useState(false)

  // Собираем уникальных персонажей из cast всех сцен
  const characters = useMemo(() => {
    const set = new Set<string>()
    scenes.forEach(scene => {
      scene.cast?.forEach(name => {
        if (name.trim()) set.add(name.trim().toUpperCase())
      })
    })
    return Array.from(set).sort()
  }, [scenes])

  const togglePicker = useCallback(() => {
    setPickerOpen(prev => !prev)
  }, [])

  const togglePovMode = useCallback(() => {
    setPovMode(prev => !prev)
  }, [])

  const selectCharacter = useCallback((name: string) => {
    // При выборе персонажа в POV режиме выключаем POV
    if (povMode) {
      setPovMode(false)
    }
    setActiveCharacter(prev => (prev === name ? null : name))
    setPickerOpen(false)
  }, [povMode])

  const exit = useCallback(() => {
    setActiveCharacter(null)
    setPickerOpen(false)
  }, [])

  return {
    activeCharacter,
    characters,
    pickerOpen,
    setPickerOpen,
    selectCharacter,
    togglePicker,
    togglePovMode,
    povMode,
    exit,
    isActive: activeCharacter !== null,
  }
}
