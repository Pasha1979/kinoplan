import { Node, mergeAttributes } from '@tiptap/core'

export const SceneHeader = Node.create({
  name: 'sceneHeader',
  
  group: 'block',
  content: 'inline*',
  defining: true,
  
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
