/**
 * Точный подсчёт страниц сценария через виртуальный рендеринг в A4-контейнере.
 *
 * Создаёт скрытый DOM-элемент с точными размерами A4 (210×297 мм) и полями,
 * рендерит HTML с inline-стилями, измеряет высоту контента и возвращает
 * количество страниц.
 */

// Word-совместимые inline-стили для каждого типа блока
const SCRIPT_STYLES: Record<string, { russian: string; hollywood: string }> = {
  'scene-header': {
    russian: 'margin-top: 16px; margin-bottom: 0; font-weight: 600; text-transform: uppercase; margin-left: 0',
    hollywood: 'margin-top: 16px; margin-bottom: 0; font-weight: 600; text-transform: uppercase; margin-left: 0',
  },
  'scene-cast': {
    russian: 'margin-top: 0; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; margin-left: 0',
    hollywood: 'margin-top: 0; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; margin-left: 0',
  },
  'scene-action': {
    russian: 'margin-top: 12px; margin-bottom: 12px; margin-left: 0',
    hollywood: 'margin-top: 12px; margin-bottom: 12px; margin-left: 0',
  },
  'scene-character': {
    russian: 'margin-top: 16px; margin-bottom: 0; text-align: center; font-weight: 600; text-transform: uppercase; margin-left: 0',
    hollywood: 'margin-top: 16px; margin-bottom: 0; margin-left: 9.3cm; font-weight: 600; text-transform: uppercase',
  },
  'scene-dialog': {
    russian: 'margin-top: 0; margin-bottom: 16px; margin-left: 3.75cm; margin-right: 3.75cm',
    hollywood: 'margin-top: 0; margin-bottom: 16px; margin-left: 6.35cm; margin-right: 2.5cm',
  },
  'scene-transition': {
    russian: 'margin-top: 16px; margin-bottom: 16px; text-align: right; font-weight: 600; text-transform: uppercase; margin-left: 0',
    hollywood: 'margin-top: 16px; margin-bottom: 16px; text-align: right; font-weight: 600; text-transform: uppercase; margin-left: 0',
  },
}

/**
 * Применяет inline-стили к HTML для точного рендеринга.
 * Преобразует <div data-type="..."> в <p> для соответствия Word.
 */
function applyScriptStyles(html: string, format: 'russian' | 'hollywood' = 'russian'): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const convert = (element: HTMLElement) => {
    const dataType = element.getAttribute('data-type')
    if (dataType && SCRIPT_STYLES[dataType]) {
      const p = document.createElement('p')
      p.innerHTML = element.innerHTML
      const current = element.getAttribute('style') || ''
      const newStyles = SCRIPT_STYLES[dataType][format]
      p.setAttribute('style', current + (current ? '; ' : '') + newStyles)
      element.parentNode?.replaceChild(p, element)
      Array.from(p.children).forEach(child => {
        if (child instanceof HTMLElement) convert(child)
      })
    } else {
      Array.from(element.children).forEach(child => {
        if (child instanceof HTMLElement) convert(child)
      })
    }
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

export class PageCounter {
  private container: HTMLDivElement | null = null
  private mmToPx = 3.7795 // 1 mm ≈ 3.7795 px при 96 dpi

  constructor() {
    this.createContainer()
  }

  private createContainer() {
    this.container = document.createElement('div')
    // Важно: opacity:0 вместо visibility:hidden — браузер ДОЛЖЕН отрендерить
    // контент, иначе scrollHeight === 0. position:absolute вместо fixed.
    this.container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: -9999px;
      width: 210mm;
      padding: 2cm 2cm 2cm 3cm;
      box-sizing: border-box;
      font-family: "Courier New", Courier, monospace;
      font-size: 12pt;
      line-height: 1.5;
      opacity: 0;
      pointer-events: none;
      word-wrap: break-word;
      white-space: pre-wrap;
    `
    document.body.appendChild(this.container)
  }

  /**
   * Возвращает точное количество страниц A4 для заданного HTML.
   */
  calculatePages(html: string, format: 'russian' | 'hollywood' = 'russian'): number {
    if (!this.container) {
      this.createContainer()
    }

    const styledHtml = applyScriptStyles(html, format)
    this.container!.innerHTML = styledHtml

    // Высота контента в px
    const contentHeightPx = this.container!.scrollHeight
    // Конвертируем в mm
    const contentHeightMm = contentHeightPx / this.mmToPx
    // Доступная высота на одной странице (A4 - поля)
    // Поля: top 2cm + bottom 2cm = 4cm = 40mm
    const usablePageHeightMm = 297 - 40

    const pages = contentHeightMm / usablePageHeightMm

    // Debug: можно увидеть в консоли F12
    // eslint-disable-next-line no-console
    console.log('[PageCounter] scrollHeight:', contentHeightPx, 'px →', contentHeightMm.toFixed(1), 'mm →', pages.toFixed(2), 'pages')

    return Math.max(0.1, parseFloat(pages.toFixed(1)))
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

// Синглтон для всего приложения
let _instance: PageCounter | null = null

export function getPageCounter(): PageCounter {
  if (!_instance) {
    _instance = new PageCounter()
  }
  return _instance
}

export function destroyPageCounter() {
  if (_instance) {
    _instance.destroy()
    _instance = null
  }
}
