import { SCENE_NUMBER } from './sceneNumber'
import { SCENE_HEADER_RE_RU, SCENE_HEADER_RE_EN, LOCATION_SYNONYMS } from './formatRules'
import { SCENE_HEADER_RE, parseHeaderTail, fixTimeSlot, suggestDayNumber } from './storyDay'

export type ErrorSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  id: string
  severity: ErrorSeverity
  category: 'format' | 'scene' | 'character' | 'timing'
  message: string
  suggestion?: string
  /** Варианты автофикса на выбор («оставить первый/второй») — для дней/режимов */
  suggestions?: string[]
  autoFixable: boolean
  lineNumber?: number
  /** К какой сцене перейти по клику */
  sceneId?: string
  sceneNumber?: string
  /** Текущий текст блока (для показа «было → станет») */
  content?: string
}

/** Следующий номер сцены по позиции: инкремент последнего числового номера, иначе индекс. */
function nextSceneNumber(lastSceneNum: string, headerIndex: number): string {
  if (lastSceneNum) {
    // «5» → «6»; «1-8» → «1-9»; литерные «1-8-А» → следующий по позиции
    const tail = lastSceneNum.match(/^(.*?)(\d+)$/)
    if (tail) return `${tail[1]}${parseInt(tail[2], 10) + 1}`
  }
  return String(headerIndex)
}

/**
 * Проверка формата блоков сценария (выделено из ScriptRightPanel для тестируемости —
 * логика идентична, поведение не изменено).
 */
export function validateFormatBlocks(
  blocks: Array<{ id: string; type: string; content: string }>,
  format: 'russian' | 'hollywood',
  options?: { storyDays?: boolean }
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  let lineNumber = 1
  let lastSceneNum = ''
  let headerIndex = 0
  // Контекст сценарных дней для подсказок (последний обычный день/режим)
  let lastDay: { mode: string; value: number } | null = null
  let lastMode = ''

  blocks.forEach((block) => {
    const content = block.content.trim()

    if (block.type === 'scene_header') {
      headerIndex++
      const numMatch = content.match(new RegExp(`^(${SCENE_NUMBER})\\.`))
      if (numMatch) lastSceneNum = numMatch[1]
      const numberPattern = new RegExp(`^${SCENE_NUMBER}\\.`)
      if (!numberPattern.test(content)) {
        issues.push({
          id: `fmt-${block.id}-num`,
          severity: 'error',
          category: 'format',
          message:
            'Заголовок сцены должен начинаться с номера (1., 2. или 1-1., 1-2.)',
          suggestion: `${nextSceneNumber(lastSceneNum, headerIndex)}. ${content}`,
          autoFixable: true,
          content,
          lineNumber,
          sceneNumber: lastSceneNum,
        })
      }

      const scenePattern = format === 'russian' ? SCENE_HEADER_RE_RU : SCENE_HEADER_RE_EN

      if (!scenePattern.test(content)) {
        const headMatch = content.match(new RegExp(`^(${SCENE_NUMBER})\\.\\s*(\\S+)(.*)$`))
        const rawToken = (headMatch?.[2] ?? '').replace(/\.$/, '')
        const canonToken = LOCATION_SYNONYMS[rawToken] ?? LOCATION_SYNONYMS[rawToken.toUpperCase()]
        const canAutoFix = format === 'russian' && !!canonToken
        issues.push({
          id: `fmt-${block.id}-fmt`,
          severity: 'warning',
          category: 'format',
          message:
            format === 'russian'
              ? 'Формат: НОМЕР. ИНТ/НАТ. ЛОКАЦИЯ — ВРЕМЯ'
              : 'Format: NUMBER. INT/EXT. LOCATION — TIME',
          suggestion: canAutoFix && headMatch
            ? `${headMatch[1]}. ${canonToken}${headMatch[3]}`
            : undefined,
          autoFixable: !!canAutoFix,
          content,
          lineNumber,
          sceneNumber: lastSceneNum,
        })
      }

      // ── Сценарные дни (спека 08_СЦЕНАРНЫЕ_ДНИ.md): режим+день в шапке ──
      if (options?.storyDays) {
        const hm = content.match(SCENE_HEADER_RE)
        if (hm) {
          const p = parseHeaderTail(hm[3], hm[1])
          const absZone = content.length - hm[3].length + p.zoneStart
          const wrap = (fixedSlot: string) => content.slice(0, absZone) + fixedSlot + p.suffix
          if (!p.omitted) {
            for (const pi of p.issues) {
              if (pi.code === 'double-mode') {
                issues.push({
                  id: `fmt-${block.id}-dmode`,
                  severity: 'error',
                  category: 'format',
                  message: `Два режима времени в шапке: ${p.modes.map(t => t.word).join(' и ')} — оставьте один`,
                  suggestions: p.modes.map((_, i) => wrap(fixTimeSlot(p.slotText, p, { type: 'keep-mode', index: i }))),
                  autoFixable: true,
                  content,
                  lineNumber,
                  sceneNumber: lastSceneNum,
                })
              } else if (pi.code === 'double-day') {
                issues.push({
                  id: `fmt-${block.id}-dday`,
                  severity: 'error',
                  category: 'format',
                  message: `Два номера дня в шапке: ${p.dayTokens.map(t => t.raw).join(' и ')} — оставьте один`,
                  suggestions: p.dayTokens.map((_, i) => wrap(fixTimeSlot(p.slotText, p, { type: 'keep-day', index: i }))),
                  autoFixable: true,
                  content,
                  lineNumber,
                  sceneNumber: lastSceneNum,
                })
              } else if (pi.code === 'day-without-mode') {
                const mode = lastMode || 'ДЕНЬ'
                issues.push({
                  id: `fmt-${block.id}-nomode`,
                  severity: 'warning',
                  category: 'format',
                  message: `Номер дня без режима времени — добавьте режим (например, ${mode})`,
                  suggestion: wrap(fixTimeSlot(p.slotText, p, { type: 'add-mode', mode })),
                  autoFixable: true,
                  content,
                  lineNumber,
                  sceneNumber: lastSceneNum,
                })
              } else if (pi.code === 'missing-day') {
                const n = suggestDayNumber(lastDay, p.mode)
                issues.push({
                  id: `fmt-${block.id}-noday`,
                  severity: 'warning',
                  category: 'format',
                  message: `Не указан номер сценарного дня — по логике: ${n}`,
                  suggestion: wrap(fixTimeSlot(p.slotText, p, { type: 'add-day', day: n })),
                  autoFixable: true,
                  content,
                  lineNumber,
                  sceneNumber: lastSceneNum,
                })
              }
            }
            // Шапка совсем без времени/дня (и без ошибок) — день обязателен
            if (!p.day && p.issues.length === 0) {
              const mode = lastMode || 'ДЕНЬ'
              const n = suggestDayNumber(lastDay, mode)
              issues.push({
                id: `fmt-${block.id}-noday`,
                severity: 'warning',
                category: 'format',
                message: `Не указан номер сценарного дня — по логике: ${n}`,
                suggestion: `${content} — ${mode} ${n}`,
                autoFixable: true,
                content,
                lineNumber,
                sceneNumber: lastSceneNum,
              })
            }
          }
          if (!p.omitted && p.day?.kind === 'normal' && p.day.value != null) {
            lastDay = { mode: p.mode, value: p.day.value }
          }
          if (!p.omitted && p.mode) lastMode = p.mode
        }
      }
    }

    if (block.type === 'character') {
      // Заглавные + дефисы/тире для двойных фамилий (АННА-МАРИЯ) + скобка-пометка (ЗА КАДРОМ, В РАКУРСЕ)
      if (!/^[А-ЯЁA-Z\s\-–—]+(?:\s*\([^)]*\))?$/.test(content)) {
        issues.push({
          id: `fmt-${block.id}-case`,
          severity: 'warning',
          category: 'format',
          message: 'Имя персонажа должно быть ЗАГЛАВНЫМИ буквами',
          suggestion: content.toUpperCase(),
          autoFixable: true,
          content,
          lineNumber,
          sceneNumber: lastSceneNum,
        })
      }
      if (/\d/.test(content)) {
        issues.push({
          id: `fmt-${block.id}-num`,
          severity: 'error',
          category: 'format',
          message: 'Имя персонажа не должно содержать цифры',
          autoFixable: false,
          content,
          lineNumber,
          sceneNumber: lastSceneNum,
        })
      }
    }

    if (block.type === 'parenthetical') {
      if (!/^\(.*\)$/.test(content)) {
        issues.push({
          id: `fmt-${block.id}-parens`,
          severity: 'error',
          category: 'format',
          message: 'Ремарка должна быть в скобках (текст)',
          suggestion: `(${content.replace(/[()]/g, '')})`,
          autoFixable: true,
          content,
          lineNumber,
          sceneNumber: lastSceneNum,
        })
      }
      if (/^\(\s*\)$/.test(content)) {
        issues.push({
          id: `fmt-${block.id}-empty`,
          severity: 'warning',
          category: 'format',
          message: 'Ремарка не должна быть пустой',
          autoFixable: false,
          content,
          lineNumber,
          sceneNumber: lastSceneNum,
        })
      }
    }

    if (block.type === 'transition') {
      if (!/:$/.test(content)) {
        issues.push({
          id: `fmt-${block.id}-colon`,
          severity: 'warning',
          category: 'format',
          message: 'Переход должен заканчиваться двоеточием',
          suggestion: `${content}:`,
          autoFixable: true,
          content,
          lineNumber,
          sceneNumber: lastSceneNum,
        })
      }
    }

    lineNumber++
  })

  return issues
}
