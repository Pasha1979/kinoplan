/**
 * Точный подсчёт страниц сценария через виртуальный рендеринг в A4-контейнере.
 *
 * Создаёт скрытый DOM-элемент с точными размерами A4 (210×297 мм) и полями,
 * рендерит HTML с inline-стилями, измеряет высоту контента и возвращает
 * количество страниц.
 */

import { SCRIPT_STYLES } from '../constants/scriptStyles'
import { A4_WIDTH_MM, A4_HEIGHT_MM, PAGE_MARGIN_TOP_BOTTOM_MM, WORD_RENDER_CALIBRATION, MIN_SCENE_PAGES } from '../constants/scriptConstants'

/**
 * Применяет inline-стили к HTML для точного рендеринга.
 * НЕ заменяет теги — просто добавляет inline-стили к существующим div.
 * Это важно: иначе <p> внутри <p> (вложенные параграфы из Tiptap)
 * ломают структуру и браузер добавляет лишние margin'ы.
 */
function applyScriptStyles(html: string, format: 'russian' | 'hollywood' = 'russian'): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const convert = (element: HTMLElement) => {
    const dataType = element.getAttribute('data-type')
    if (dataType && SCRIPT_STYLES[dataType]) {
      // НЕ заменяем тег — просто добавляем inline-стили к существующему div
      const current = element.getAttribute('style') || ''
      const newStyles = SCRIPT_STYLES[dataType][format]
      element.setAttribute('style', current + (current ? '; ' : '') + newStyles)
    }
    // Рекурсивно обрабатываем детей (даже если это data-type элемент —
    // внутри могут быть другие data-type элементы)
    Array.from(element.children).forEach(child => {
      if (child instanceof HTMLElement) convert(child)
    })
  }

  Array.from(doc.body.children).forEach(child => {
    if (child instanceof HTMLElement) convert(child)
  })

  const wrapper = document.createElement('div')
  wrapper.innerHTML = doc.body.innerHTML
  wrapper.setAttribute('style',
    'font-family: "Courier New", Courier, monospace; ' +
    'font-size: 12pt; ' +
    'line-height: 1.5;'
  )

  return wrapper.outerHTML
}

export interface PageBreak {
  page: number
  startIndex: number // индекс первого child-элемента на этой странице
}

export interface PageResult {
  totalPages: number
  breaks: PageBreak[]
}

export class PageCounter {
  private container: HTMLDivElement | null = null
  private mmToPx = 3.7795 // 1 mm ≈ 3.7795 px при 96 dpi
  // Калибровочный коэффициент: браузер рендерит шрифт крупнее, чем Word.
  // Калибровка совпадает с константой WORD_RENDER_CALIBRATION.
  // Без калибровки показывает на ~30% больше страниц, чем Word.
  private wordCalibration = WORD_RENDER_CALIBRATION

  constructor() {
    this.createContainer()
  }

  private createContainer() {
    this.container = document.createElement('div')
    // Важно: браузер должен отрендерить контент для корректного scrollHeight.
    // opacity:0 рендерит (в отличие от visibility:hidden или display:none).
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: ${A4_WIDTH_MM}mm;
      padding: 2cm 2cm 2cm 3cm;
      box-sizing: border-box;
      font-family: "Courier New", Courier, monospace;
      font-size: 12pt;
      line-height: 1.5;
      opacity: 0;
      pointer-events: none;
      word-wrap: break-word;
      z-index: -1;
    `
    document.body.appendChild(this.container)
  }

  /**
   * Возвращает точное количество страниц A4 и массив page breaks.
   */
  calculatePagesWithBreaks(html: string, format: 'russian' | 'hollywood' = 'russian'): PageResult {
    if (!this.container) {
      this.createContainer()
    }

    const styledHtml = applyScriptStyles(html, format)
    this.container!.innerHTML = styledHtml

    // --- total pages (via scrollHeight, same as before) ---
    const contentHeightPx = this.container!.scrollHeight
    const contentHeightMm = contentHeightPx / this.mmToPx
    const usablePageHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_TOP_BOTTOM_MM * 2
    const rawPages = contentHeightMm / usablePageHeightMm
    const pages = rawPages * this.wordCalibration
    const totalPages = Math.max(MIN_SCENE_PAGES, parseFloat(pages.toFixed(1)))

    // --- page breaks (via per-element offsetHeight) ---
    // styledHtml is wrapped in <div>, so container.children returns only 1 element.
    // We need the wrapper's children to iterate actual content blocks.
    const wrapper = this.container!.children[0] as HTMLElement
    const children = wrapper ? Array.from(wrapper.children) as HTMLElement[] : []
    let accumulatedMm = 0
    const breaks: PageBreak[] = []
    let page = 1
    let pageStartIndex = 0

    children.forEach((child, index) => {
      const heightPx = child.offsetHeight
      const style = window.getComputedStyle(child)
      const marginTopPx = parseFloat(style.marginTop) || 0
      const marginBottomPx = parseFloat(style.marginBottom) || 0
      // Применяем калибровку к каждому элементу (браузерный шрифт крупнее Word)
      const heightMm = ((heightPx + marginTopPx + marginBottomPx) / this.mmToPx) * this.wordCalibration
      accumulatedMm += heightMm

      if (accumulatedMm > usablePageHeightMm && pageStartIndex < index) {
        breaks.push({ page, startIndex: pageStartIndex })
        page++
        pageStartIndex = index
        accumulatedMm = heightMm
      }
    })

    // last page
    if (children.length > 0) {
      breaks.push({ page, startIndex: pageStartIndex })
    }

    return { totalPages, breaks }
  }

  /**
   * Возвращает точное количество страниц A4 для заданного HTML.
   */
  calculatePages(html: string, format: 'russian' | 'hollywood' = 'russian'): number {
    return this.calculatePagesWithBreaks(html, format).totalPages
  }

  /**
   * Возвращает превью HTML для печати (без скрытых стилей).
   */
  getPrintPreview(html: string, format: 'russian' | 'hollywood' = 'russian'): string {
    const styledHtml = applyScriptStyles(html, format)
    const wrapper = document.createElement('div')
    wrapper.innerHTML = styledHtml
    wrapper.setAttribute('style',
      'font-family: "Courier New", Courier, monospace; ' +
      'font-size: 12pt; ' +
      'line-height: 1.5; ' +
      'max-width: 21cm; ' +
      'margin: 0 auto;'
    )
    return wrapper.outerHTML
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
      this.container = null
    }
  }
}

// УБРАН singleton — каждый компонент создаёт свой instance.
// Это предотвращает race conditions при unmount/remount.
