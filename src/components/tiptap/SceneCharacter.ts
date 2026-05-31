import { Node, mergeAttributes } from '@tiptap/core'

export const SceneCharacter = Node.create({
  name: 'sceneCharacter',
  
  group: 'block',
  content: 'inline*',
  defining: true,
  
  parseHTML() {
    return [
      { tag: 'div[data-type="scene-character"]' },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'scene-character',
      class: 'scene-character',
    }), 0]
  },
})

export default SceneCharacter
