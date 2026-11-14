import { describe, it, expect } from 'vitest'
import { paginateBlocks, type MeasuredBlock } from './pagination'
import { SCRIPT_LAYOUT } from '../constants/scriptLayout'
import { ETALONS } from '../../e2e/fixtures/etalons'

/**
 * T-92: доказательство пагинации ПРОТИВ ВНЕШНЕГО эталона (Word COM).
 *
 * word.pages и word.breakStartBlocks в fixtures/etalons.ts — замер
 * эталонных .doc в Microsoft Word через COM (scripts/measure-word.ps1).
 * .doc генерируется боевым пайплайном convertToWordCompatibleHtml с явным
 * @page A4 2/2/2/3cm — та же геометрия, что у виртуального контейнера
 * PageCounter. Это НЕ само-референтный тест: эталон — внешняя программа.
 *
 * Здесь воспроизводится ДЕТЕРМИНИРОВАННАЯ модель измерения Word:
 * - шрифт Courier New 12pt: моноширинный, advance = 0.6em = 7.2pt = 9.6px
 * - line-height 18pt = 24px (SCRIPT_STYLES ставит на каждый блок)
 * - перенос словами (как Word), длинное слово рвётся по символам
 * - space-before применяется и к первому блоку документа — так делает Word
 *   (подтверждено замером: long-scene рвётся на блоке 13, а не 14)
 * Результат подаётся в тот же paginateBlocks, что кормятся DOM-замеры.
 */

const MM_TO_PX = 96 / 25.4 // 3.7795 — та же константа, что в PageCounter
const LINE_H_PX = 24 // 18pt = 12pt × 1.5
const CHAR_W_PX = 9.6 // Courier New 12pt: 7.2pt × (96/72)

// Геометрия страницы — как в PageCounter и @page эталонных .doc
const USABLE_WIDTH_MM = 210 - 30 - 20 // A4 210мм − лево 3см − право 2см
const USABLE_HEIGHT_MM = 297 - 20 - 20 // A4 297мм − верх 2см − низ 2см
const USABLE_HEIGHT_PX = USABLE_HEIGHT_MM * MM_TO_PX

const cmToMm = (v?: string) => (v ? parseFloat(v) * 10 : 0)
const pxOf = (v: string) => parseFloat(v) || 0

/** Горизонтальные отступы типа блока (mm), из SCRIPT_LAYOUT — тот же SSoT, что в .doc */
function indentsMm(dataType: string): number {
  const l = SCRIPT_LAYOUT.russian
  const key = dataType.replace(/^scene-/, '') as keyof typeof l
  const m = l[key]
  if (!m) return 0
  return cmToMm(m.leftIndent) + cmToMm(m.rightIndent) + cmToMm(m.characterIndent)
}

function marginTopPx(dataType: string): number {
  const l = SCRIPT_LAYOUT.russian
  const key = dataType.replace(/^scene-/, '') as keyof typeof l
  const m = l[key]
  return m ? pxOf(m.marginTop) : 0
}

/** Word-обёртка: жадная по словам; слово длиннее строки рвётся по символам */
export function wrapLineCount(text: string, capacityChars: number): number {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1
  let lines = 1
  let col = 0
  for (const w of words) {
    let len = w.length
    if (col > 0 && col + 1 + len <= capacityChars) {
      col += 1 + len
      continue
    }
    if (col > 0) {
      lines++
      col = 0
    }
    while (len > capacityChars) {
      lines++
      len -= capacityChars
    }
    col = len
  }
  return lines
}

/** Парсит HTML эталона → MeasuredBlock[] по модели Word (как их мерил COM) */
function measureLikeWord(html: string): MeasuredBlock[] {
  const blocks: MeasuredBlock[] = []
  const re = /<div data-type="([^"]+)">([^<]*)<\/div>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const [, dataType, text] = m
    const widthMm = USABLE_WIDTH_MM - indentsMm(dataType)
    const capacity = Math.floor((widthMm * MM_TO_PX) / CHAR_W_PX)
    const lines = wrapLineCount(text, capacity)
    blocks.push({
      heightPx: lines * LINE_H_PX,
      marginTopPx: marginTopPx(dataType),
      marginBottomPx: 0,
      dataType,
    })
  }
  return blocks
}

describe('T-92: пагинация против Word (внешний эталон)', () => {
  for (const etalon of ETALONS) {
    it(`${etalon.id}: ${etalon.word.pages} стр., разрывы ${JSON.stringify(etalon.word.breakStartBlocks)}`, () => {
      const blocks = measureLikeWord(etalon.html)
      const { breaks } = paginateBlocks(blocks, USABLE_HEIGHT_PX, LINE_H_PX)

      // Страниц = числу разрывов (первый разрыв — начало стр.1)
      expect(breaks.length).toBe(etalon.word.pages)
      // Индексы блоков, с которых начинаются страницы, — как замерил Word
      expect(breaks.map((b) => b.startIndex)).toEqual([0, ...etalon.word.breakStartBlocks])
    })
  }

  it('таблица расхождений: эталон | Word | модель | разница', () => {
    const rows = ETALONS.map((e) => {
      const { breaks } = paginateBlocks(measureLikeWord(e.html), USABLE_HEIGHT_PX, LINE_H_PX)
      return {
        эталон: e.id,
        'Word стр.': e.word.pages,
        'модель стр.': breaks.length,
        'разница стр.': breaks.length - e.word.pages,
        'Word разрывы': JSON.stringify(e.word.breakStartBlocks),
        'модель разрывы': JSON.stringify(breaks.map((b) => b.startIndex).slice(1)),
      }
    })
    // eslint-disable-next-line no-console
    console.table(rows)
    expect(rows.every((r) => r['разница стр.'] === 0)).toBe(true)
  })

  it('разрыв внутри блока (Word тоже режет абзацы) — splitOffsetPx выставлен', () => {
    // Эталон 2 рвётся ровно на границе блоков; гарантируем, что модель
    // умеет внутриблочный разрыв — иначе фиделити неполна.
    const blocks: MeasuredBlock[] = [
      { heightPx: 24, marginTopPx: 48, marginBottomPx: 0, dataType: 'scene-header' },
      { heightPx: 3 * LINE_H_PX, marginTopPx: 24, marginBottomPx: 0, dataType: 'scene-action' },
    ]
    const { breaks } = paginateBlocks(blocks, 48 + 24 + 24 + LINE_H_PX, LINE_H_PX)
    expect(breaks.length).toBe(2)
    expect(breaks[1].splitOffsetPx).toBeGreaterThan(0)
  })
})
