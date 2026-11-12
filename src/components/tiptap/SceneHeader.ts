import { Node, mergeAttributes } from '@tiptap/core'

export const SceneHeader = Node.create({
  name: 'sceneHeader',
  
  group: 'block',
  content: 'inline*',
  defining: true,
  
  addAttributes() {
    return {
      /** Стабильный UUID сцены — метаданные (синопсис, цвет, метки) ключуются им, а не номером */
      sceneId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-scene-id'),
        renderHTML: (attributes) => {
          if (!attributes.sceneId) return {}
          return { 'data-scene-id': attributes.sceneId }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="scene-header"]' },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'scene-header',
      class: 'scene-header',
    }), 0]
  },
})

export default SceneHeader
