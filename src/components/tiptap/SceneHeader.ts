import { Node, mergeAttributes } from '@tiptap/core'

export interface SceneHeaderOptions {
  HTMLAttributes: Record<string, any>
}

export const SceneHeader = Node.create<SceneHeaderOptions>(
  {
    name: 'sceneHeader',
    
    group: 'block',
    content: 'inline*',
    defining: true,
    
    parseHTML() {
      return [
        { tag: 'div[data-type="scene-header"]' },
      ]
    },
    
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 
        'data-type': 'scene-header',
        class: 'scene-header',
      }), 0]
    },
    
    addNodeView() {
      return ({ node, editor, getPos }) => {
        const dom = document.createElement('div')
        dom.className = 'scene-header'
        dom.setAttribute('data-type', 'scene-header')
        dom.style.cssText = `
          position: relative;
          padding-left: 12px;
          margin: 8px 0;
          font-weight: 600;
        `
        
        // Фиолетовая линия слева как индикатор
        const indicator = document.createElement('div')
        indicator.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: #6366f1;
          border-radius: 2px;
        `
        dom.appendChild(indicator)
        
        // Контент
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
  }
)

export default SceneHeader
