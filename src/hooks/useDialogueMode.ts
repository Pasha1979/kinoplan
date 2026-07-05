import { useState, useCallback, useMemo } from 'react'
import type { Scene } from '../store/scriptStore'

export function useDialogueMode(scenes: Scene[]) {
  const [activeCharacter, setActiveCharacter] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

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

  const selectCharacter = useCallback((name: string) => {
    setActiveCharacter(prev => (prev === name ? null : name))
    setPickerOpen(false)
  }, [])

  const exit = useCallback(() => {
    setActiveCharacter(null)
    setPickerOpen(false)
  }, [])

  const togglePicker = useCallback(() => {
    setPickerOpen(prev => !prev)
  }, [])

  return {
    activeCharacter,
    characters,
    pickerOpen,
    setPickerOpen,
    selectCharacter,
    togglePicker,
    exit,
    isActive: activeCharacter !== null,
  }
}
