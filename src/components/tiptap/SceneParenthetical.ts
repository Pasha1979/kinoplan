import { Node, mergeAttributes } from '@tiptap/core'

export const SceneParenthetical = Node.create({
  name: 'sceneParenthetical',

  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="scene-parenthetical"]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'scene-parenthetical',
      class: 'scene-parenthetical',
    }), 0]
  },
})

export default SceneParenthetical
