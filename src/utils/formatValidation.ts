import { SCENE_NUMBER } from './sceneNumber'
import { SCENE_HEADER_RE_RU, SCENE_HEADER_RE_EN, LOCATION_SYNONYMS } from './formatRules'

export type ErrorSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  id: string
  severity: ErrorSeverity
  category: 'format' | 'scene' | 'character' | 'timing'
  message: string
  suggestion?: string
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
  format: 'russian' | 'hollywood'
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  let lineNumber = 1
  let lastSceneNum = ''
  let headerIndex = 0

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
