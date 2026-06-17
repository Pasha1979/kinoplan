import { useState, useCallback, useMemo } from 'react'

const FREQUENCY_KEY = 'smartType_frequency'

function loadFrequencies(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FREQUENCY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveFrequencies(freq: Record<string, number>) {
  try {
    localStorage.setItem(FREQUENCY_KEY, JSON.stringify(freq))
  } catch { /* ignore */ }
}

function getFreqKey(type: string, text: string): string {
  return `${type}:${text.toUpperCase()}`
}

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
    characters: initialCharacters = [],
    locations: initialLocations = [],
    props: initialProps = [],
    times: initialTimes = ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ'],
    minMatchLength = 2,
    maxSuggestions = 5,
  } = options

  const [suggestions, setSuggestions] = useState<SmartTypeSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)

  // Внутренний state для динамического обновления списков
  const [characters, setCharacters] = useState(initialCharacters)
  const [locations, setLocations] = useState(initialLocations)
  const [props, setProps] = useState(initialProps)
  const [times, setTimes] = useState(initialTimes)
  const [frequencies, setFrequencies] = useState<Record<string, number>>(loadFrequencies)

  const updateLists = useCallback((lists: {
    characters?: string[]
    locations?: string[]
    props?: string[]
    times?: string[]
  }) => {
    if (lists.characters !== undefined) setCharacters(lists.characters)
    if (lists.locations !== undefined) setLocations(lists.locations)
    if (lists.props !== undefined) setProps(lists.props)
    if (lists.times !== undefined) setTimes(lists.times)
  }, [])

  // Все доступные варианты
  const allSuggestions = useMemo(() => {
    const result: SmartTypeSuggestion[] = []
    const freq = frequencies

    const getFreq = (type: string, text: string) => freq[getFreqKey(type, text)] || 1

    // Подсказки для шапки сцены
    const scenePrefixes = ['ИНТ.', 'ЭКСТ.', 'И.', 'Э.', 'ИНТ-ЭКСТ.', 'ИНТ/ЭКСТ.', 'ПАВ.', 'НАТ.', 'НАТ/ИНТ.']
    scenePrefixes.forEach((prefix, index) => {
      result.push({
        id: `prefix_${index}`,
        text: prefix,
        type: 'scene_prefix',
        frequency: getFreq('scene_prefix', prefix),
      })
    })

    characters.forEach((char, index) => {
      result.push({
        id: `char_${index}`,
        text: char.toUpperCase(),
        type: 'character',
        frequency: getFreq('character', char),
      })
    })

    locations.forEach((loc, index) => {
      result.push({
        id: `loc_${index}`,
        text: loc.toUpperCase(),
        type: 'location',
        frequency: getFreq('location', loc),
      })
    })

    props.forEach((prop, index) => {
      result.push({
        id: `prop_${index}`,
        text: prop.toUpperCase(),
        type: 'prop',
        frequency: getFreq('prop', prop),
      })
    })

    // Базовые времена суток (всегда доступны) + изученные из сценария
    const baseTimes = ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ']
    const mergedTimes = new Set([...baseTimes, ...times])
    mergedTimes.forEach((time, index) => {
      result.push({
        id: `time_${index}`,
        text: time.toUpperCase(),
        type: 'time',
        frequency: getFreq('time', time),
      })
    })

    return result
  }, [characters, locations, props, times, frequencies])

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
    let relevantSuggestions: SmartTypeSuggestion[]
    
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

  // Записать использование подсказки — увеличивает frequency в localStorage
  const recordUsage = useCallback((suggestion: SmartTypeSuggestion) => {
    const key = getFreqKey(suggestion.type, suggestion.text)
    const next = { ...frequencies, [key]: (frequencies[key] || 0) + 1 }
    setFrequencies(next)
    saveFrequencies(next)
  }, [frequencies])

  return {
    suggestions,
    activeIndex,
    isOpen,
    cursorPosition,
    updateSuggestions,
    selectSuggestion,
    navigateSuggestions,
    closeSuggestions,
    updateLists,
    recordUsage,
  }
}
