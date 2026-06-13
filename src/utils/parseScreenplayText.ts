/**
 * Парсит сырой текст сценария и превращает его в структурированные блоки.
 * Распознаёт: шапки сцен, персонажей, ремарки, диалоги, переходы, действия.
 *
 * Используется при вставке текста (paste) — чтобы пользователь мог скопировать
 * сценарий из Word/Google Docs и получить правильное форматирование.
 */

export type ScreenplayBlockType =
  | 'sceneHeader'
  | 'sceneCast'
  | 'sceneAction'
  | 'sceneCharacter'
  | 'sceneParenthetical'
  | 'sceneDialog'
  | 'sceneTransition'

export interface ScreenplayBlock {
  type: ScreenplayBlockType
  content: string
}

const HEADER_PATTERN = /^(\d+(?:-\d+)?\.\s*)?(ИНТ\.|ЭКСТ\.|ИНТ-ЭКСТ\.|ПАВ\.|НАТ\.)/i

const TRANSITION_PATTERN = /^(РАССВЕТ|ЗАТЕМНЕНИЕ|ПЕРЕХОД|СМЕНА|CUT TO|FADE IN|FADE OUT|DISSOLVE TO)$/i

/** Проверяет, является ли строка именем персонажа */
function isCharacterName(line: string): boolean {
  const trimmed = line.trim()
  // Допускаем расширения типа "РОМА (З.К.)" или "ОСИНА (V.O.)"
  const withoutExtension = trimmed.replace(/\s*\([^)]*\)$/, '')
  if (withoutExtension.length < 2 || withoutExtension.length > 30) return false
  // Только заглавные буквы, пробелы, дефисы, апострофы (с допуском расширения)
  return /^[А-ЯЁA-Z\s\-'']+$/.test(withoutExtension) && /[А-ЯЁA-Z]/.test(withoutExtension)
}

/** Проверяет, является ли строка списком действующих лиц (заглавные + запятые) */
function isCastLine(line: string): boolean {
  const trimmed = line.trim()
  // Расширения (З.К.) в конце одного из имён
  const withoutExtension = trimmed.replace(/\s*\([^)]*\)$/, '')
  if (withoutExtension.length < 2) return false
  // Заглавные буквы, пробелы, дефисы, апострофы, запятые
  return /^[А-ЯЁA-Z\s\-',]+$/.test(withoutExtension) && /[А-ЯЁA-Z]/.test(withoutExtension)
}

/** Проверяет, является ли строка ремаркой */
function isParenthetical(line: string): boolean {
  const trimmed = line.trim()
  return /^\([^)]*\)$/.test(trimmed)
}

/** Проверяет, является ли строка шапкой сцены */
function isSceneHeader(line: string): boolean {
  return HEADER_PATTERN.test(line.trim())
}

/** Проверяет, является ли строка переходом */
function isTransition(line: string): boolean {
  return TRANSITION_PATTERN.test(line.trim())
}

/**
 * Главная функция парсинга.
 * Разбивает текст на строки, анализирует контекст, определяет тип каждого блока.
 */
export function parseScreenplayText(text: string): ScreenplayBlock[] {
  if (!text || !text.trim()) return []

  // Нормализуем переносы строк
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  const blocks: ScreenplayBlock[] = []
  let currentActionLines: string[] = []
  let prevType: ScreenplayBlockType | null = null

  const flushAction = () => {
    if (currentActionLines.length > 0) {
      blocks.push({
        type: 'sceneAction',
        content: currentActionLines.join('\n'),
      })
      currentActionLines = []
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // Пустая строка — разделитель блоков
    if (!trimmed) {
      flushAction()
      prevType = null
      continue
    }

    // Шапка сцены
    if (isSceneHeader(trimmed)) {
      flushAction()
      blocks.push({ type: 'sceneHeader', content: trimmed })
      prevType = 'sceneHeader'
      continue
    }

    // Действующие лица: заглавные через запятую ИЛИ одно имя сразу после шапки
    if (
      (prevType === 'sceneHeader' || prevType === 'sceneCast') &&
      isCastLine(trimmed)
    ) {
      flushAction()
      blocks.push({ type: 'sceneCast', content: trimmed })
      prevType = 'sceneCast'
      continue
    }

    // Переход
    if (isTransition(trimmed)) {
      flushAction()
      blocks.push({ type: 'sceneTransition', content: trimmed })
      prevType = 'sceneTransition'
      continue
    }

    // Ремарка (в скобках)
    if (isParenthetical(trimmed)) {
      // Ремарка может идти только после персонажа или другой ремарки
      if (prevType === 'sceneCharacter' || prevType === 'sceneParenthetical') {
        flushAction()
        blocks.push({ type: 'sceneParenthetical', content: trimmed })
        prevType = 'sceneParenthetical'
        continue
      }
      // Если ремарка вне контекста — считаем действием
      currentActionLines.push(line)
      prevType = 'sceneAction'
      continue
    }

    // Персонаж
    if (isCharacterName(trimmed)) {
      flushAction()
      blocks.push({ type: 'sceneCharacter', content: trimmed })
      prevType = 'sceneCharacter'
      continue
    }

    // Всё остальное — действие или диалог
    // Диалог: текст после персонажа/ремарки
    if (
      prevType === 'sceneCharacter' ||
      prevType === 'sceneParenthetical'
    ) {
      flushAction()
      blocks.push({ type: 'sceneDialog', content: trimmed })
      prevType = 'sceneDialog'
      continue
    }

    // Если после диалога — новая строка без разделителя, это может быть:
    // - продолжение диалога (если не похоже на персонажа/шапку)
    // - действие (если это описание)
    if (prevType === 'sceneDialog') {
      // Проверяем: похоже ли это на начало новой реплики?
      // Если строка короткая и заканчивается многоточием или тире — вероятно, продолжение
      blocks.push({ type: 'sceneDialog', content: trimmed })
      prevType = 'sceneDialog'
      continue
    }

    // По умолчанию — действие
    currentActionLines.push(line)
    prevType = 'sceneAction'
  }

  flushAction()
  return blocks
}

/**
 * Конвертирует массив блоков в HTML, понятный Tiptap.
 * Каждый блок оборачивается в div с data-type атрибутом.
 */
export function blocksToHtml(blocks: ScreenplayBlock[]): string {
  const typeAttrMap: Record<ScreenplayBlockType, string> = {
    sceneHeader: 'scene-header',
    sceneCast: 'scene-cast',
    sceneAction: 'scene-action',
    sceneCharacter: 'scene-character',
    sceneParenthetical: 'scene-parenthetical',
    sceneDialog: 'scene-dialog',
    sceneTransition: 'scene-transition',
  }

  return blocks
    .map((block) => {
      const attr = typeAttrMap[block.type]
      const escaped = block.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<div data-type="${attr}">${escaped}</div>`
    })
    .join('')
}
