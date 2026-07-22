import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const pluginKey = new PluginKey('povFilter')

function computeDecorations(doc: any, character: string | null): DecorationSet {
  if (!character) return DecorationSet.empty

  const target = character.toUpperCase()
  const decorations: Decoration[] = []
  let pos = 0
  let currentSceneCast: string[] = []
  let inScene = false

  for (let i = 0; i < doc.content.childCount; i++) {
    const node = doc.content.child(i)
    const size = node.nodeSize

    if (node.type.name === 'sceneHeader') {
      // Начало новой сцены
      inScene = true
      currentSceneCast = []
      // Ищем cast после этого header
      let j = i + 1
      while (j < doc.content.childCount) {
        const nextNode = doc.content.child(j)
        if (nextNode.type.name === 'sceneHeader') break
        if (nextNode.type.name === 'sceneCast') {
          const castText = nextNode.textContent.trim()
          currentSceneCast = castText.split(',').map(c => c.trim().toUpperCase())
          break
        }
        j++
      }
    }

    if (inScene && node.type.name === 'sceneHeader') {
      // Если персонажа нет в cast, скрываем header
      if (!currentSceneCast.includes(target)) {
        decorations.push(
          Decoration.node(pos, pos + size, {
            style: 'display: none !important;',
          })
        )
      }
    } else if (inScene) {
      // Скрываем все блоки в сцене, если персонажа нет в cast
      if (!currentSceneCast.includes(target)) {
        decorations.push(
          Decoration.node(pos, pos + size, {
            style: 'display: none !important;',
          })
        )
      }
    }

    pos += size
  }

  return DecorationSet.create(doc, decorations)
}

export const PovFilterExtension = Extension.create({
  name: 'povFilter',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return { character: null as string | null, decorationSet: DecorationSet.empty }
          },
          apply(tr, value) {
            const meta = tr.getMeta(pluginKey)
            if (meta?.character !== undefined) {
              return {
                character: meta.character,
                decorationSet: computeDecorations(tr.doc, meta.character),
              }
            }
            if (tr.docChanged) {
              return {
                character: value.character,
                decorationSet: computeDecorations(tr.doc, value.character),
              }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state)?.decorationSet ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})

export { pluginKey }
