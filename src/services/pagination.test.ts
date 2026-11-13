import { describe, it, expect } from 'vitest'
import { paginateBlocks, type MeasuredBlock } from './pagination'

// Эталонная геометрия: A4 297мм - 40мм полей = 257мм ≈ 971px при 3.7795px/мм.
// line-height 24px (12pt × 1.5). Тесты работают в px напрямую.
const PAGE = 971
const LINE = 24

const blk = (heightPx: number, dataType: string | null = 'scene-action', marginTopPx = 24): MeasuredBlock => ({
  heightPx,
  marginTopPx,
  marginBottomPx: 0,
  dataType,
})

describe('paginateBlocks — модель marginTop-only (T-94)', () => {
  it('пустой документ → без разрывов', () => {
    expect(paginateBlocks([], PAGE, LINE)).toEqual({ breaks: [], totalHeightPx: 0 })
  })

  it('короткий документ — одна страница', () => {
    const blocks = [blk(24), blk(48), blk(24)]
    const { breaks, totalHeightPx } = paginateBlocks(blocks, PAGE, LINE)
    expect(breaks).toEqual([{ page: 1, startIndex: 0 }])
    // gaps: 24 + 24 + 24; heights: 24+48+24
    expect(totalHeightPx).toBe(72 + 96)
  })

  it('граница считается один раз: marginBottom предыдущего не дублирует gap', () => {
    // prevBottom=48, curTop=24 → коллапс в max=48, а не 72
    const blocks: MeasuredBlock[] = [
      { heightPx: 24, marginTopPx: 0, marginBottomPx: 48, dataType: 'scene-action' },
      { heightPx: 24, marginTopPx: 24, marginBottomPx: 0, dataType: 'scene-action' },
    ]
    const { totalHeightPx } = paginateBlocks(blocks, PAGE, LINE)
    expect(totalHeightPx).toBe(24 + 48 + 24) // height1 + gap(48) + height2
  })

  it('блок упирается в границу → текст делится через разрыв, как в Word', () => {
    // блоки по 500px: первый (0+500), второй — помещается 447px, остаток 53px на стр.2
    const blocks = [blk(500, 'scene-action', 0), blk(500)]
    const { breaks } = paginateBlocks(blocks, PAGE, LINE)
    expect(breaks).toEqual([
      { page: 1, startIndex: 0 },
      { page: 2, startIndex: 1, splitOffsetPx: 447 },
    ])
  })

  it('keep-with-next: шапка сцены не остаётся последней на странице', () => {
    const blocks = [
      blk(900, 'scene-action', 0),        // страница почти полна
      blk(24, 'scene-header', 48),        // шапка — keep-with-next
      blk(24, 'scene-action', 24),        // первый блок новой сцены — не помещается с шапкой? проверяем
    ]
    // 900 + 48+24 = 972 > 971 → блок 2 не влезает уже после шапки?
    // Нет: сначала шапка (900+72=972>971 → шапка сама не помещается → переносится вместе с контентом)
    const { breaks } = paginateBlocks(blocks, PAGE, LINE)
    expect(breaks[1]).toEqual({ page: 2, startIndex: 1 })
  })

  it('keep-with-next: имя персонажа уходит вместе с репликой', () => {
    const blocks = [
      blk(920, 'scene-action', 0),          // почти вся страница
      blk(24, 'scene-character', 24),       // ИВАН — keep-with-next
      blk(48, 'scene-dialog', 0),           // реплика: 920+24+24+48=1016 > 971 → перенос
    ]
    const { breaks } = paginateBlocks(blocks, PAGE, LINE)
    // разрыв должен встать перед персонажем (индекс 1), а не перед репликой
    expect(breaks[1]).toEqual({ page: 2, startIndex: 1 })
  })

  it('разрыв внутри длинной реплики → страница начинается внутри блока (splitOffsetPx)', () => {
    const blocks = [
      blk(24, 'scene-character', 0),
      blk(1200, 'scene-dialog', 24),        // реплика на ~50 строк — больше страницы
    ]
    const { breaks } = paginateBlocks(blocks, PAGE, LINE)
    // стр.1: персонаж 24 + gap24 + часть реплики (971-24-24=923)
    expect(breaks[1]).toEqual({ page: 2, startIndex: 1, splitOffsetPx: 923 })
    // остаток 1200-923=277 < 971 → всего 2 страницы
    expect(breaks).toHaveLength(2)
  })

  it('очень длинный блок → несколько разрывов внутри одного блока', () => {
    const blocks = [blk(971 * 2 + 100, 'scene-action', 0)]
    const { breaks } = paginateBlocks(blocks, PAGE, LINE)
    expect(breaks).toHaveLength(3)
    expect(breaks[1]).toEqual({ page: 2, startIndex: 0, splitOffsetPx: 971 })
    expect(breaks[2]).toEqual({ page: 3, startIndex: 0, splitOffsetPx: 1942 })
  })

  it('неделимый остаток (<1 строки) → блок переносится целиком', () => {
    const blocks = [
      blk(960, 'scene-action', 0),   // почти вся страница
      blk(48, 'scene-action', 24),   // помещается только gap 24-11=... 971-960=11 < gap+line → целиком
    ]
    const { breaks } = paginateBlocks(blocks, PAGE, LINE)
    expect(breaks[1]).toEqual({ page: 2, startIndex: 1, })
    expect(breaks[1].splitOffsetPx).toBeUndefined()
  })

  it('цепочка keep-with-next до начала страницы → разрыв перед блоком, без зацикливания', () => {
    const blocks = [
      blk(24, 'scene-header', 0),          // keep
      blk(24, 'scene-cast', 0),            // keep
      blk(1200, 'scene-dialog', 0),        // делимая реплика — но меньше строки? нет, делится
    ]
    // страница: header+cast+часть реплики — реплика делится (fitsPx=971-48-0=923 ≥ 24)
    const { breaks } = paginateBlocks(blocks, PAGE, LINE)
    expect(breaks[1]).toEqual({ page: 2, startIndex: 2, splitOffsetPx: 923 })
  })
})
