/**
 * Чистая функция пагинации (T-94): на вход — измеренные блоки, на выход — разрывы.
 * Не зависит от DOM → тестируется в vitest без рендеринга.
 *
 * Модель отступов — «space before» как в Word/Final Draft: граница между
 * блоками считается один раз = max(marginBottom предыдущего, marginTop текущего).
 * В SSoT-модели SCRIPT_LAYOUT все marginBottom = 0 → граница = marginTop.
 * Эмуляция коллапса делает расчёт устойчивым к случайным marginBottom
 * (внешний HTML, браузерные дефолты) без двойного учёта.
 */

export interface MeasuredBlock {
  /** Высота блока без внешних отступов (offsetHeight) */
  heightPx: number
  marginTopPx: number
  marginBottomPx: number
  dataType: string | null
}

export interface PageBreakInfo {
  page: number
  /** Индекс блока, с которого начинается страница */
  startIndex: number
  /** Страница начинается ВНУТРИ блока: px от верха блока до точки разрыва */
  splitOffsetPx?: number
}

export interface PaginationResult {
  breaks: PageBreakInfo[]
  /** Суммарная высота контента с учётом коллапса отступов */
  totalHeightPx: number
}

/** Блоки, которые нельзя оставлять последними на странице — переносятся
 *  на следующую вместе со следующим блоком (keep-with-next). */
export const KEEP_WITH_NEXT_TYPES = new Set([
  'scene-header',
  'scene-cast',
  'scene-character',
  'scene-parenthetical',
])

/** Типы блоков, разрыв которых требует маркера «(ПРОДОЛЖЕНИЕ)» на следующей странице (T-16). */
export const CONTINUED_MARKER_TYPES = new Set(['scene-dialog'])

export function paginateBlocks(
  blocks: MeasuredBlock[],
  usablePageHeightPx: number,
  lineHeightPx: number,
): PaginationResult {
  const breaks: PageBreakInfo[] = []
  if (blocks.length === 0) return { breaks, totalHeightPx: 0 }

  breaks.push({ page: 1, startIndex: 0 })
  let page = 1
  let pageStartIndex = 0
  let accumulatedPx = 0
  let prevBottomPx = 0
  let totalHeightPx = 0
  let prevBottomTotalPx = 0

  const openPageInside = (blockIndex: number, offsetPx: number) => {
    page++
    pageStartIndex = blockIndex
    breaks.push({ page, startIndex: blockIndex, splitOffsetPx: offsetPx })
  }

  let i = 0
  while (i < blocks.length) {
    const b = blocks[i]
    const gapPx = Math.max(prevBottomPx, b.marginTopPx)
    totalHeightPx += Math.max(prevBottomTotalPx, b.marginTopPx) + b.heightPx
    prevBottomTotalPx = b.marginBottomPx

    if (accumulatedPx + gapPx + b.heightPx <= usablePageHeightPx) {
      accumulatedPx += gapPx + b.heightPx
      prevBottomPx = b.marginBottomPx
      i++
      continue
    }

    // Сколько тела блока помещается на текущей странице (после отступа)
    const fitsPx = usablePageHeightPx - accumulatedPx - gapPx

    if (fitsPx >= lineHeightPx) {
      // Разрыв внутри блока — текст течёт через границу, как в Word.
      // Keep-with-next перед ним не нарушается: у предыдущего блока
      // на этой странице остаётся продолжение.
      let offsetPx = fitsPx
      let restPx = b.heightPx - fitsPx
      openPageInside(i, offsetPx)
      while (restPx > usablePageHeightPx) {
        restPx -= usablePageHeightPx
        offsetPx += usablePageHeightPx
        openPageInside(i, offsetPx)
      }
      accumulatedPx = restPx
      prevBottomPx = b.marginBottomPx
      i++
      continue
    }

    // Блок не помещается и не делится (меньше строки на остатке) → перенос целиком.
    // Keep-with-next: отматываем назад по цепочке «висячих» блоков.
    let breakIndex = i
    while (
      breakIndex > pageStartIndex &&
      KEEP_WITH_NEXT_TYPES.has(blocks[breakIndex - 1].dataType ?? '')
    ) {
      breakIndex--
    }
    if (breakIndex === pageStartIndex) {
      // Вся цепочка до начала страницы — keep-with-next, отодвинуть нечего:
      // разрываем прямо перед блоком i (правило невыполнимо, как и в Word).
      breakIndex = i
    }

    page++
    pageStartIndex = breakIndex
    breaks.push({ page, startIndex: breakIndex })

    // Пересчитываем накопленную высоту для блоков breakIndex..i-1 на новой странице.
    // Блок i НЕ размещаем — цикл вернётся к нему уже на новой странице.
    accumulatedPx = 0
    let pb = breakIndex > 0 ? blocks[breakIndex - 1].marginBottomPx : 0
    for (let j = breakIndex; j < i; j++) {
      accumulatedPx += Math.max(pb, blocks[j].marginTopPx) + blocks[j].heightPx
      pb = blocks[j].marginBottomPx
    }
    prevBottomPx = i > 0 ? blocks[i - 1].marginBottomPx : 0
  }

  return { breaks, totalHeightPx }
}
