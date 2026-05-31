import { Node, mergeAttributes } from '@tiptap/core'

export const SceneAction = Node.create({
  name: 'sceneAction',
  
  group: 'block',
  content: 'inline*',
  defining: true,
  
  parseHTML() {
    return [
      { tag: 'div[data-type="scene-action"]' },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'scene-action',
      class: 'scene-action',
    }), 0]
  },
})

export default SceneAction
