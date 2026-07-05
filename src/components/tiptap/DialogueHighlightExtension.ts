import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const pluginKey = new PluginKey('dialogueHighlight')

function computeDecorations(doc: any, character: string | null): DecorationSet {
  if (!character) return DecorationSet.empty

  const target = character.toUpperCase()
  const decorations: Decoration[] = []
  let pos = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const node = doc.content.child(i)
    const size = node.nodeSize

    if (node.type.name === 'sceneCharacter') {
      const text = node.textContent.trim().toUpperCase().replace(/\s+/g, ' ')
      if (text === target) {
        decorations.push(
          Decoration.node(pos, pos + size, {
            class: 'dialogue-active-char',
            style: 'background-color: rgba(245, 158, 11, 0.35); border-radius: 4px;',
          })
        )

        // Подсвечиваем следующие подряд sceneDialog и sceneParenthetical
        let j = i + 1
        let nextPos = pos + size
        while (j < doc.content.childCount) {
          const nextNode = doc.content.child(j)
          if (nextNode.type.name === 'sceneDialog' || nextNode.type.name === 'sceneParenthetical') {
            decorations.push(
              Decoration.node(nextPos, nextPos + nextNode.nodeSize, {
                class: 'dialogue-active-line',
                style: 'background-color: rgba(245, 158, 11, 0.15); border-radius: 4px;',
              })
            )
            nextPos += nextNode.nodeSize
            j++
          } else {
            break
          }
        }
      }
    }

    pos += size
  }

  return DecorationSet.create(doc, decorations)
}

export const DialogueHighlightExtension = Extension.create({
  name: 'dialogueHighlight',

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
