import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

const FREQUENCY_KEY = 'smartType_frequency'

// T-100: частоты подсказок — per-project, глобальный ключ = seed-фоллбэк
const freqStorageKey = (projectId?: string) =>
  projectId ? `${FREQUENCY_KEY}:${projectId}` : FREQUENCY_KEY

function loadFrequencies(projectId?: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(freqStorageKey(projectId))
    if (raw) return JSON.parse(raw)
    // Проектный ключ ещё не создан — стартуем от глобального (старый формат)
    if (projectId) {
      const global = localStorage.getItem(FREQUENCY_KEY)
      return global ? JSON.parse(global) : {}
    }
    return {}
  } catch {
    return {}
  }
}

function saveFrequencies(freq: Record<string, number>, projectId?: string) {
  try {
    localStorage.setItem(freqStorageKey(projectId), JSON.stringify(freq))
  } catch { /* ignore */ }
}

function getFreqKey(type: string, text: string): string {
  return `${type}:${text.toUpperCase()}`
}

// T-106: карта QWERTY → ЙЦУКЕН — автоисправление раскладки (BYN→ИНТ, LTRF→ДЕНЬ)
const LAT_TO_CYR: Record<string, string> = {
  q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з',
  '[': 'х', ']': 'ъ', a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о',
  k: 'л', l: 'д', ';': 'ж', "'": 'э', z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и',
  n: 'т', m: 'ь', ',': 'б', '.': 'ю', '`': 'ё',
}

/** Если слово набрано в латинской раскладке — возвращает кириллический вариант */
function translitLayout(word: string): string {
  if (!/[a-z;'\[\],.`]/i.test(word)) return word
  return word.split('').map((ch) => LAT_TO_CYR[ch.toLowerCase()] ?? ch).join('')
}

export interface SmartTypeSuggestion {
  id: string
  text: string
  type: 'character' | 'location' | 'prop' | 'time' | 'scene_prefix' | 'day'
  /** если задан — вставляется этот текст вместо text (напр. только подлокация) */
  insertText?: string
  frequency: number // сколько раз уже использовалось
}

export interface UseSmartTypeOptions {
  characters: string[]
  locations: string[]
  props?: string[]
  times?: string[]
  minMatchLength?: number
  maxSuggestions?: number
  /** T-100: частоты хранятся per-project (smartType_frequency:{id}) */
  projectId?: string
  /** Сценарные дни: быстрые варианты после слова-режима (тот же/след./ФБ/ФФ) */
  dayChoices?: (mode: string) => string[]
}

const EMPTY_LIST: string[] = []

export function useSmartType(options: UseSmartTypeOptions) {
  const {
    characters: registryCharacters = EMPTY_LIST,
    locations: registryLocations = EMPTY_LIST,
    props: registryProps = EMPTY_LIST,
    times: registryTimes,
    minMatchLength = 2,
    maxSuggestions = 5,
    projectId,
    dayChoices,
  } = options

  const [suggestions, setSuggestions] = useState<SmartTypeSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)

  // T-26: справочник (пропсы) и «выученное из текста» (updateLists) —
  // отдельные источники. Подсказки = объединение: персонаж из Разработки
  // предлагается до первой сцены, а updateLists больше не затирает справочник.
  const [learned, setLearned] = useState<{ characters: string[]; locations: string[]; props: string[]; times: string[] }>(
    { characters: [], locations: [], props: [], times: [] }
  )
  const characters = useMemo(
    () => [...new Set([...registryCharacters, ...learned.characters])],
    [registryCharacters, learned.characters]
  )
  const locations = useMemo(
    () => [...new Set([...registryLocations, ...learned.locations])],
    [registryLocations, learned.locations]
  )
  const props = useMemo(
    () => [...new Set([...registryProps, ...learned.props])],
    [registryProps, learned.props]
  )
  const times = useMemo(
    () => [...new Set([...(registryTimes ?? ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ']), ...learned.times])],
    [registryTimes, learned.times]
  )
  const [frequencies, setFrequencies] = useState<Record<string, number>>(() => loadFrequencies(projectId))

  // Смена проекта → перечитываем его частоты (изолированные пространства)
  const projectIdRef = useRef(projectId)
  useEffect(() => {
    if (projectIdRef.current === projectId) return
    projectIdRef.current = projectId
    setFrequencies(loadFrequencies(projectId))
  }, [projectId])

  const updateLists = useCallback((lists: {
    characters?: string[]
    locations?: string[]
    props?: string[]
    times?: string[]
  }) => {
    setLearned(prev => ({
      characters: lists.characters ?? prev.characters,
      locations: lists.locations ?? prev.locations,
      props: lists.props ?? prev.props,
      times: lists.times ?? prev.times,
    }))
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
    // T-100: [,;] — тоже границы слова (список действующих лиц «ИВАН, ПЕТР»)
    const match = beforeCursor.match(/[^\s,;]*$/)
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

    // Сценарные дни: курсор после «РЕЖИМ » (или набирает токен дня) →
    // быстрые варианты тот же/след./флешбек/флешфорвард.
    if (
      dayChoices &&
      (blockType === 'scene_header' || blockType === 'sceneHeader')
    ) {
      const before = text.substring(0, cursorPos)
      const dm = before.match(
        /(УТРО|ДЕНЬ|ВЕЧЕР|НОЧЬ|РАССВЕТ|ЗАКАТ|MORNING|DAY|EVENING|NIGHT|DAWN|DUSK)(\s+)([^\s,;]*)$/i
      )
      if (dm) {
        const typed = dm[3].toUpperCase()
        const list = dayChoices(dm[1].toUpperCase())
          .filter((d) => d !== typed && d.startsWith(typed))
          .map((d, i) => ({
            id: `day_${i}`,
            text: d,
            insertText: `${d}.`, // принятие → «32.» → авто-переход к составу
            type: 'day' as const,
            frequency: 0,
          }))
        if (list.length) {
          setSuggestions(list)
          setIsOpen(true)
          setActiveIndex(0)
          return
        }
      }
    }

    if (currentWord.length < minMatchLength) {
      setIsOpen(false)
      setSuggestions([])
      return
    }

    // Фильтруем подсказки по типу блока
    let relevantSuggestions: SmartTypeSuggestion[]
    
    if (blockType === 'character' || blockType === 'sceneCharacter' || blockType === 'sceneCast') {
      // Для блока персонажа / действующих лиц — только персонажи
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

    // Фильтруем по совпадению — проверяем и кириллический вариант слова
    // (T-106: юзер набрал в латинской раскладке — BYN матчит ИНТ)
    const wordBase = currentWord.toLowerCase()
    const wordAlt = translitLayout(wordBase)
    const matchWord = (sug: string, word: string, type: string, allowExact = false): boolean => {
      // allowExact: для alt-варианта раскладки точное совпадение валидно —
      // набранная латиница всё равно заменяется кириллической подсказкой
      if (sug.startsWith(word) && (allowExact || sug !== word)) return true
      if (type === 'location') {
        // Нечёткий поиск: любой сегмент «ДОМ.КУХНЯ» — КУХ→кухня
        if (sug.split('.').some((seg) => seg.startsWith(word) && seg !== word)) return true
        // Подлокации: «ДОМ ДЕДА.С» → сравниваем последний сегмент после точки
        if (word.includes('.')) {
          const wSeg = word.split('.').pop()!
          const sSeg = sug.split('.').pop()!
          return wSeg.length > 0 && sSeg.startsWith(wSeg) && sSeg !== wSeg
        }
      }
      return false
    }

    const filtered = relevantSuggestions
      .filter(s => {
        const sug = s.text.toLowerCase()
        if (matchWord(sug, wordBase, s.type)) return true
        return wordAlt !== wordBase && matchWord(sug, wordAlt, s.type, true)
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxSuggestions)

    setSuggestions(filtered)
    setIsOpen(filtered.length > 0)
    setActiveIndex(0)
  }, [allSuggestions, getCurrentWord, minMatchLength, maxSuggestions, dayChoices])

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

  // Открыть попап программно (напр. подлокации после выбора локации)
  const openSuggestions = useCallback((list: SmartTypeSuggestion[]) => {
    setSuggestions(list)
    setIsOpen(list.length > 0)
    setActiveIndex(0)
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
    saveFrequencies(next, projectIdRef.current)
  }, [frequencies])

  return {
    suggestions,
    activeIndex,
    isOpen,
    cursorPosition,
    updateSuggestions,
    selectSuggestion,
    openSuggestions,
    navigateSuggestions,
    closeSuggestions,
    updateLists,
    recordUsage,
  }
}
