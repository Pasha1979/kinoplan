import { useMemo } from 'react'
import type { Scene } from '../types/scene'

export interface ScriptStatsAlert {
  id: string
  severity: 'warning' | 'info'
  message: string
  sceneId?: string
  sceneNumber?: string
}

export interface CharacterStat {
  name: string
  scenes: number
  dialogScenes: number
  /** суммарный хронометраж сцен, где персонаж в cast */
  durationSec: number
  /** id первой сцены где появляется — для перехода */
  firstSceneId?: string
}

export interface SceneTimingStat {
  id: string
  number: string
  durationSec: number
  pages: number
}

export interface NamedCount {
  name: string
  count: number
  /** суммарный хронометраж сцен (где считается) */
  durationSec?: number
}

export interface LocationGroup {
  name: string
  count: number
  /** суммарный хронометраж сцен в этой локации */
  durationSec: number
  sublocations: NamedCount[]
}

export interface ScriptStats {
  // Итоги
  totalScenes: number
  totalPages: number
  totalChars: number
  totalWords: number
  totalDurationSec: number
  avgDurationSec: number
  // ИНТ/ЭКСТ
  intCount: number
  extCount: number
  intExtCount: number
  pavCount: number
  // Время суток
  timeOfDay: NamedCount[]
  // Диалог/действие
  dialogBlocks: number
  actionBlocks: number
  dialogRatio: number // 0..1
  // Персонажи
  characters: CharacterStat[]
  totalCharacters: number
  speakingCharacters: number
  // Локации
  locations: LocationGroup[]
  // Хронометраж по сценам (для графика)
  sceneTimings: SceneTimingStat[]
  // Темп по сценам: доля диалога vs действия (0..1), только при несфильтрованных сценах
  tempo: SceneTempoStat[]
  // Алерты
  alerts: ScriptStatsAlert[]
}

export interface SceneTempoStat {
  id: string
  number: string
  dialogChars: number
  actionChars: number
  /** доля диалога 0..1 */
  ratio: number
}

interface BlockLike {
  type: string
  content: string
  /** T-103: data-scene-id шапки — устойчивый маппинг на сцену */
  sceneId?: string
}

const LONG_SCENE_SEC = 180 // >3 минут — длинная сцена
const MISSING_CHAR_SCENES = 5 // персонаж пропал на N+ сцен
const DIALOG_ONLY_STREAK = 3 // 3+ сцен подряд только диалоги

export function useScriptStats(
  scenes: Scene[],
  blocks: BlockLike[],
  precisePages: number,
  /** true когда показываем подмножество сцен (фильтр по серии):
   *  тогда глобальные метрики по блокам документа нечестно отображать как «по серии» */
  isFiltered = false,
  /** полный список сцен документа — нужен чтобы темп считался по блокам,
   *  выровненным с полным порядком сцен (фильтрация по серии — в UI) */
  allScenes?: Scene[],
): ScriptStats {
  return useMemo(() => {
    const totalScenes = scenes.length
    const totalChars = scenes.reduce((s, sc) => s + (sc.charCount || 0), 0)
    const totalWords = Math.round(totalChars / 6) // приближение: ~6 символов на слово
    const totalDurationSec = scenes.reduce(
      (s, sc) => s + (sc.manualDuration ?? sc.duration ?? 0),
      0,
    )
    const avgDurationSec = totalScenes ? Math.round(totalDurationSec / totalScenes) : 0

    // ИНТ/ЭКСТ
    let intCount = 0, extCount = 0, intExtCount = 0, pavCount = 0
    scenes.forEach((sc) => {
      const t = (sc.type || '').toUpperCase()
      if (t.includes('ИНТ-ЭКСТ') || t.includes('ИНТ/ЭКСТ')) intExtCount++
      else if (t.startsWith('ИНТ')) intCount++
      else if (t.startsWith('ЭКСТ')) extCount++
      else pavCount++
    })

    // Время суток
    const todMap = new Map<string, number>()
    scenes.forEach((sc) => {
      const t = (sc.time || '').trim().toUpperCase().replace(/\.$/, '') || 'НЕ УКАЗАНО'
      todMap.set(t, (todMap.get(t) || 0) + 1)
    })
    const timeOfDay = [...todMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Диалог/действие — по объёму текста (символы), не по числу блоков:
    // одна длинная ремарка ≠ одной короткой реплике
    const dialogBlocks = blocks.filter(
      (b) => b.type === 'dialog' || b.type === 'character',
    ).length
    const actionBlocks = blocks.filter((b) => b.type === 'action').length
    const dialogCharsTotal = blocks
      .filter((b) => b.type === 'dialog')
      .reduce((s, b) => s + b.content.length, 0)
    const actionCharsTotal = blocks
      .filter((b) => b.type === 'action')
      .reduce((s, b) => s + b.content.length, 0)
    let dialogRatio = dialogCharsTotal + actionCharsTotal > 0
      ? dialogCharsTotal / (dialogCharsTotal + actionCharsTotal)
      : 0

    // Персонажи — активность по сценам
    // Сценарные уточнения в скобках — не часть имени: САНТЬЯГА (з/к) → САНТЬЯГА
    const normName = (name: string) =>
      name.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()

    const charMap = new Map<string, { scenes: number; dialogScenes: number; durationSec: number; firstSceneId?: string }>()
    scenes.forEach((sc) => {
      const dur = sc.manualDuration ?? sc.duration ?? 0
      const seen = new Set<string>()
      ;(sc.cast || []).forEach((name) => {
        const key = normName(name)
        if (!key || seen.has(key)) return
        seen.add(key)
        const entry = charMap.get(key) || { scenes: 0, dialogScenes: 0, durationSec: 0 }
        entry.scenes++
        entry.durationSec += dur
        if (!entry.firstSceneId) entry.firstSceneId = sc.id
        charMap.set(key, entry)
      })
      ;(sc.dialogCharacters || []).forEach((name) => {
        const key = normName(name)
        if (!key) return
        const entry = charMap.get(key) || { scenes: 0, dialogScenes: 0, durationSec: 0 }
        entry.dialogScenes++
        charMap.set(key, entry)
      })
    })
    const characters: CharacterStat[] = [...charMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.scenes - a.scenes)
    const speakingCharacters = characters.filter((c) => c.dialogScenes > 0).length

    // Локации — иерархия: основная → подлокации
    const locMap = new Map<string, { count: number; durationSec: number; sub: Map<string, { count: number; durationSec: number }> }>()
    scenes.forEach((sc) => {
      const dur = sc.manualDuration ?? sc.duration ?? 0
      const l = (sc.location || '').trim() || 'БЕЗ ЛОКАЦИИ'
      const entry = locMap.get(l) || { count: 0, durationSec: 0, sub: new Map() }
      entry.count++
      entry.durationSec += dur
      const sub = (sc.sublocation || '').trim()
      if (sub) {
        const se = entry.sub.get(sub) || { count: 0, durationSec: 0 }
        se.count++
        se.durationSec += dur
        entry.sub.set(sub, se)
      }
      locMap.set(l, entry)
    })
    // Группировка «родственных» локаций: У ШТАБА НАВОВ / ШТАБ НАВОВ,
    // У КВАРТИРЫ ПЕТИ / КВАРТИРА ПЕТИ — одно место. Ключ — последнее слово
    // локации (склонение меняет только предлог/первое слово).
    const lastWord = (name: string) => {
      const parts = name.trim().split(/\s+/)
      return (parts[parts.length - 1] || name).toUpperCase()
    }
    const rawLocs: LocationGroup[] = [...locMap.entries()].map(([name, v]) => ({
      name,
      count: v.count,
      durationSec: v.durationSec,
      sublocations: [...v.sub.entries()]
        .map(([n, c]) => ({ name: n, count: c.count, durationSec: c.durationSec }))
        .sort((a, b) => b.count - a.count),
    }))
    // Группы по последнему слову; порядок групп — по макс. количеству сцен в группе
    const groupMax = new Map<string, number>()
    rawLocs.forEach((l) => {
      const k = lastWord(l.name)
      groupMax.set(k, Math.max(groupMax.get(k) || 0, l.count))
    })
    const locations = rawLocs.sort((a, b) => {
      const ga = groupMax.get(lastWord(a.name)) || 0
      const gb = groupMax.get(lastWord(b.name)) || 0
      if (ga !== gb) return gb - ga        // сначала группа с большим максимумом
      return b.count - a.count             // внутри группы — по кол-ву сцен
    })

    // Хронометраж по сценам
    const sceneTimings: SceneTimingStat[] = scenes.map((sc) => ({
      id: sc.id,
      number: sc.number,
      durationSec: sc.manualDuration ?? sc.duration ?? 0,
      pages: sc.pages || 0,
    }))

    // Страницы — сумма страниц сцен текущего набора. Для сериала под «Все»
    // сцены объединяют все скрипты → сумма честнее, чем precisePages
    // (это только открытый документ). Fallback на precisePages если у сцен
    // страниц нет вовсе (старые данные без разметки)
    const scenesPagesSum = scenes.reduce((s, sc) => s + (sc.pages || 0), 0)
    const totalPages = scenesPagesSum > 0 ? scenesPagesSum : (isFiltered ? 0 : precisePages)

    // Темп по сценам — считаем по ПОЛНОМУ списку сцен. T-103: маппинг блоков
    // по сценам устойчив к нераспарсенным шапкам — сцена определяется по
    // data-scene-id (UUID), затем по номеру в тексте шапки, позиция — fallback.
    const tempo: SceneTempoStat[] = []
    const tempoScenes = allScenes ?? scenes
    {
      const sceneById = new Map(tempoScenes.map((s) => [s.id, s]))
      const normNum = (s: string) => s.replace(/\./g, '').toLowerCase()
      const sceneByNumber = new Map(tempoScenes.map((s) => [normNum(s.number), s]))
      const numRe = /^([\dА-ЯA-Zа-я\-]+)\./
      const buckets = new Map<string, { dlg: number; act: number }>()

      let seqIdx = -1
      let current: Scene | null = null
      blocks.forEach((b) => {
        if (b.type === 'scene_header') {
          seqIdx++
          current = (b.sceneId ? sceneById.get(b.sceneId) : undefined) ?? null
          if (!current) {
            const m = b.content.trim().match(numRe)
            if (m) current = sceneByNumber.get(normNum(m[1])) ?? null
          }
          if (!current) current = tempoScenes[seqIdx] ?? null
        } else if (current && b.type === 'dialog') {
          const bk = buckets.get(current.id) ?? { dlg: 0, act: 0 }
          bk.dlg += b.content.length
          buckets.set(current.id, bk)
        } else if (current && b.type === 'action') {
          const bk = buckets.get(current.id) ?? { dlg: 0, act: 0 }
          bk.act += b.content.length
          buckets.set(current.id, bk)
        }
      })

      tempoScenes.forEach((sc) => {
        const bk = buckets.get(sc.id)
        if (!bk) return
        const total = bk.dlg + bk.act
        tempo.push({
          id: sc.id,
          number: sc.number,
          dialogChars: bk.dlg,
          actionChars: bk.act,
          ratio: total > 0 ? bk.dlg / total : 0,
        })
      })

      // Диалог/действие честно по отфильтрованным сценам:
      // суммируем объёмы только сцен текущего набора (tempo уже сгруппирован по сценам)
      const filteredIds = new Set(scenes.map((s) => s.id))
      let fd = 0, fa = 0
      tempo.forEach((t) => {
        if (filteredIds.has(t.id)) { fd += t.dialogChars; fa += t.actionChars }
      })
      if (fd + fa > 0) dialogRatio = fd / (fd + fa)
    }

    // ─── Алерты ───
    const alerts: ScriptStatsAlert[] = []

    // Длинные сцены
    scenes.forEach((sc) => {
      const dur = sc.manualDuration ?? sc.duration ?? 0
      if (dur > LONG_SCENE_SEC) {
        alerts.push({
          id: `long-${sc.id}`,
          severity: 'warning',
          message: `Сцена ${sc.number}: ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')} — длиннее 3 минут`,
          sceneId: sc.id,
          sceneNumber: sc.number,
        })
      }
    })

    // Персонаж пропал на N+ сцен
    characters.forEach((ch) => {
      if (ch.scenes < 2) return
      const sceneIndices = scenes
        .map((sc, i) => ((sc.cast || []).some((c) => c.toUpperCase().trim() === ch.name) ? i : -1))
        .filter((i) => i >= 0)
      for (let i = 1; i < sceneIndices.length; i++) {
        const gap = sceneIndices[i] - sceneIndices[i - 1] - 1
        if (gap >= MISSING_CHAR_SCENES) {
          alerts.push({
            id: `missing-${ch.name}-${i}`,
            severity: 'info',
            message: `${ch.name}: пропал на ${gap} сцен (между ${scenes[sceneIndices[i - 1]].number} и ${scenes[sceneIndices[i]].number})`,
            sceneId: scenes[sceneIndices[i]].id,
            sceneNumber: scenes[sceneIndices[i]].number,
          })
          break
        }
      }
      // Пропал до конца
      const lastIdx = sceneIndices[sceneIndices.length - 1]
      if (lastIdx !== undefined && scenes.length - 1 - lastIdx >= MISSING_CHAR_SCENES) {
        alerts.push({
          id: `missing-end-${ch.name}`,
          severity: 'info',
          message: `${ch.name}: не появляется после сцены ${scenes[lastIdx].number} (${scenes.length - 1 - lastIdx} сцен до конца)`,
          sceneId: scenes[lastIdx].id,
          sceneNumber: scenes[lastIdx].number,
        })
      }
    })

    // 3+ сцен подряд без action (только диалоги): сцены где все говорящие и нет действия
    // Приближение: у сцены есть dialogCharacters и charCount низкий относительно реплик — сложно.
    // Проще: сцены без action-блоков определить нельзя по Scene — считаем серии
    // где dialogCharacters заполнены, а action отсутствует — по blocks между шапками.
    let streak = 0
    let streakStart = -1
    const sceneHeaders = blocks.filter((b) => b.type === 'scene_header').length
    if (sceneHeaders > 0 && !isFiltered) {
      // Считаем action-блоки между шапками
      let inSceneIdx = -1
      let sceneHasAction = false
      const markStreak = (hasAction: boolean) => {
        if (!hasAction) {
          if (streak === 0) streakStart = inSceneIdx
          streak++
        } else {
          streak = 0
          streakStart = -1
        }
        if (streak === DIALOG_ONLY_STREAK && streakStart >= 0 && scenes[streakStart]) {
          alerts.push({
            id: `dialog-streak-${streakStart}`,
            severity: 'info',
            message: `${DIALOG_ONLY_STREAK} сцены подряд только диалог (начиная со сцены ${scenes[streakStart].number}) — добавить действие?`,
            sceneId: scenes[streakStart].id,
            sceneNumber: scenes[streakStart].number,
          })
        }
      }
      blocks.forEach((b) => {
        if (b.type === 'scene_header') {
          if (inSceneIdx >= 0) markStreak(sceneHasAction)
          inSceneIdx++
          sceneHasAction = false
        } else if (b.type === 'action' && b.content.trim()) {
          sceneHasAction = true
        }
      })
      if (inSceneIdx >= 0) markStreak(sceneHasAction)
    } else if (isFiltered) {
      // Под фильтром серии считаем стрик по темпу: у сцены нет action-текста
      const tempoById = new Map(tempo.map((t) => [t.id, t]))
      let fStreak = 0, fStart = -1
      scenes.forEach((sc, i) => {
        const hasAction = (tempoById.get(sc.id)?.actionChars ?? 0) > 0
        if (!hasAction) {
          if (fStreak === 0) fStart = i
          fStreak++
        } else { fStreak = 0; fStart = -1 }
        if (fStreak === DIALOG_ONLY_STREAK && fStart >= 0) {
          alerts.push({
            id: `dialog-streak-f-${fStart}`,
            severity: 'info',
            message: `${DIALOG_ONLY_STREAK} сцены подряд только диалог (начиная со сцены ${scenes[fStart].number}) — добавить действие?`,
            sceneId: scenes[fStart].id,
            sceneNumber: scenes[fStart].number,
          })
        }
      })
    }

    // Поздний персонаж — впервые появляется после 60% сценария
    characters.forEach((ch) => {
      if (!ch.firstSceneId || ch.scenes < 2) return
      const idx = scenes.findIndex((sc) => sc.id === ch.firstSceneId)
      if (idx > 0 && idx / scenes.length >= 0.6) {
        alerts.push({
          id: `late-${ch.name}`,
          severity: 'info',
          message: `${ch.name}: впервые появляется только в сцене ${scenes[idx].number} (${Math.round((idx / scenes.length) * 100)}% сценария) — герой заявлен поздно`,
          sceneId: scenes[idx].id,
          sceneNumber: scenes[idx].number,
        })
      }
    })

    // Непрерывность: время суток изменилось без перехода
    for (let i = 1; i < scenes.length; i++) {
      const prev = scenes[i - 1].time?.trim().toUpperCase()
      const cur = scenes[i].time?.trim().toUpperCase()
      if (prev && cur && prev !== cur) {
        const sameLoc = scenes[i - 1].location?.trim().toUpperCase() === scenes[i].location?.trim().toUpperCase()
        if (sameLoc) {
          alerts.push({
            id: `continuity-${scenes[i].id}`,
            severity: 'info',
            message: `Сцена ${scenes[i].number}: время сменилось ${prev} → ${cur} в той же локации — нужен переход?`,
            sceneId: scenes[i].id,
            sceneNumber: scenes[i].number,
          })
        }
      }
    }

    return {
      totalScenes,
      totalPages,
      totalChars,
      totalWords,
      totalDurationSec,
      avgDurationSec,
      intCount,
      extCount,
      intExtCount,
      pavCount,
      timeOfDay,
      dialogBlocks,
      actionBlocks,
      dialogRatio,
      characters,
      totalCharacters: characters.length,
      speakingCharacters,
      locations,
      sceneTimings,
      tempo,
      alerts,
    }
  }, [scenes, blocks, precisePages, isFiltered, allScenes])
}
