import { useState, useCallback, useMemo } from 'react'

export interface SmartTypeSuggestion {
  id: string
  text: string
  type: 'character' | 'location' | 'prop' | 'time' | 'scene_prefix'
  frequency: number // сколько раз уже использовалось
}

export interface UseSmartTypeOptions {
  characters: string[]
  locations: string[]
  props?: string[]
  times?: string[]
  minMatchLength?: number
  maxSuggestions?: number
}

export function useSmartType(options: UseSmartTypeOptions) {
  const {
    characters,
    locations,
    props = [],
    times = ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ'],
    minMatchLength = 1,
    maxSuggestions = 5,
  } = options

  const [suggestions, setSuggestions] = useState<SmartTypeSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)

  // Все доступные варианты
  const allSuggestions = useMemo(() => {
    const result: SmartTypeSuggestion[] = []
    
    // Подсказки для шапки сцены
    const scenePrefixes = ['ИНТ.', 'ЭКСТ.', 'И.', 'Э.', 'ИНТ-ЭКСТ.', 'ИНТ/ЭКСТ.']
    scenePrefixes.forEach((prefix, index) => {
      result.push({
        id: `prefix_${index}`,
        text: prefix,
        type: 'scene_prefix',
        frequency: 10, // Высокая частота чтобы были первыми
      })
    })
    
    characters.forEach((char, index) => {
      result.push({
        id: `char_${index}`,
        text: char.toUpperCase(),
        type: 'character',
        frequency: 1,
      })
    })
    
    locations.forEach((loc, index) => {
      result.push({
        id: `loc_${index}`,
        text: loc.toUpperCase(),
        type: 'location',
        frequency: 1,
      })
    })
    
    props.forEach((prop, index) => {
      result.push({
        id: `prop_${index}`,
        text: prop.toUpperCase(),
        type: 'prop',
        frequency: 1,
      })
    })
    
    times.forEach((time, index) => {
      result.push({
        id: `time_${index}`,
        text: time.toUpperCase(),
        type: 'time',
        frequency: 1,
      })
    })
    
    return result
  }, [characters, locations, props, times])

  // Получить текущее слово перед курсором
  const getCurrentWord = useCallback((text: string, cursorPos: number): string => {
    const beforeCursor = text.substring(0, cursorPos)
    // Находим последнее слово — берем текст после последнего пробела/переноса строки
    const match = beforeCursor.match(/[^\s]*$/)
    return match ? match[0] : ''
  }, [])

  // Обновить подсказки
  const updateSuggestions = useCallback((
    text: string,
    cursorPos: number,
    blockType: string
  ) => {
    setCursorPosition(cursorPos)
    const currentWord = getCurrentWord(text, cursorPos)
    
    if (currentWord.length < minMatchLength) {
      setIsOpen(false)
      setSuggestions([])
      return
    }

    // Фильтруем подсказки по типу блока
    let relevantSuggestions = allSuggestions
    
    if (blockType === 'character' || blockType === 'sceneCharacter') {
      // Для блока персонажа — только персонажи
      relevantSuggestions = allSuggestions.filter(s => s.type === 'character')
    } else if (blockType === 'scene_header' || blockType === 'sceneHeader') {
      // Для заголовка сцены — префиксы (ИНТ/ЭКСТ), локации и время
      relevantSuggestions = allSuggestions.filter(s => 
        s.type === 'scene_prefix' || s.type === 'location' || s.type === 'time'
      )
    } else {
      // Для paragraph и других — показываем префиксы сцен (ИНТ/ЭКСТ) и персонажей
      relevantSuggestions = allSuggestions.filter(s => 
        s.type === 'scene_prefix' || s.type === 'character'
      )
    }

    // Фильтруем по совпадению
    const filtered = relevantSuggestions
      .filter(s => 
        s.text.toLowerCase().startsWith(currentWord.toLowerCase()) &&
        s.text.toLowerCase() !== currentWord.toLowerCase()
      )
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxSuggestions)

    setSuggestions(filtered)
    setIsOpen(filtered.length > 0)
    setActiveIndex(0)
  }, [allSuggestions, getCurrentWord, minMatchLength, maxSuggestions])

  // Выбрать подсказку
  const selectSuggestion = useCallback((
    text: string,
    cursorPos: number,
    suggestion: SmartTypeSuggestion
  ): { newText: string; newCursorPos: number } => {
    const beforeCursor = text.substring(0, cursorPos)
    const afterCursor = text.substring(cursorPos)
    
    // Находим начало текущего слова
    const words = beforeCursor.split(/(\s+)/)
    const lastWord = words[words.length - 1]
    
    // Заменяем текущее слово на подсказку
    const newBeforeCursor = beforeCursor.substring(0, beforeCursor.length - lastWord.length) + suggestion.text
    const newText = newBeforeCursor + afterCursor
    const newCursorPos = newBeforeCursor.length
    
    setIsOpen(false)
    setSuggestions([])
    
    return { newText, newCursorPos }
  }, [])

  // Навигация по подсказкам
  const navigateSuggestions = useCallback((direction: 'up' | 'down') => {
    if (!isOpen || suggestions.length === 0) return
    
    if (direction === 'down') {
      setActiveIndex(prev => (prev + 1) % suggestions.length)
    } else {
      setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
    }
  }, [isOpen, suggestions.length])

  // Закрыть подсказки
  const closeSuggestions = useCallback(() => {
    setIsOpen(false)
    setSuggestions([])
  }, [])

  return {
    suggestions,
    activeIndex,
    isOpen,
    cursorPosition,
    updateSuggestions,
    selectSuggestion,
    navigateSuggestions,
    closeSuggestions,
  }
}
