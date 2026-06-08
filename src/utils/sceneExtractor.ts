import type { Node as PMNode } from '@tiptap/pm/model'
import { calculateSceneTiming } from './sceneTiming'
import { CHARS_PER_PAGE, MIN_SCENE_PAGES } from '../constants/scriptConstants'
import type { TimingSystem } from '../store/scriptStore'

export interface ExtractedScene {
  id: string
  number: string
  type: string
  location: string
  time: string
  cast: string[]
  pages: number
  duration: number
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
    time: string
    cast: string[]
    charCount: number
    dialogLines: number
  }> = []

  blockNodes.forEach((node, index) => {
    if (node.type.name !== 'sceneHeader') return

    const headerText = node.textContent.trim()

    // Паттерн: "1-1. ИНТ. КВАРТИРА — ДЕНЬ" или "1. ЭКСТ. УЛИЦА — НОЧЬ" или "1. ИНТ. КВАРТИРА ПЕТИ. ДЕНЬ."
    const headerMatch = headerText.match(/^(\d+(?:-\d+)?)\.\s*(ИНТ-ЭКСТ\.?|ИНТ\.?|ЭКСТ\.?)\s+(.+)$/i)
    if (!headerMatch) return

    const sceneNumber = headerMatch[1]
    const rawType = headerMatch[2].toUpperCase()
    const locationAndTime = headerMatch[3]

    const sceneType = rawType.startsWith('ИНТ-') ? 'ИНТ-ЭКСТ' : rawType.startsWith('Э') ? 'ЭКСТ' : 'ИНТ'

    // Варианты времени суток
    const timeWords = ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ']

    // Вариант 1: разделитель — тире/—
    // Вариант 2: время в конце строки через точку (КВАРТИРА ПЕТИ. ДЕНЬ.)
    let location: string
    let time: string

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

    rawScenes.push({ sceneNumber, sceneType, location, time, cast, charCount, dialogLines })
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
    const { duration } = calculateSceneTiming({ pages, charCount: raw.charCount, dialogLines: raw.dialogLines }, timingSystem, genreCoefficient)

    return {
      id: `scene-${raw.sceneNumber}`,
      number: raw.sceneNumber,
      type: raw.sceneType,
      location: raw.location,
      time: raw.time,
      cast: raw.cast,
      pages,
      duration,
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
