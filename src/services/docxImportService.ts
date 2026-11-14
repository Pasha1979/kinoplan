import { parseScreenplayText, blocksToHtml } from '../utils/parseScreenplayText'

/**
 * T-31: DOCX-импорт сценария.
 * Пайплайн: mammoth → HTML → текст по абзацам → parseScreenplayText → HTML редактора.
 * Абзацы Word становятся строками — parseScreenplayText сам определяет
 * тип каждого блока (шапка/персонаж/реплика/ремарка) по тем же правилам,
 * что и вставка текста в редактор.
 */

const HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…',
}

/** Mammoth выдаёт <p>абзац</p> — превращаем в plain text с сохранением пустых строк */
export function mammothHtmlToText(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&([a-z]+);/gi, (m, name) => HTML_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
}

export interface DocxImportResult {
  /** HTML готовый для редактора/script-content */
  html: string
  blockCount: number
  /** Предупреждения от mammoth (неподдержанные элементы и т.п.) */
  warnings: string[]
}

export async function docxToScreenplayHtml(buffer: ArrayBuffer): Promise<DocxImportResult> {
  // ленивый импорт: mammoth (~100КБ) нужен только при импорте файла
  const mammoth = (await import('mammoth')).default
  // browser-сборка mammoth ждёт {arrayBuffer}, node-сборка — {buffer|path}
  const input: { arrayBuffer: ArrayBuffer } & Record<string, unknown> = { arrayBuffer: buffer }
  if (typeof Buffer !== 'undefined') input.buffer = Buffer.from(buffer)
  const result = await mammoth.convertToHtml(input)
  const text = mammothHtmlToText(result.value)
  const blocks = parseScreenplayText(text)
  return {
    html: blocksToHtml(blocks),
    blockCount: blocks.length,
    warnings: result.messages.map((m) => m.message),
  }
}
