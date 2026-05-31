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
  
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'scene-dialog'
      dom.setAttribute('data-type', 'scene-dialog')
      dom.style.cssText = `
        position: relative;
        padding-left: 12px;
        margin: 4px 0 8px 0;
        padding-left: 80px;
      `
      
      // Зелёная линия слева
      const indicator = document.createElement('div')
      indicator.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: #22c55e;
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

export default SceneDialog
