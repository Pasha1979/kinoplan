import type { Scene, Script } from '../store/scriptStore'
import { convertToWordCompatibleHtml } from './wordExport'
import { extractSceneHtml } from '../pages/Script/components/SceneEditModal'
import { PageCounter } from '../services/pageCounter'
import { SCRIPT_LAYOUT } from '../constants/scriptLayout'
import { CONTINUED_MARKER_TYPES } from '../services/pagination'

/**
 * T-61/T-63: собирает Word-совместимый HTML из выбранных сцен сценария.
 * selectedIds === null → все сцены.
 */
export function buildScenesExportHtml(
  script: Pick<Script, 'content' | 'format'>,
  scenes: Scene[],
  selectedIds: ReadonlySet<string> | null
): string {
  const content = script.content || ''
  const format = (script.format as 'russian' | 'hollywood') || 'russian'
  const parts = scenes
    .map((s, idx) => (selectedIds === null || selectedIds.has(s.id)
      ? extractSceneHtml(content, s.number, idx, s.id)
      : ''))
    .filter(Boolean)
  return convertToWordCompatibleHtml(parts.join(''), format)
}

/** Оборачивает тело в документ, который Word открывает как .doc.
 *  @page фиксирует геометрию A4/КИТ — без неё Word пагинирует своими дефолтами (T-92). */
export function wrapAsWordDoc(bodyHtml: string, title: string): string {
  return [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">',
    `<head><meta charset="utf-8"><title>${title}</title>`,
    '<style>@page { size: A4; margin: 2cm 2cm 2cm 3cm; }</style></head>',
    `<body>${bodyHtml}</body></html>`,
  ].join('')
}

let printPageCounter: PageCounter | null = null

/**
 * T-16: вставляет в печатный HTML принудительные разрывы страниц и маркеры
 * «(ПРОДОЛЖЕНИЕ)» — по расчёту PageCounter (та же модель SCRIPT_LAYOUT).
 * Маркер — артефакт пагинации: в сохранённый контент не попадает.
 * В .doc НЕ инжектится — Word пагинирует сам, маркер лёг бы в случайное место.
 */
export function injectPrintPageBreaks(
  html: string,
  format: 'russian' | 'hollywood' = 'russian'
): string {
  if (typeof document === 'undefined') return html
  try {
    printPageCounter ??= new PageCounter()
    const { breaks, blocks } = printPageCounter.calculatePagesWithBreaks(html, format)
    if (breaks.length <= 1) return html

    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    // body — это один div-обёртка из convertToWordCompatibleHtml
    const root = (wrapper.children.length === 1 ? wrapper.children[0] : wrapper) as HTMLElement
    const children = Array.from(root.children) as HTMLElement[]

    const splitsByIndex = new Map<number, number[]>()
    for (const b of breaks) {
      if (b.page === 1) continue
      if (b.splitOffsetPx !== undefined) {
        const arr = splitsByIndex.get(b.startIndex) ?? []
        arr.push(b.splitOffsetPx)
        splitsByIndex.set(b.startIndex, arr)
      } else {
        const el = children[b.startIndex]
        // setAttribute, не CSSOM: jsdom/cssstyle не знает page-break-before
        if (el) el.setAttribute('style', `${el.getAttribute('style') || ''}; page-break-before: always;`)
      }
    }

    splitsByIndex.forEach((offsets, index) => {
      const el = children[index]
      const heightPx = blocks[index]?.heightPx
      if (!el || !heightPx) return
      const isContinued = CONTINUED_MARKER_TYPES.has(el.getAttribute('data-type') ?? '')
      const baseStyle = el.getAttribute('style') || ''

      let cur = el
      let consumedPx = 0
      for (const offsetPx of offsets.slice().sort((a, b) => a - b)) {
        const text = cur.textContent || ''
        if (!text.trim()) break
        // Оценка позиции символа: доля высоты блока ≈ доля текста, щёлчок по пробелу
        const frac = Math.min(1, Math.max(0, (offsetPx - consumedPx) / Math.max(1, heightPx - consumedPx)))
        let cut = text.lastIndexOf(' ', Math.round(text.length * frac))
        if (cut <= 0) cut = Math.max(1, Math.round(text.length * frac))

        const rest = cur.cloneNode(false) as HTMLElement
        rest.textContent = text.slice(cut).trimStart()
        cur.textContent = text.slice(0, cut)

        if (isContinued) {
          const marker = document.createElement('div')
          marker.setAttribute('data-print-contd', '')
          marker.setAttribute(
            'style',
            `margin-left: ${SCRIPT_LAYOUT[format].dialog.leftIndent}; page-break-before: always;`
          )
          marker.textContent = format === 'hollywood' ? "(CONT'D)" : '(ПРОДОЛЖЕНИЕ)'
          cur.after(marker)
          rest.setAttribute('style', `${baseStyle}; margin-top: 0`)
          marker.after(rest)
        } else {
          rest.setAttribute('style', `${baseStyle}; margin-top: 0; page-break-before: always;`)
          cur.after(rest)
        }
        cur = rest
        consumedPx = offsetPx
      }
    })

    return wrapper.innerHTML
  } catch (e) {
    console.warn('injectPrintPageBreaks failed:', e)
    return html
  }
}

/**
 * T-62: печатный HTML для экспорта в PDF (через диалог печати браузера).
 * Геометрия A4 и поля — те же, что у PageCounter: 210×297мм, поля 2/2/2/3см.
 */
export function buildPrintableHtml(
  script: Pick<Script, 'content' | 'format'> & Partial<Pick<Script, 'title' | 'titlePage'>>,
  scenes: Scene[],
  selectedIds: ReadonlySet<string> | null
): string {
  const body = injectPrintPageBreaks(
    buildScenesExportHtml(script, scenes, selectedIds),
    (script.format as 'russian' | 'hollywood') || 'russian'
  )
  const tp = script.titlePage
  const titleBlock = tp?.print
    ? `<div class="title-page">
        <h1>${tp.title || script.title || ''}</h1>
        ${tp.writtenBy ? `<p>Автор: ${tp.writtenBy}</p>` : ''}
        ${tp.basedOn ? `<p>${tp.basedOn}</p>` : ''}
        ${tp.director ? `<p>Режиссёр: ${tp.director}</p>` : ''}
        ${tp.company ? `<p>${tp.company}</p>` : ''}
        ${tp.draftNumber ? `<p>Версия: ${tp.draftNumber}</p>` : ''}
        ${tp.date ? `<p>${tp.date}</p>` : ''}
      </div><div class="page-break"></div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${script.title || 'Сценарий'}</title>
<style>
  @page { size: A4; margin: 2cm 2cm 2cm 3cm; }
  body { font-family: "Courier New", Courier, monospace; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; }
  .title-page { text-align: center; padding-top: 30%; page-break-after: always; }
  .title-page h1 { font-size: 20pt; text-transform: uppercase; }
  .page-break { page-break-after: always; }
</style>
</head>
<body>${titleBlock}${body}</body>
</html>`
}

/** Открывает диалог печати для HTML — пользователь сохраняет как PDF */
export function printHtmlAsPdf(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) return
  doc.open()
  doc.write(html)
  doc.close()
  // ждём применения стилей, иначе печать может пойти без раскладки
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 60_000)
  }, 250)
}

/**
 * T-77: вызывной лист — удалено решением пользователя (D-62):
 * модуль планирования делается пользователем с нуля.
 */
