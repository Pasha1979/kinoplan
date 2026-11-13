import type { Scene, Script } from '../store/scriptStore'
import { convertToWordCompatibleHtml } from './wordExport'
import { extractSceneHtml } from '../pages/Script/components/SceneEditModal'

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
      ? extractSceneHtml(content, s.number, idx)
      : ''))
    .filter(Boolean)
  return convertToWordCompatibleHtml(parts.join(''), format)
}

/** Оборачивает тело в документ, который Word открывает как .doc */
export function wrapAsWordDoc(bodyHtml: string, title: string): string {
  return [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">',
    `<head><meta charset="utf-8"><title>${title}</title></head>`,
    `<body>${bodyHtml}</body></html>`,
  ].join('')
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
  const body = buildScenesExportHtml(script, scenes, selectedIds)
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
 * T-77: вызывной лист на съёмочный день — печатный HTML → PDF.
 */
export function buildCallsheetHtml(
  projectName: string,
  dayNumber: number,
  day: { date?: string; location?: string; notes?: string },
  scenes: Scene[]
): string {
  const rows = scenes.map((s) => `
    <tr>
      <td>${s.number}</td>
      <td>${s.type}</td>
      <td>${s.location}${s.sublocation ? ' — ' + s.sublocation : ''}</td>
      <td>${s.time || ''}</td>
      <td>${(s.cast || []).join(', ')}</td>
      <td>${(s.pages || 0).toFixed(1)}</td>
    </tr>`).join('')
  const castAll = [...new Set(scenes.flatMap((s) => s.cast || []))]

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Вызывной — день ${dayNumber}</title>
<style>
  @page { size: A4 landscape; margin: 1.5cm; }
  body { font-family: "Courier New", Courier, monospace; font-size: 10pt; color: #000; margin: 0; }
  h1 { font-size: 14pt; text-transform: uppercase; margin: 0 0 2px; }
  .meta { font-size: 10pt; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #000; padding: 3px 6px; text-align: left; vertical-align: top; }
  th { background: #e5e5e5; text-transform: uppercase; font-size: 9pt; }
  .cast { margin-top: 10px; font-size: 9pt; }
</style>
</head>
<body>
  <h1>Вызывной лист — ${projectName}</h1>
  <div class="meta">
    Съёмочный день №${dayNumber}${day.date ? ` · ${day.date}` : ''}${day.location ? ` · Локация: ${day.location}` : ''}
  </div>
  <table>
    <tr><th>№</th><th>ИНТ/ЭКСТ</th><th>Локация</th><th>Время</th><th>Персонажи</th><th>Стр.</th></tr>
    ${rows}
  </table>
  ${castAll.length ? `<div class="cast"><b>В работе:</b> ${castAll.join(', ')}</div>` : ''}
  ${day.notes ? `<div class="cast"><b>Примечания:</b> ${day.notes}</div>` : ''}
</body>
</html>`
}
