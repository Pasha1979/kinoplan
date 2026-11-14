import type { BreakdownCategory } from '../components/ScriptBreakdown'

export interface ParsedElement {
  id: string
  category: BreakdownCategory
  name: string
  notes?: string
  sceneIds: string[]
  occurrences: Array<{
    sceneId: string
    blockId: string
    context: string
  }>
}

export interface ParsedScene {
  id: string
  number: string
  type: 'INT' | 'EXT' | 'INT/EXT' | 'PAV'
  location: string
  sublocation?: string
  timeOfDay: string
  manualDuration?: number
  elements: ParsedElement[]
}

export interface Block {
  id: string
  type: 'scene_header' | 'action' | 'character' | 'dialog' | 'parenthetical' | 'transition' | string
  content: string
  /** T-108: стабильный UUID сцены-владельца (data-scene-id) — идентичность
   * сцены для элементов разбивки; без него fallback на id блока */
  sceneId?: string
}

/**
 * Парсит заголовок сцены (1. ИНТ. КВАРТИРА ИВАНА — ДЕНЬ)
 */
export function parseSceneHeader(content: string): {
  number: string
  type: 'INT' | 'EXT' | 'INT/EXT' | 'PAV'
  location: string
  sublocation?: string
  timeOfDay: string
  manualDuration?: number
} | null {
  // Парсим ручной хронометраж (мм:сс) из шапки
  let manualDuration: number | undefined
  let text = content
  const timingMatch = content.match(/\((\d{1,2}):(\d{2})\)\s*$/)
  if (timingMatch) {
    const mins = parseInt(timingMatch[1], 10)
    const secs = parseInt(timingMatch[2], 10)
    manualDuration = mins * 60 + secs
    text = content.slice(0, content.lastIndexOf(timingMatch[0])).trim()
  }

  // Регулярка для русского формата: "1. ИНТ. КВАРТИРА ИВАНА — ДЕНЬ"
  // Также поддерживаем ПАВ., НАТ. (FilmToolz)
  const russianMatch = text.match(/(\d+)\.\s*(ИНТ|ЭКСТ|ИНТ\/ЭКСТ|ПАВ|НАТ|НАТ\/ИНТ)\.?\s*([^—]+)\s*—\s*(.+)/i)
  if (russianMatch) {
    const [, number, typeRaw, locationRaw, timeOfDay] = russianMatch
    let type: 'INT' | 'EXT' | 'INT/EXT' | 'PAV'
    const upper = typeRaw.toUpperCase()
    if (upper === 'ИНТ') type = 'INT'
    else if (upper === 'ЭКСТ' || upper === 'НАТ') type = 'EXT'
    else if (upper === 'ПАВ') type = 'PAV'
    else type = 'INT/EXT'

    // Разбиваем локацию на location + sublocation через точку
    let location = locationRaw.trim().toUpperCase()
    let sublocation: string | undefined
    const dotIndex = location.indexOf('.')
    if (dotIndex > 0) {
      sublocation = location.slice(dotIndex + 1).trim().toUpperCase()
      location = location.slice(0, dotIndex).trim().toUpperCase()
    }

    return {
      number,
      type,
      location,
      sublocation,
      timeOfDay: timeOfDay.trim().toUpperCase(),
      manualDuration
    }
  }

  // Регулярка для английского формата: "INT. APARTMENT — DAY" или "1. INT. APARTMENT — DAY"
  const englishMatch = text.match(/(\d+\.)?\s*(INT|EXT|INT\/EXT|PAV|EXT\/INT)\.?\s*([^—-]+)\s*[-—]\s*(.+)/i)
  if (englishMatch) {
    const [, numberPart, typeRaw, locationRaw, timeOfDay] = englishMatch
    const type = typeRaw.toUpperCase() as 'INT' | 'EXT' | 'INT/EXT' | 'PAV'

    let location = locationRaw.trim().toUpperCase()
    let sublocation: string | undefined
    const dotIndex = location.indexOf('.')
    if (dotIndex > 0) {
      sublocation = location.slice(dotIndex + 1).trim().toUpperCase()
      location = location.slice(0, dotIndex).trim().toUpperCase()
    }

    return {
      number: numberPart ? numberPart.replace('.', '') : '1',
      type,
      location,
      sublocation,
      timeOfDay: timeOfDay.trim().toUpperCase(),
      manualDuration
    }
  }

  return null
}

/**
 * Извлекает персонажа из блока character (КАПСЛОК)
 */
export function parseCharacter(content: string): string | null {
  const cleaned = content.trim().toUpperCase()
  // Убираем ремарки в скобках, если они есть в строке персонажа
  const withoutParenthetical = cleaned.replace(/\s*\([^)]*\)\s*$/, '')
  return withoutParenthetical || null
}

/**
 * Парсит action-блок на предмет реквизита
 * Ищет ключевые слова и слова в КАПСЛОКЕ
 */
export function parseActionForProps(content: string): Array<{ name: string; context: string }> {
  const props: Array<{ name: string; context: string }> = []
  
  // Ключевые слова для реквизита (расширяемый список)
  const propKeywords = [
    'ПИСТОЛЕТ', 'РЕВОЛЬВЕР', 'НОЖ', 'АВТОМАТ', 'ОРУЖИЕ',
    'ТЕЛЕФОН', 'СМАРТФОН', 'АЙФОН', 'ТЕЛЕФОН',
    'МАШИНА', 'АВТОМОБИЛЬ', 'ТАЧКА', 'МОТОЦИКЛ',
    'ЧЕМОДАН', 'СУМКА', 'ПАКЕТ', 'КОРОБКА',
    'КНИГА', 'ТЕТРАДЬ', 'БУМАГИ', 'ДОКУМЕНТЫ',
    'КЛЮЧИ', 'КОШЕЛЁК', 'ДЕНЬГИ', 'КРЕДИТКА',
    'СИГАРЕТА', 'СИГАРА', 'ЗАЖИГАЛКА',
    'БУТЫЛКА', 'СТАКАН', 'ЧАШКА', 'ТАРЕЛКА',
    'НОУТБУК', 'КОМПЬЮТЕР', 'ПЛАНШЕТ', 'КАМЕРА',
    'ОЧКИ', 'ШЛЯПА', 'ПАЛЬТО', 'КУРТКА',
    'КОЛЬЦО', 'ЧАСЫ', 'БРАСЛЕТ', 'ЦЕПОЧКА',
    'ПИСЬМО', 'КОНВЕРТ', 'ОТКРЫТКА', 'ЗАПИСКА'
  ]
  
  // Ищем слова в КАПСЛОКЕ (без русских букв, только латиница для обозначения капслока)
  // В русском тексте ищем слова, которые выглядят как акцентированные
  const capsPattern = /[А-ЯЁ][А-ЯЁ\s]+[А-ЯЁ]/g
  const capsMatches = content.match(capsPattern) || []
  
  capsMatches.forEach((match: string) => {
    const word = match.trim()
    if (word.length > 1 && !isCommonWord(word)) {
      props.push({
        name: word,
        context: content.trim()
      })
    }
  })
  
  // Ищем ключевые слова реквизита
  propKeywords.forEach(keyword => {
    if (content.toUpperCase().includes(keyword)) {
      // Проверяем, что ещё не добавили
      const alreadyAdded = props.some(p => p.name === keyword)
      if (!alreadyAdded) {
        props.push({
          name: keyword,
          context: content.trim()
        })
      }
    }
  })
  
  return props
}

/**
 * Проверяет, является ли слово часто используемым (не реквизит)
 */
function isCommonWord(word: string): boolean {
  const commonWords = [
    'ИВАН', 'МАША', 'ДИРЕКТОР', 'ОФИЦИАНТ', 'ВРАЧ', 'ПОЛИЦЕЙСКИЙ',
    'МУЖЧИНА', 'ЖЕНЩИНА', 'ПАРЕНЬ', 'ДЕВУШКА',
    'УТРО', 'ДЕНЬ', 'ВЕЧЕР', 'НОЧЬ',
    'КВАРТИРА', 'ОФИС', 'УЛИЦА', 'ПАРК', 'РЕСТОРАН',
    'МОСКВА', 'ПИТЕР', 'РОССИЯ',
    'ОН', 'ОНА', 'ОНИ', 'МЫ', 'ВЫ', 'ТЫ'
  ]
  return commonWords.includes(word)
}

/**
 * Главная функция парсинга — анализирует массив блоков
 */
export function parseScript(blocks: Block[]): ParsedScene[] {
  const scenes: ParsedScene[] = []
  const elementsMap = new Map<string, ParsedElement>()
  
  let currentScene: ParsedScene | null = null
  
  blocks.forEach(block => {
    // Заголовок сцены
    if (block.type === 'scene_header') {
      const header = parseSceneHeader(block.content)
      if (header) {
        // Сохраняем предыдущую сцену
        if (currentScene) {
          scenes.push(currentScene)
        }
        
        currentScene = {
          // T-108: UUID сцены (data-scene-id) — совпадает с scenes[].id,
          // чтобы элементы разбивки ссылались на те же сцены, что и ручные теги
          id: block.sceneId ?? block.id,
          number: header.number,
          type: header.type,
          location: header.location,
          sublocation: header.sublocation,
          timeOfDay: header.timeOfDay,
          manualDuration: header.manualDuration,
          elements: []
        }
        
        // Добавляем локацию как элемент
        const locationKey = `location_${header.location}`
        if (!elementsMap.has(locationKey)) {
          const locationElement: ParsedElement = {
            id: locationKey,
            category: 'locations',
            name: header.location,
            sceneIds: [currentScene.id],
            occurrences: [{ sceneId: currentScene.id, blockId: block.id, context: block.content }]
          }
          elementsMap.set(locationKey, locationElement)
        } else {
          const existing = elementsMap.get(locationKey)!
          if (!existing.sceneIds.includes(currentScene.id)) {
            existing.sceneIds.push(currentScene.id)
            existing.occurrences.push({ sceneId: currentScene.id, blockId: block.id, context: block.content })
          }
        }
      }
    }
    
    // Персонаж
    if (block.type === 'character' && currentScene) {
      const character = parseCharacter(block.content)
      if (character) {
        const charKey = `cast_${character}`
        if (!elementsMap.has(charKey)) {
          const charElement: ParsedElement = {
            id: charKey,
            category: 'cast',
            name: character,
            sceneIds: [currentScene.id],
            occurrences: [{ sceneId: currentScene.id, blockId: block.id, context: block.content }]
          }
          elementsMap.set(charKey, charElement)
        } else {
          const existing = elementsMap.get(charKey)!
          if (!existing.sceneIds.includes(currentScene.id)) {
            existing.sceneIds.push(currentScene.id)
          }
          existing.occurrences.push({ sceneId: currentScene.id, blockId: block.id, context: block.content })
        }
      }
    }
    
    // Action — ищем реквизит
    if (block.type === 'action' && currentScene) {
      const props = parseActionForProps(block.content)
      
      props.forEach(prop => {
        const propKey = `props_${prop.name}`
        if (!elementsMap.has(propKey)) {
          const propElement: ParsedElement = {
            id: propKey,
            category: 'props',
            name: prop.name,
            notes: prop.context.substring(0, 100) + (prop.context.length > 100 ? '...' : ''),
            sceneIds: [currentScene!.id],
            occurrences: [{ sceneId: currentScene!.id, blockId: block.id, context: prop.context }]
          }
          elementsMap.set(propKey, propElement)
        } else {
          const existing = elementsMap.get(propKey)!
          if (!existing.sceneIds.includes(currentScene!.id)) {
            existing.sceneIds.push(currentScene!.id)
          }
          existing.occurrences.push({ sceneId: currentScene!.id, blockId: block.id, context: prop.context })
        }
      })
    }
  })
  
  // Добавляем последнюю сцену
  if (currentScene) {
    scenes.push(currentScene)
  }
  
  // Распределяем элементы по сценам
  scenes.forEach(scene => {
    scene.elements = Array.from(elementsMap.values())
      .filter(el => el.sceneIds.includes(scene.id))
  })
  
  return scenes
}

/**
 * Получает уникальные элементы по категории
 */
export function getUniqueElements(scenes: ParsedScene[]): ParsedElement[] {
  const elementsMap = new Map<string, ParsedElement>()
  
  scenes.forEach(scene => {
    scene.elements.forEach(el => {
      if (!elementsMap.has(el.id)) {
        elementsMap.set(el.id, el)
      }
    })
  })
  
  return Array.from(elementsMap.values())
}

// ── T-108: слияние авто-элементов с ручными тегами сцен ─────────────────

/** Ручной тег, хранящийся на сцене (Scene.breakdownElements) */
export interface SceneTag {
  id: string
  category: BreakdownCategory
  name: string
  notes?: string
}

export interface MergedBreakdownElement extends ParsedElement {
  /** Ссылки на ручные теги-источники — для удаления через сцену-владельца */
  manualRefs: Array<{ sceneId: string; elementId: string }>
}

/** Ручные теги всех сцен → плоский список элементов со ссылками-владельцами */
export function flattenSceneTags(
  scenes: Array<{ id: string; breakdownElements?: SceneTag[] }>,
): MergedBreakdownElement[] {
  return scenes.flatMap((s) =>
    (s.breakdownElements || []).map((e) => ({
      id: e.id,
      category: e.category,
      name: e.name,
      notes: e.notes,
      sceneIds: [s.id],
      occurrences: [],
      manualRefs: [{ sceneId: s.id, elementId: e.id }],
    })),
  )
}

/**
 * Склеивает авто-элементы парсера и ручные теги по ключу «категория|имя»:
 * один элемент «ИВАН» — и из текста, и от ручного тега — показывается один раз.
 */
export function mergeBreakdownElements(
  parsed: ParsedElement[],
  manual: MergedBreakdownElement[],
): MergedBreakdownElement[] {
  const map = new Map<string, MergedBreakdownElement>()
  for (const el of [...parsed, ...manual]) {
    const key = `${el.category}|${el.name}`
    const refs = (el as MergedBreakdownElement).manualRefs ?? []
    const cur = map.get(key)
    if (cur) {
      cur.sceneIds = [...new Set([...cur.sceneIds, ...el.sceneIds])]
      cur.manualRefs.push(...refs)
      if (!cur.notes && el.notes) cur.notes = el.notes
    } else {
      map.set(key, { ...el, sceneIds: [...el.sceneIds], manualRefs: [...refs] })
    }
  }
  return [...map.values()]
}
