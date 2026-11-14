// T-92: генерирует .doc-эталоны для замера пагинации в Word.
// Использует боевой пайплайн экспорта (convertToWordCompatibleHtml + .doc-обёртка).
// Запуск: node scripts/gen-etalons.mjs
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

buildSync({
  entryPoints: [join(root, 'scripts/gen-etalons-entry.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: join(root, 'scripts/.gen-etalons.cjs'),
})

const dom = new JSDOM('')
globalThis.document = dom.window.document
globalThis.DOMParser = dom.window.DOMParser
globalThis.HTMLElement = dom.window.HTMLElement

const { ETALONS, convertToWordCompatibleHtml } = await import(
  pathToFileURL(join(root, 'scripts/.gen-etalons.cjs')).href
)

// @page фиксирует геометрию A4 с полями приложения (2/2/2/3 см) — иначе Word
// меряет со своими дефолтами (3/1.5 см) и замер несопоставим с моделью.
const wrap = (body, title) =>
  '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
  '<head><meta charset="utf-8">' +
  `<title>${title}</title>` +
  '<style>@page { size: 21cm 29.7cm; margin: 2cm 2cm 2cm 3cm; mso-page-orientation: portrait; }</style>' +
  `</head><body>${body}</body></html>`

mkdirSync(join(root, 'etalons'), { recursive: true })
for (const e of ETALONS) {
  const body = convertToWordCompatibleHtml(e.html, 'russian')
  const file = join(root, 'etalons', `${e.id}.doc`)
  writeFileSync(file, wrap(body, e.title), 'utf8')
  console.log(file)
}
