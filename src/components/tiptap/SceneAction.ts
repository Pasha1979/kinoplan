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
  
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'scene-action'
      dom.setAttribute('data-type', 'scene-action')
      dom.style.cssText = `
        position: relative;
        padding-left: 12px;
        margin: 4px 0;
      `
      
      // Серая линия слева
      const indicator = document.createElement('div')
      indicator.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: #9ca3af;
        border-radius: 2px;
      `
      dom.appendChild(indicator)
      
      const content = document.createElement('div')
      content.style.cssText = 'padding-left: 8px;'
      content.innerHTML = node.textContent
      dom.appendChild(content)
      
      return {
        dom,
        contentDOM: content,
      }
    }
  },
})

export default SceneAction
