import { Node, mergeAttributes } from '@tiptap/core'

export const SceneCast = Node.create({
  name: 'sceneCast',
  
  group: 'block',
  content: 'inline*',
  defining: true,
  
  parseHTML() {
    return [
      { tag: 'div[data-type="scene-cast"]' },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'scene-cast',
      class: 'scene-cast',
    }), 0]
  },
})

export default SceneCast
