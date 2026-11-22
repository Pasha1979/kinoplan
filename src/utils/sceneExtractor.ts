import type { Node as PMNode } from '@tiptap/pm/model'
import { calculateSceneTiming } from './sceneTiming'
import { SCENE_HEADER_RE, parseHeaderTail, type StoryDay } from './storyDay'
import { CHARS_PER_PAGE, MIN_SCENE_PAGES, MIN_SCENE_CHAR_COUNT } from '../constants/scriptConstants'
import type { TimingSystem } from '../store/scriptStore'

export interface ExtractedScene {
  id: string
  number: string
  type: string
  location: string
  sublocation?: string
  /** время как написал автор: «ДЕНЬ 32», «НОЧЬ 1», «ДЕНЬ Х» */
  time: string
  /** нормализованный режим (УТРО/ДЕНЬ/…) для статистики и переходов */
  mode?: string
  /** сценарный день; ≠ shootDayNumber */
  storyDay?: StoryDay | null
  /** сцена помечена УДАЛЕНА — пропускается в днях/статистике */
  omitted?: boolean
  cast: string[]
  dialogCharacters: string[] // персонажи, которые реально говорят в сцене
  /** I-176: авто-синопсис — говорящие + первое действие (если нет ручного synopsis) */
  autoSynopsis: string
  pages: number
  duration: number
  manualDuration?: number
  charCount: number
}

export interface ExtractedStats {
  scenes: number
  pages: number
  duration: number
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
    mode?: string
    storyDay?: StoryDay | null
    omitted?: boolean
    cast: string[]
    dialogCharacters: string[]
    charCount: number
    dialogLines: number
    firstAction: string
    firstText: string
    manualDuration?: number
    sceneId?: string
  }> = []

  blockNodes.forEach((node, index) => {
    if (node.type.name !== 'sceneHeader') return

    const headerText = node.textContent.trim()

    // Паттерн: "1-1. ИНТ. КВАРТИРА — ДЕНЬ" или "1. ЭКСТ. УЛИЦА — НОЧЬ" или "1. ИНТ. КВАРТИРА ПЕТИ. ДЕНЬ." или "2. ПАВ. Студия A утро."
    // Также поддерживаем FilmToolz: НАТ. (натура = экстерьер), НАТ/ИНТ. (смешанный), литерные/ФБ-номера («14-16-ФБ», «1.a»)
    const headerMatch = headerText.match(SCENE_HEADER_RE)
    if (!headerMatch) return

    const sceneNumber = headerMatch[1]
    const sceneId = (node.attrs?.sceneId as string | null) ?? undefined
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

    // Локация + режим + сценарный день + состав + УДАЛЕНА + (мм:сс) — parseHeaderTail (storyDay.ts)
    const tail = parseHeaderTail(locationAndTime, sceneNumber)
    let location = tail.location.toUpperCase()
    const time = tail.cleanTime.toUpperCase()
    const manualDuration = tail.timingSec
    const mode = tail.mode
    const storyDay = tail.day
    const omitted = tail.omitted

    // Разбиваем локацию на location + sublocation через точку: "Школа.Кабинет директора"
    let sublocation: string | undefined
    const dotIndex = location.indexOf('.')
    if (dotIndex > 0) {
      sublocation = location.slice(dotIndex + 1).trim().toUpperCase()
      location = location.slice(0, dotIndex).trim().toUpperCase()
    }

    // Сценарные уточнения в скобках не входят в имя персонажа:
    // САНТЬЯГА (За кадром), (з/к), (продолжает) → САНТЬЯГА
    const normalizeCharName = (name: string) =>
      name.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()

    // === CAST: ручной + автоматический из диалогов ===
    // 1. Ручной cast из sceneCast блока
    let manualCast: string[] = []
    const nextBlock = blockNodes[index + 1]
    if (nextBlock?.type.name === 'sceneCast') {
      const castText = nextBlock.textContent.trim()
      if (castText) {
        manualCast = castText.split(/[,;]+/).map((s: string) => normalizeCharName(s.trim())).filter(Boolean)
      }
    }
    // Состав из грязной шапки: «… ДЕНЬ 32. ОСИНА, ДИМКА (02:08)»
    if (tail.tail) {
      tail.tail.split(/[,;]+/).forEach((n: string) => {
        const nm = normalizeCharName(n.trim())
        if (nm) manualCast.push(nm)
      })
    }

    // 2. Автоматический cast из sceneCharacter блоков внутри сцены
    const dialogCharacters: string[] = []
    const dialogCharacterSet = new Set<string>()

    // Считаем символы до следующей sceneHeader
    let charCount = headerText.length
    let dialogLines = 0
    let firstAction = ''
    let firstText = ''
    for (let i = index + 1; i < blockNodes.length; i++) {
      const n = blockNodes[i]
      if (n.type.name === 'sceneHeader') break
      charCount += n.textContent.length
      const txt = n.textContent.trim()
      if (!firstAction && n.type.name === 'sceneAction' && txt) firstAction = txt
      if (!firstText && txt && n.type.name !== 'sceneCast') firstText = txt
      if (n.type.name === 'sceneDialog') {
        dialogLines++
      }
      // Собираем персонажей из диалогов (case-insensitive, сохраняем порядок первого появления)
      if (n.type.name === 'sceneCharacter') {
        const charName = normalizeCharName(n.textContent.trim())
        if (charName) {
          const upper = charName.toUpperCase()
          if (!dialogCharacterSet.has(upper)) {
            dialogCharacterSet.add(upper)
            dialogCharacters.push(charName)
          }
        }
      }
    }

    // 3. Объединяем: сначала ручной cast (сохраняем порядок), потом новые из диалогов
    const seen = new Set<string>()
    const cast: string[] = []

    manualCast.forEach((name) => {
      const upper = name.toUpperCase()
      if (!seen.has(upper)) {
        seen.add(upper)
        cast.push(name)
      }
    })

    dialogCharacters.forEach((name) => {
      const upper = name.toUpperCase()
      if (!seen.has(upper)) {
        seen.add(upper)
        cast.push(name)
      }
    })

    rawScenes.push({ sceneNumber, sceneId, sceneType, location, sublocation, time, mode, storyDay, omitted, cast, dialogCharacters, charCount, dialogLines, firstAction, firstText, manualDuration })
  })

  // === ПРОХОД 2: распределяем точное кол-во страниц по сценам ===
  const totalCharCount = rawScenes.reduce((sum, s) => sum + s.charCount, 0)
  const effectivePages = forcedPages ?? precisePagesFallback
  const hasPrecisePages = effectivePages > MIN_SCENE_PAGES

  // Дубли номеров («1-13.» дважды) — id должен быть уникальным: суффикс -2, -3…
  const seenIds = new Map<string, number>()
  const uniqId = (base: string) => {
    const n = (seenIds.get(base) || 0) + 1
    seenIds.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }

  const scenes: ExtractedScene[] = rawScenes.map((raw) => {
    // Распределяем precisePages пропорционально charCount каждой сцены.
    // Если precisePages ещё не рассчитан (первый рендер) — fallback на charCount/CHARS_PER_PAGE.
    // Сцены короче MIN_SCENE_CHAR_COUNT считаются как MIN_SCENE_PAGES.
    const pages = hasPrecisePages && totalCharCount > 0
      ? raw.charCount < MIN_SCENE_CHAR_COUNT
        ? MIN_SCENE_PAGES
        : Math.max(MIN_SCENE_PAGES, parseFloat(((raw.charCount / totalCharCount) * effectivePages).toFixed(1)))
      : Math.max(MIN_SCENE_PAGES, parseFloat((raw.charCount / CHARS_PER_PAGE).toFixed(1)))

    // Расчитываем хронометраж от уже точного кол-ва страниц
    // Если задан ручной хронометраж — используем его, иначе рассчитываем
    const calculated = calculateSceneTiming({ pages, charCount: raw.charCount, dialogLines: raw.dialogLines }, timingSystem, genreCoefficient)
    const duration = raw.manualDuration ?? calculated.duration

    // I-176: умный авто-синопсис — «Говорящие · первое действие» (~110 зн.)
    const speakers = (raw.dialogCharacters.length ? raw.dialogCharacters : raw.cast).slice(0, 2).join(', ')
    const snippet = (raw.firstAction || raw.firstText).replace(/\s+/g, ' ')
    const cut = snippet.length > 110 ? snippet.slice(0, 110).replace(/\s+\S*$/, '') + '…' : snippet
    const autoSynopsis = [speakers, cut].filter(Boolean).join(' · ')

    return {
      id: raw.sceneId ?? uniqId(`scene-${raw.sceneNumber}`),
      number: raw.sceneNumber,
      type: raw.sceneType,
      location: raw.location,
      sublocation: raw.sublocation,
      time: raw.time,
      mode: raw.mode,
      storyDay: raw.storyDay,
      omitted: raw.omitted,
      cast: raw.cast,
      dialogCharacters: raw.dialogCharacters,
      autoSynopsis,
      pages,
      duration,
      manualDuration: raw.manualDuration,
      charCount: raw.charCount,
    }
  })

  const stats: ExtractedStats = {
    scenes: scenes.length,
    pages: parseFloat(scenes.reduce((sum, s) => sum + s.pages, 0).toFixed(1)),
    duration: scenes.reduce((sum, s) => sum + s.duration, 0),
  }

  return { scenes, stats }
}
