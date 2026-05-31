import { Node, mergeAttributes } from '@tiptap/core'

export const SceneTransition = Node.create({
  name: 'sceneTransition',
  
  group: 'block',
  content: 'inline*',
  defining: true,
  
  parseHTML() {
    return [
      { tag: 'div[data-type="scene-transition"]' },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'scene-transition',
      class: 'scene-transition',
    }), 0]
  },
})

export default SceneTransition
