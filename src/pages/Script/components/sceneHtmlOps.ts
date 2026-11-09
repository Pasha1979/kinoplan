import { extractSceneHtml, spliceSceneHtml } from './SceneEditModal'

const isHeader = (el: Element) => {
  const t = el.getAttribute('data-type')
  return t === 'scene-header' || t === 'sceneHeader'
}
const parse = (content: string) => new DOMParser().parseFromString(content || '', 'text/html')
const headersOf = (doc: Document) => [...doc.body.querySelectorAll('[data-type]')].filter(isHeader)

/** Удаляет сцену из документа (диапазон от шапки до следующей) */
export function removeSceneHtml(content: string, sceneNumber: string): string {
  return spliceSceneHtml(content, sceneNumber, 0, '')
}

/** Вставляет html перед шапкой №atIndex; индекс >= кол-ва сцен → в конец */
export function insertSceneHtml(content: string, html: string, atIndex: number): string {
  const doc = parse(content)
  const frag = parse(html)
  const newEls = [...frag.body.children]
  const headers = headersOf(doc)
  const ref = headers[atIndex] ?? null
  const parent = ref?.parentNode ?? doc.body
  newEls.forEach((el) => parent.insertBefore(doc.importNode(el, true) as Node, ref))
  return doc.body.innerHTML
}

/** Перенумеровывает все шапки подряд: «ep-N.» для сериала, «N.» для фильма */
export function renumberHeaders(content: string, episode: number, isSerial: boolean): string {
  const doc = parse(content)
  headersOf(doc).forEach((h, i) => {
    const num = isSerial ? `${episode}-${i + 1}` : `${i + 1}`
    const rest = (h.textContent || '').trim().replace(/^\S+\s*/, '')
    h.textContent = `${num}. ${rest}`
  })
  return doc.body.innerHTML
}

export { extractSceneHtml }
