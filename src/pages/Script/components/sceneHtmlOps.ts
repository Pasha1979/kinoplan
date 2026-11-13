import { extractSceneHtml, spliceSceneHtml } from './SceneEditModal'
import { SCENE_NUMBER } from '../../../utils/sceneNumber'
import { renumberSceneNumbers } from '../../../utils/sceneNumbering'
import type { Editor } from '@tiptap/react'
import { DOMParser as PMDOMParser } from 'prosemirror-model'

const isHeader = (el: Element) => {
  const t = el.getAttribute('data-type')
  return t === 'scene-header' || t === 'sceneHeader'
}
const parse = (content: string) => new DOMParser().parseFromString(content || '', 'text/html')
const headersOf = (doc: Document) => [...doc.body.querySelectorAll('[data-type]')].filter(isHeader)

/** Удаляет сцену из документа (диапазон от шапки до следующей) */
export function removeSceneHtml(content: string, sceneNumber: string, sceneId?: string): string {
  return spliceSceneHtml(content, sceneNumber, 0, '', sceneId)
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

/** Перенумеровывает все шапки: литерные варианты (1-9-А) сохраняют буквы */
export function renumberHeaders(content: string, episode: number, isSerial: boolean): string {
  const doc = parse(content)
  const headers = headersOf(doc)
  const numRe = new RegExp(`^(${SCENE_NUMBER})\\.`)
  const nums = headers.map((h) => (h.textContent || '').trim().match(numRe)?.[1] ?? '')
  const next = renumberSceneNumbers(nums, isSerial, episode)
  headers.forEach((h, i) => {
    const rest = (h.textContent || '').trim().replace(new RegExp(`^${SCENE_NUMBER}\\.\\s*`), '')
    h.textContent = `${next[i]}. ${rest}`
  })
  return doc.body.innerHTML
}

/**
 * T-99: заменяет диапазон сцены в ЖИВОМ документе редактора одной транзакцией
 * по UUID (attrs.sceneId, fallback — номер в тексте шапки). Сохраняет
 * undo-историю и позицию курсора, в отличие от полного setContent.
 * Возвращает false, если сцена не найдена.
 */
export function replaceSceneInEditor(
  editor: Editor,
  sceneId: string,
  sceneHtml: string,
  fallbackNumber?: string,
): boolean {
  const { state } = editor
  const doc = state.doc
  const numRe = new RegExp(`^(${SCENE_NUMBER})\\.`)
  const norm = (s: string) => s.replace(/\./g, '').toLowerCase()
  let from = -1
  let to = -1
  let pos = 0
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i)
    if (from < 0) {
      const byId = node.type.name === 'sceneHeader' && node.attrs.sceneId === sceneId
      const byNum = !byId && node.type.name === 'sceneHeader' && fallbackNumber
        && norm((node.textContent.trim().match(numRe)?.[1]) ?? '') === norm(fallbackNumber)
      if (byId || byNum) from = pos
    } else if (node.type.name === 'sceneHeader') {
      to = pos
      break
    }
    pos += node.nodeSize
  }
  if (from < 0) return false
  if (to < 0) to = doc.content.size

  const dom = new window.DOMParser().parseFromString(sceneHtml, 'text/html')
  const slice = PMDOMParser.fromSchema(state.schema).parseSlice(dom.body)
  editor.view.dispatch(state.tr.replace(from, to, slice))
  return true
}

export { extractSceneHtml }
