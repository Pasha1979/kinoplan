import type { Node as PMNode } from '@tiptap/pm/model'
import { calculateSceneTiming } from './sceneTiming'
import { CHARS_PER_PAGE, MIN_SCENE_PAGES } from '../constants/scriptConstants'
import type { TimingSystem } from '../store/scriptStore'

export interface ExtractedScene {
  id: string
  number: string
  type: string
  location: string
  sublocation?: string
  time: string
  cast: string[]
  pages: number
  duration: number
  manualDuration?: number
  charCount: number
}

export interface ExtractedStats {
  scenes: number
  pages: 0
  duration: 0
}

export interface ExtractScenesOptions {
  doc: PMNode
  forcedPages?: number
  precisePagesFallback: number
  timingSystem: TimingSystem
  genreCoefficient: number
}

/**
 * Извлекает сцены из ProseMirror-документа редактора.
 * Чистая функция — не зависит от React, может быть протестирована изолированно.
 */
export function extractScenesFromDocument(options: ExtractScenesOptions): { scenes: ExtractedScene[]; stats: ExtractedStats } {
  const { doc, forcedPages, precisePagesFallback, timingSystem, genreCoefficient } = options

  // Собираем только блоки верхнего уровня документа (не inline-узлы)
  const blockNodes: PMNode[] = []
  doc.forEach((node: PMNode) => {
    blockNodes.push(node)
  })

  // === ПРОХОД 1: собираем raw-сцены с charCount и dialogLines ===
  const rawScenes: Array<{
    sceneNumber: string
    sceneType: string
    location: string
    sublocation?: string
    time: string
    cast: string[]
    charCount: number
    dialogLines: number
    manualDuration?: number
  }> = []

  blockNodes.forEach((node, index) => {
    if (node.type.name !== 'sceneHeader') return

    const headerText = node.textContent.trim()

    // Паттерн: "1-1. ИНТ. КВАРТИРА — ДЕНЬ" или "1. ЭКСТ. УЛИЦА — НОЧЬ" или "1. ИНТ. КВАРТИРА ПЕТИ. ДЕНЬ." или "2. ПАВ. Студия A утро."
    // Также поддерживаем FilmToolz: НАТ. (натура = экстерьер), НАТ/ИНТ. (смешанный)
    const headerMatch = headerText.match(/^(\d+(?:-\d+)?)\.\s*(ИНТ-ЭКСТ\.?|ИНТ\.?|ЭКСТ\.?|ПАВ\.?|НАТ\/ИНТ\.?|НАТ\.?)\s+(.+)$/i)
    if (!headerMatch) return

    const sceneNumber = headerMatch[1]
    const rawType = headerMatch[2].toUpperCase()
    let locationAndTime = headerMatch[3]

    // Нормализация типов: НАТ → ЭКСТ, НАТ/ИНТ → ИНТ-ЭКСТ, ПАВ → ПАВ
    let sceneType: string
    if (rawType.startsWith('ИНТ-') || rawType.startsWith('НАТ/') || rawType.startsWith('ИНТ/')) {
      sceneType = 'ИНТ-ЭКСТ'
    } else if (rawType.startsWith('НАТ')) {
      sceneType = 'ЭКСТ'
    } else if (rawType.startsWith('ПАВ')) {
      sceneType = 'ПАВ'
    } else if (rawType.startsWith('Э')) {
      sceneType = 'ЭКСТ'
    } else {
      sceneType = 'ИНТ'
    }

    // Варианты времени суток
    const timeWords = ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ']

    // Вариант 1: разделитель — тире/—
    // Вариант 2: время в конце строки через точку (КВАРТИРА ПЕТИ. ДЕНЬ.)
    let location: string
    let time: string

    // Парсим ручной хронометраж (мм:сс) из шапки, например: "МАША, ПЕТЯ (01:30)"
    let manualDuration: number | undefined
    const timingMatch = locationAndTime.match(/\((\d{1,2}):(\d{2})\)\s*$/)
    if (timingMatch) {
      const mins = parseInt(timingMatch[1], 10)
      const secs = parseInt(timingMatch[2], 10)
      manualDuration = mins * 60 + secs
      locationAndTime = locationAndTime.slice(0, locationAndTime.lastIndexOf(timingMatch[0])).trim()
    }

    const dashParts = locationAndTime.split(/\s*[—–]\s*/)
    if (dashParts.length >= 2) {
      location = dashParts[0].trim().replace(/\.$/, '')
      time = dashParts[dashParts.length - 1].trim().replace(/\.$/, '')
    } else {
      // Ищем время суток в конце строки
      const timePattern = new RegExp(`[.\\s](${timeWords.join('|')})\\.?$`, 'i')
      const timeMatch = locationAndTime.match(timePattern)
      if (timeMatch) {
        time = timeMatch[1].toUpperCase()
        location = locationAndTime.slice(0, locationAndTime.lastIndexOf(timeMatch[0])).trim().replace(/\.$/, '')
      } else {
        location = locationAndTime.trim().replace(/\.$/, '')
        time = ''
      }
    }

    // Разбиваем локацию на location + sublocation через точку: "Школа.Кабинет директора"
    let sublocation: string | undefined
    const dotIndex = location.indexOf('.')
    if (dotIndex > 0) {
      sublocation = location.slice(dotIndex + 1).trim()
      location = location.slice(0, dotIndex).trim()
    }

    // Ищем cast: следующий БЛОК после sceneHeader должен быть sceneCast
    let cast: string[] = []
    const nextBlock = blockNodes[index + 1]
    if (nextBlock?.type.name === 'sceneCast') {
      const castText = nextBlock.textContent.trim()
      if (castText) {
        cast = castText.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
      }
    }

    // Считаем символы до следующей sceneHeader
    let charCount = headerText.length
    let dialogLines = 0
    for (let i = index + 1; i < blockNodes.length; i++) {
      const n = blockNodes[i]
      if (n.type.name === 'sceneHeader') break
      charCount += n.textContent.length
      if (n.type.name === 'sceneDialog') {
        dialogLines++
      }
    }

    rawScenes.push({ sceneNumber, sceneType, location, sublocation, time, cast, charCount, dialogLines, manualDuration })
  })

  // === ПРОХОД 2: распределяем точное кол-во страниц по сценам ===
  const totalCharCount = rawScenes.reduce((sum, s) => sum + s.charCount, 0)
  const effectivePages = forcedPages ?? precisePagesFallback
  const hasPrecisePages = effectivePages > MIN_SCENE_PAGES

  const scenes: ExtractedScene[] = rawScenes.map((raw) => {
    // Распределяем precisePages пропорционально charCount каждой сцены.
    // Если precisePages ещё не рассчитан (первый рендер) — fallback на charCount/CHARS_PER_PAGE.
    const pages = hasPrecisePages && totalCharCount > 0
      ? Math.max(MIN_SCENE_PAGES, parseFloat(((raw.charCount / totalCharCount) * effectivePages).toFixed(1)))
      : Math.max(MIN_SCENE_PAGES, parseFloat((raw.charCount / CHARS_PER_PAGE).toFixed(1)))

    // Расчитываем хронометраж от уже точного кол-ва страниц
    // Если задан ручной хронометраж — используем его, иначе рассчитываем
    const calculated = calculateSceneTiming({ pages, charCount: raw.charCount, dialogLines: raw.dialogLines }, timingSystem, genreCoefficient)
    const duration = raw.manualDuration ?? calculated.duration

    return {
      id: `scene-${raw.sceneNumber}`,
      number: raw.sceneNumber,
      type: raw.sceneType,
      location: raw.location,
      sublocation: raw.sublocation,
      time: raw.time,
      cast: raw.cast,
      pages,
      duration,
      manualDuration: raw.manualDuration,
      charCount: raw.charCount,
    }
  })

  const stats: ExtractedStats = {
    scenes: scenes.length,
    pages: 0,
    duration: 0,
  }

  return { scenes, stats }
}
