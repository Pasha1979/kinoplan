import { SCRIPT_STYLES } from '../constants/scriptStyles'

/**
 * Конвертирует HTML редактора в Word-совместимый HTML с inline-стилями.
 * НЕ заменяет div на p — pageCounter тоже оставляет div, унификация рендеринга.
 */
export function convertToWordCompatibleHtml(
  html: string,
  format: 'russian' | 'hollywood' = 'russian'
): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const convert = (element: HTMLElement) => {
    const dataType = element.getAttribute('data-type')
    if (dataType && SCRIPT_STYLES[dataType]) {
      const current = element.getAttribute('style') || ''
      const newStyles = SCRIPT_STYLES[dataType][format]
      element.setAttribute('style', current + (current ? '; ' : '') + newStyles)
    }
    Array.from(element.children).forEach((child) => {
      if (child instanceof HTMLElement) convert(child)
    })
  }

  Array.from(doc.body.children).forEach((child) => {
    if (child instanceof HTMLElement) convert(child)
  })

  const wrapper = document.createElement('div')
  wrapper.innerHTML = doc.body.innerHTML
  wrapper.setAttribute(
    'style',
    'font-family: "Courier New", Courier, monospace; ' +
      'font-size: 12pt; ' +
      'line-height: 1.5; ' +
      'max-width: 21cm; ' +
      'margin: 0 auto;'
  )

  return wrapper.outerHTML
}
