// T-171: автозакрытие скобок/кавычек + умный Backspace на пустой паре.
// Только текстовые блоки (ремарка, реплика, скобочная, параграф) — не в шапках/именах.
import type { EditorView } from '@tiptap/pm/view'
import { TextSelection } from '@tiptap/pm/state'

const TEXT_BLOCKS = new Set(['sceneAction', 'sceneDialog', 'sceneParenthetical', 'paragraph'])

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '«': '»' }
const CLOSERS = new Set(Object.values(PAIRS))

// Контекст открывающей кавычки: начало текста или после пробела/открывающей скобки/тире
const OPEN_QUOTE_CTX = /[\s([{«\-—…]/

function inTextBlock(view: EditorView, pos: number): boolean {
  const $pos = view.state.doc.resolve(pos)
  return TEXT_BLOCKS.has($pos.parent.type.name)
}

function charAt(view: EditorView, pos: number): string {
  const $pos = view.state.doc.resolve(pos)
  if ($pos.parentOffset >= $pos.parent.nodeSize - 2) return ''
  return $pos.parent.textBetween($pos.parentOffset, $pos.parentOffset + 1, '', '')
}

function cursorTo(view: EditorView, pos: number) {
  const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos)))
  view.dispatch(tr.scrollIntoView())
}

/**
 * Обработка ввода одного символа: парные скобки/кавычки и typeover закрывающих.
 * Возвращает true, если ввод обработан (нужен return true из handleTextInput).
 * autoTypography: если включена — '"' даёт «»/» (умные кавычки), иначе "".
 */
export function handleBracketInput(
  view: EditorView, from: number, to: number, text: string,
  opts: { autoTypography: boolean },
): boolean {
  if (text.length !== 1 || !inTextBlock(view, from)) return false
  const next = charAt(view, from)
  const tr = view.state.tr

  // «(з/к)» при автозакрытии: перед курсором «(з/к», после — «)» из пары.
  // Трансформируем всё в «(З/К)» одной транзакцией (иначе typeover проглотит правило авто-типографики).
  if (text === ')' && next === ')' && opts.autoTypography) {
    const $from = view.state.doc.resolve(from)
    const before = $from.parent.textBetween(0, $from.parentOffset, '', '')
    const m = before.match(/\(з\s*\/\s*к$/i)
    if (m) {
      tr.insertText('(З/К)', from - m[0].length, to + 1)
      view.dispatch(tr.scrollIntoView())
      return true
    }
  }

  // Typeover: печатаем закрывающую прямо перед такой же — просто шаг вперёд
  if ((CLOSERS.has(text) && next === text) || (text === '"' && next === '"')) {
    cursorTo(view, from + 1)
    return true
  }
  // '"' typeover по умной закрывающей »
  if (text === '"' && opts.autoTypography && next === '»') {
    cursorTo(view, from + 1)
    return true
  }

  if (text === '"') {
    const $from = view.state.doc.resolve(from)
    const before = $from.parent.textBetween(0, $from.parentOffset, '', '')
    const prev = before.slice(-1)
    if (opts.autoTypography) {
      // Умные кавычки: открывающий контекст → «» с курсором внутри, иначе закрывающая »
      if (prev === '' || OPEN_QUOTE_CTX.test(prev)) {
        tr.insertText('«»', from, to)
        tr.setSelection(TextSelection.near(tr.doc.resolve(from + 1)))
        view.dispatch(tr.scrollIntoView())
      } else {
        view.dispatch(tr.insertText('»', from, to).scrollIntoView())
      }
      return true
    }
    tr.insertText('""', from, to)
    tr.setSelection(TextSelection.near(tr.doc.resolve(from + 1)))
    view.dispatch(tr.scrollIntoView())
    return true
  }

  if (PAIRS[text]) {
    tr.insertText(text + PAIRS[text], from, to)
    tr.setSelection(TextSelection.near(tr.doc.resolve(from + 1)))
    view.dispatch(tr.scrollIntoView())
    return true
  }

  return false
}

/**
 * Backspace на пустой паре (|) → удаляет обе скобки.
 * Возвращает true, если нажатие обработано.
 */
export function handleBracketBackspace(view: EditorView): boolean {
  const { from, empty } = view.state.selection
  if (!empty || !inTextBlock(view, from)) return false
  const before = charAt(view, from - 1)
  const after = charAt(view, from)
  if (!before || PAIRS[before] !== after) return false
  view.dispatch(view.state.tr.insertText('', from - 1, from + 1).scrollIntoView())
  return true
}
