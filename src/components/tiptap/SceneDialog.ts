import { Node, mergeAttributes } from '@tiptap/core'

export const SceneDialog = Node.create({
  name: 'sceneDialog',
  
  group: 'block',
  content: 'inline*',
  defining: true,
  
  parseHTML() {
    return [
      { tag: 'div[data-type="scene-dialog"]' },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'scene-dialog',
      class: 'scene-dialog',
    }), 0]
  },
})

export default SceneDialog
