import { Node, mergeAttributes } from '@tiptap/core'

export const SceneNode = Node.create({
  name: 'scene',
  
  group: 'block',
  content: 'sceneHeader sceneCast? sceneAction* sceneCharacter sceneDialog* sceneTransition?',
  draggable: true,
  
  addAttributes() {
    return {
      id: {
        default: null,
      },
      seriesNumber: {
        default: 1,
      },
      sceneNumber: {
        default: 1,
      },
      type: {
        default: 'INT',
      },
      location: {
        default: '',
      },
      time: {
        default: 'DAY',
      },
    }
  },
  
  parseHTML() {
    return [
      { tag: 'div[data-type="scene"]' },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'scene',
      'data-scene-id': HTMLAttributes.id,
      class: 'scene-node',
    }), 0]
  },
})

export default SceneNode
