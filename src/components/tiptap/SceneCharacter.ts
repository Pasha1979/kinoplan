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
  
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'scene-character'
      dom.setAttribute('data-type', 'scene-character')
      dom.style.cssText = `
        position: relative;
        padding-left: 12px;
        margin: 8px 0 4px 0;
        font-weight: 600;
        text-transform: uppercase;
      `
      
      // Оранжевая линия слева
      const indicator = document.createElement('div')
      indicator.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: #f97316;
        border-radius: 2px;
      `
      dom.appendChild(indicator)
      
      const content = document.createElement('div')
      content.style.cssText = 'padding-left: 8px;'
      content.innerHTML = node.textContent.toUpperCase()
      dom.appendChild(content)
      
      return {
        dom,
        contentDOM: content,
      }
    }
  },
})

export default SceneCharacter
