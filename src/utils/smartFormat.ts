import { parseScreenplayText, blocksToHtml } from './parseScreenplayText'
import type { ScreenplayBlock } from './parseScreenplayText'

const TIME_WORDS = new Set([
  'ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ',
  'DAY', 'NIGHT', 'MORNING', 'EVENING', 'DAWN', 'DUSK',
])

const TRANSITION_WORDS = new Set([
  'РАССВЕТ', 'ЗАТЕМНЕНИЕ', 'ПЕРЕХОД', 'СМЕНА',
  'CUT TO', 'FADE IN', 'FADE OUT', 'DISSOLVE TO',
])

const HEADER_RE = /(\d+(?:-\d+)?\.\s*)?(ИНТ|ЭКСТ|ИНТ-ЭКСТ|ПАВ|НАТ)\./i

const TIME_WORD_RE = /(?:ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ|DAY|NIGHT|MORNING|EVENING|DAWN|DUSK)/i

// Союзы и предлоги в нижнем регистре — признак текста действия, не реплики
const LOWERCASE_CONJUNCTIONS = new Set([
  'и', 'а', 'но', 'или', 'ли', 'бы', 'же', 'в', 'во', 'на', 'с', 'со', 'к', 'ко',
  'у', 'о', 'об', 'от', 'ото', 'до', 'по', 'за', 'под', 'над', 'перед', 'между',
  'для', 'без', 'из', 'от', 'через', 'про', 'при', 'что', 'чтобы', 'как', 'так',
])

/** Проверяет, является ли слово ALL CAPS именем (без расширений) */
function isAllCapsWord(w: string): boolean {
  return /^[А-ЯЁA-Z]{2,}(['\-][А-ЯЁA-Z]+)*$/.test(w)
}

/**
 * Пытается найти имя персонажа начиная с позиции startIdx в массиве слов.
 * Возвращает имя и индекс последнего слова имени, или null.
 * Учитывает: длина 2-30, не time word, не transition,
 * после имени есть текст (диалог), и этот текст не начинается с союза в нижнем регистре.
 */
function tryMatchCharacter(words: string[], startIdx: number): { name: string; endIdx: number } | null {
  if (startIdx >= words.length) return null
  if (!isAllCapsWord(words[startIdx])) return null

  // Собираем последовательные ALL CAPS слова в одно имя
  let endIdx = startIdx
  let name = words[startIdx]
  while (
    endIdx + 1 < words.length &&
    isAllCapsWord(words[endIdx + 1]) &&
    (name + ' ' + words[endIdx + 1]).length <= 30
  ) {
    endIdx++
    name += ' ' + words[endIdx]
  }

  // Проверки
  if (name.length < 2 || name.length > 30) return null
  if (TIME_WORDS.has(name.toUpperCase())) return null
  if (TRANSITION_WORDS.has(name.toUpperCase())) return null

  // Должен быть текст после имени
  if (endIdx + 1 >= words.length) return null

  const nextWord = words[endIdx + 1]

  // Если следующее слово — союз/предлог в нижнем регистре, это действие, не реплика
  // НО: если это скобка (ремарка) — это персонаж
  if (!nextWord.startsWith('(') && LOWERCASE_CONJUNCTIONS.has(nextWord.toLowerCase())) {
    return null
  }

  // Если следующее слово начинается со строчной буквы — скорее всего действие
  // Диалог обычно начинается с заглавной буквы или ремарки в скобках
  if (!nextWord.startsWith('(') && /^[а-яёa-z]/.test(nextWord)) {
    return null
  }

  // Если весь оставшийся текст — ALL CAPS, скорее всего это действие с именами
  const afterText = words.slice(endIdx + 1).join(' ')
  if (/^[А-ЯЁA-Z\s\-']+$/.test(afterText)) return null

  return { name, endIdx }
}

/**
 * Мягкая проверка персонажа — не требует текста после имени.
 * Используется для имён в конце строки, где диалог на следующей строке.
 */
function tryMatchCharacterLoose(words: string[], startIdx: number): { name: string; endIdx: number } | null {
  if (startIdx >= words.length) return null
  if (!isAllCapsWord(words[startIdx])) return null

  let endIdx = startIdx
  let name = words[startIdx]
  while (
    endIdx + 1 < words.length &&
    isAllCapsWord(words[endIdx + 1]) &&
    (name + ' ' + words[endIdx + 1]).length <= 30
  ) {
    endIdx++
    name += ' ' + words[endIdx]
  }

  if (name.length < 2 || name.length > 30) return null
  if (TIME_WORDS.has(name.toUpperCase())) return null
  if (TRANSITION_WORDS.has(name.toUpperCase())) return null

  return { name, endIdx }
}

/**
 * Проверяет, содержит ли текст слитые строки, которые нужно разбить.
 */
export function needsSplitting(text: string): boolean {
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Сцена-шапка не в начале строки
    const match = trimmed.match(HEADER_RE)
    if (match && match.index && match.index > 0) return true

    // Шапка + контент после time word на той же строке
    if (HEADER_RE.test(trimmed)) {
      const headerEndMatch = trimmed.match(/(?:ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ|DAY|NIGHT|MORNING|EVENING|DAWN|DUSK)\s+(.+)/i)
      if (headerEndMatch && headerEndMatch[1]) return true
    }

    // Ремарка inline (не на отдельной строке)
    if (/\S\s*\([^)]*\)/.test(trimmed) && !/^\([^)]*\)$/.test(trimmed)) return true

    // ALL CAPS имя с диалогом — в начале или середине строки
    const words = trimmed.split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      if (tryMatchCharacter(words, i)) return true
    }
  }
  return false
}

/**
 * Разбивает слитый текст на отдельные строки с пустыми строками между блоками.
 * Алгоритм: regex-сплиты для шапок/ремарок → построчный сканер для персонажей.
 * Сканер находит ВСЕ пары персонаж→диалог в строке и добавляет пустые строки.
 */
export function splitMergedText(text: string): string {
  let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 1. Перенос перед нумерованными шапками: "текст1. ИНТ." → "текст\n1. ИНТ."
  // И "текст3-2. ИНТ." → "текст\n3-2. ИНТ." (не разбиваем 3-2 на 3- и 2.)
  result = result.replace(
    /([^\n\d\-])\s*(\d+(?:-\d+)?\.\s*(?:ИНТ|ЭКСТ|ИНТ-ЭКСТ|ПАВ|НАТ)\.)/gi,
    '$1\n$2',
  )

  // 2. Перенос перед ненумерованными шапками
  result = result.replace(
    /([^\n.])\s+((?:ИНТ|ЭКСТ|ИНТ-ЭКСТ|ПАВ|НАТ)\.)/gi,
    '$1\n$2',
  )

  // 3. Перенос перед ремарками: "текст(шёпотом)" → "текст\n(шёпотом)"
  result = result.replace(/([^\n(])\s*(\([^)]*\))/g, '$1\n$2')

  // 4. Перенос после ремарок: "(шёпотом)текст" → "(шёпотом)\nтекст"
  result = result.replace(/(\([^)]*\))\s*([^\n])/g, '$1\n$2')

  // 5. Разделение шапки сцены от последующего контента после time word
  // С пробелом: "1. ИНТ. КВАРТИРА. ДЕНЬ ИВАН" → "1. ИНТ. КВАРТИРА. ДЕНЬ\nИВАН"
  result = result.replace(
    /^((?:\d+(?:-\d+)?\.\s*)?(?:ИНТ|ЭКСТ|ИНТ-ЭКСТ|ПАВ|НАТ)\.[^\n]*?(?:ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ|DAY|NIGHT|MORNING|EVENING|DAWN|DUSK))\s+([^\n]+)$/gim,
    '$1\n$2',
  )
  // 5b. Без пробела: "ДЕНЬЛЕНА" → "ДЕНЬ\nЛЕНА" (time word слит с контентом)
  result = result.replace(
    /((?:ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ|DAY|NIGHT|MORNING|EVENING|DAWN|DUSK))([А-ЯЁA-Z][а-яёa-zА-ЯЁA-Z])/gi,
    '$1\n$2',
  )

  // 6. Построчная обработка: разбивка по персонажам + пустые строки между блоками
  const lines = result.split('\n')
  const output: string[] = []

  // Вспомогательные: добавить строку с пустой строкой после неё (для блоков с отступом)
  const pushBlock = (s: string) => {
    if (s.trim()) {
      output.push(s.trim())
      output.push('')
    }
  }
  // Без пустой строки после — для персонажей и ремарок (диалог идёт сразу после)
  const pushBlockNoGap = (s: string) => {
    if (s.trim()) {
      output.push(s.trim())
    }
  }

  // Эвристика: строка действующих лиц (заглавные с запятыми/слэшами)
  const isCastLine = (line: string): boolean => {
    const trimmed = line.trim().replace(/\s*\([^)]*\)$/, '')
    if (trimmed.length < 2) return false
    if (!/^[А-ЯЁA-Z\s\-',0-9]+$/.test(trimmed)) return false
    if (!trimmed.includes(',') && !trimmed.includes('/')) return false
    const words = trimmed.split(/[\s,\/]+/).filter(w => w.length > 0)
    const allCaps = words.filter(w => /^[А-ЯЁA-Z0-9]+$/.test(w))
    return allCaps.length >= 2 && allCaps.length / words.length >= 0.8
  }

  let lastBlockWasHeader = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      // Сохраняем пустую строку только если предыдущая не пустая
      if (output.length > 0 && output[output.length - 1] !== '') {
        output.push('')
      }
      continue
    }

    // Чистая шапка — добавляем + пустая строка
    if (HEADER_RE.test(trimmed) && !TIME_WORD_RE.test(trimmed.replace(HEADER_RE, ''))) {
      // Шапка без time word — может быть с продолжением на следующей строке
      pushBlock(trimmed)
      lastBlockWasHeader = true
      continue
    }

    // Шапка с time word — проверяем, есть ли контент после
    if (HEADER_RE.test(trimmed)) {
      const headerEndMatch = trimmed.match(/(?:ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ|DAY|NIGHT|MORNING|EVENING|DAWN|DUSK)\s+(.+)/i)
      if (headerEndMatch && headerEndMatch[1]) {
        const headerPart = trimmed.slice(0, trimmed.length - headerEndMatch[1].length).trim()
        pushBlock(headerPart)
        // Остаток обрабатываем как новую строку
        const restWords = headerEndMatch[1].trim().split(/\s+/)
        processWords(restWords, pushBlock, pushBlockNoGap)
        lastBlockWasHeader = false
        continue
      }
      pushBlock(trimmed)
      lastBlockWasHeader = true
      continue
    }

    // Действующие лица (сразу после шапки или в строке)
    if (lastBlockWasHeader || isCastLine(trimmed)) {
      // Нормализуем запятые: добавляем пробел после запятой
      const normalized = trimmed.replace(/,/g, ', ').replace(/\s+/g, ' ')
      if (lastBlockWasHeader || isCastLine(normalized)) {
        pushBlock(normalized)
        lastBlockWasHeader = false
        continue
      }
    }

    // Чистый персонаж (вся строка — ALL CAPS имя)
    const withoutExt = trimmed.replace(/\s*\([^)]*\)$/, '')
    if (
      withoutExt.length >= 2 && withoutExt.length <= 30 &&
      /^[А-ЯЁA-Z\s\-']+$/.test(withoutExt) &&
      !TIME_WORDS.has(trimmed.toUpperCase()) &&
      !TRANSITION_WORDS.has(trimmed.toUpperCase())
    ) {
      // Персонаж — без пустой строки после (диалог идёт сразу)
      // Но добавляем пустую строку перед если предыдущая не пустая
      if (output.length > 0 && output[output.length - 1] !== '') {
        output.push('')
      }
      pushBlockNoGap(trimmed)
      lastBlockWasHeader = false
      continue
    }

    // Чистая ремарка — без пустой строки после (диалог идёт сразу)
    if (/^\([^)]*\)$/.test(trimmed)) {
      pushBlockNoGap(trimmed)
      lastBlockWasHeader = false
      continue
    }

    // Переход
    if (TRANSITION_WORDS.has(trimmed.toUpperCase())) {
      pushBlock(trimmed)
      lastBlockWasHeader = false
      continue
    }

    // Смешанная строка — сканируем слова
    const words = trimmed.split(/\s+/)
    processWords(words, pushBlock, pushBlockNoGap)
    lastBlockWasHeader = false
  }

  // Убираем лишние пустые строки в конце
  while (output.length > 0 && output[output.length - 1] === '') {
    output.pop()
  }
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Обрабатывает массив слов: находит персонажей, отделяет диалоги,
 * добавляет пустые строки между блоками.
 */
function processWords(words: string[], pushBlock: (s: string) => void, pushBlockNoGap: (s: string) => void) {
  let i = 0
  let actionText = ''

  while (i < words.length) {
    // Проверяем, начинается ли с этого слова имя персонажа
    const charMatch = tryMatchCharacter(words, i)

    if (charMatch) {
      // Найден персонаж — сначала выводим накопленное действие
      if (actionText.trim()) {
        pushBlock(actionText.trim())
        actionText = ''
      }

      // Выводим имя персонажа — без пустой строки после
      // Но добавляем пустую строку перед если предыдущая не пустая
      // (pushBlockNoGap не добавляет пустую строку после)
      pushBlockNoGap(charMatch.name)

      // Ищем, где заканчивается диалог — до следующего персонажа
      let dialogEnd = words.length
      for (let j = charMatch.endIdx + 2; j < words.length; j++) {
        // Полное совпадение (персонаж + диалог после)
        if (tryMatchCharacter(words, j)) {
          dialogEnd = j
          break
        }
        // Мягкое совпадение — персонаж в конце строки без диалога на этой строке
        // Не срабатывает если предыдущее слово — союз/предлог в нижнем регистре (значит это действие)
        if (j > 0 && !LOWERCASE_CONJUNCTIONS.has(words[j - 1].toLowerCase()) && tryMatchCharacterLoose(words, j)) {
          dialogEnd = j
          break
        }
      }

      // Текст диалога — между именем и следующим персонажем
      const dialogWords = words.slice(charMatch.endIdx + 1, dialogEnd)
      // Разбиваем диалог на ремарки и текст
      const dialogParts = splitParentheticals(dialogWords.join(' '))
      for (const part of dialogParts) {
        if (/^\([^)]*\)$/.test(part)) {
          // Ремарка — без пустой строки после
          pushBlockNoGap(part)
        } else {
          // Текст диалога — с пустой строкой после
          pushBlock(part)
        }
      }

      i = dialogEnd
      continue
    }

    // Мягкая проверка — персонаж в конце строки (диалог на следующей строке)
    // Срабатывает только если предыдущее слово не союз/предлог в нижнем регистре
    if (
      i > 0 &&
      !LOWERCASE_CONJUNCTIONS.has(words[i - 1].toLowerCase()) &&
      tryMatchCharacterLoose(words, i)
    ) {
      const looseMatch = tryMatchCharacterLoose(words, i)!
      // Выводим накопленный текст (если есть)
      if (actionText.trim()) {
        pushBlock(actionText.trim())
      }
      actionText = ''
      // Выводим имя персонажа — без пустой строки после
      pushBlockNoGap(looseMatch.name)
      i = looseMatch.endIdx + 1
      continue
    }

    actionText += (actionText ? ' ' : '') + words[i]
    i++
  }

  if (actionText.trim()) {
    pushBlock(actionText.trim())
  }
}

/**
 * Разделяет текст на ремарки (в скобках) и обычный текст.
 * "Привет (тихо) дорогая" → ["Привет", "(тихо)", "дорогая"]
 */
function splitParentheticals(text: string): string[] {
  const parts: string[] = []
  let current = ''
  let i = 0

  while (i < text.length) {
    if (text[i] === '(') {
      // Сохраняем накопленный текст
      if (current.trim()) {
        parts.push(current.trim())
        current = ''
      }
      // Ищем закрывающую скобку
      const closeIdx = text.indexOf(')', i)
      if (closeIdx >= 0) {
        parts.push(text.slice(i, closeIdx + 1))
        i = closeIdx + 1
      } else {
        current += text[i]
        i++
      }
    } else {
      current += text[i]
      i++
    }
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

/**
 * Форматирует сырой текст в HTML-блоки сценария.
 * Проход: splitMergedText → parseScreenplayText → blocksToHtml.
 */
export function formatScreenplayToHtml(text: string): string {
  const split = splitMergedText(text)
  const blocks = parseScreenplayText(split)
  return blocksToHtml(blocks)
}

/**
 * Возвращает блоки для предпросмотра (без конвертации в HTML).
 */
export function formatScreenplayToBlocks(text: string): ScreenplayBlock[] {
  const split = splitMergedText(text)
  return parseScreenplayText(split)
}
