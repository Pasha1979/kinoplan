/**
 * Sanitize HTML pasted from Word/Google Docs.
 * Removes styles, fonts, colors, classes, ids.
 * Preserves basic formatting: <b>, <i>, <u>, <p>, <br>.
 * Converts tables to plain text.
 * Converts <div> → <p>, <strong> → <b>, <em> → <i>.
 */
export function sanitizeHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // 1. Remove script/style/meta/link tags entirely
  const tagsToRemove = ['script', 'style', 'meta', 'link', 'title', 'head']
  tagsToRemove.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove())
  })

  // 2. Walk and clean nodes
  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()

      // Convert semantic tags
      if (tag === 'strong') {
        const b = doc.createElement('b')
        while (el.firstChild) b.appendChild(el.firstChild)
        el.parentNode?.replaceChild(b, el)
        return
      }
      if (tag === 'em') {
        const i = doc.createElement('i')
        while (el.firstChild) i.appendChild(el.firstChild)
        el.parentNode?.replaceChild(i, el)
        return
      }
      if (tag === 'div') {
        const p = doc.createElement('p')
        while (el.firstChild) p.appendChild(el.firstChild)
        el.parentNode?.replaceChild(p, el)
        return
      }
      if (tag === 'span') {
        // Unwrap span — keep children
        const parent = el.parentNode
        while (el.firstChild) parent?.insertBefore(el.firstChild, el)
        parent?.removeChild(el)
        return
      }
      if (tag === 'font') {
        const parent = el.parentNode
        while (el.firstChild) parent?.insertBefore(el.firstChild, el)
        parent?.removeChild(el)
        return
      }

      // Remove all attributes
      Array.from(el.attributes).forEach(attr => {
        el.removeAttribute(attr.name)
      })

      // Tables → plain text (cells separated by spaces, rows by \n)
      if (tag === 'table') {
        const rows: string[] = []
        el.querySelectorAll('tr').forEach(tr => {
          const cells: string[] = []
          tr.querySelectorAll('td, th').forEach(cell => {
            cells.push(cell.textContent?.trim() || '')
          })
          if (cells.length > 0) rows.push(cells.join(' '))
        })
        const textNode = doc.createTextNode(rows.join('\n'))
        el.parentNode?.replaceChild(textNode, el)
        return
      }

      // Remove lists but keep text with line breaks
      if (tag === 'ul' || tag === 'ol') {
        const items: string[] = []
        el.querySelectorAll('li').forEach(li => {
          items.push(li.textContent?.trim() || '')
        })
        const textNode = doc.createTextNode(items.join('\n'))
        el.parentNode?.replaceChild(textNode, el)
        return
      }
    }

    // Recurse
    const children = Array.from(node.childNodes)
    children.forEach(child => walk(child))
  }

  walk(doc.body)

  // 3. Clean up whitespace
  let result = doc.body.innerHTML
  result = result.replace(/\n\s+/g, '\n')
  result = result.replace(/\n{3,}/g, '\n\n')
  result = result.trim()

  return result
}

/**
 * Sanitize plain text: remove zero-width spaces, soft hyphens, BOM.
 * Normalize multiple spaces and tabs.
 */
export function sanitizePlainText(text: string): string {
  return text
    .replace(/\uFEFF/g, '')                 // BOM
    .replace(/\u200B|\u200C|\u200D/g, '')   // zero-width spaces
    .replace(/\u00AD/g, '')                 // soft hyphen
    .replace(/\t+/g, ' ')                  // tabs → space
    .replace(/ {2,}/g, ' ')               // multiple spaces → single
    .replace(/\n{3,}/g, '\n\n')             // excessive newlines
    .trim()
}

/**
 * Check if content looks like a screenplay (has scene headers).
 */
export function isScreenplayContent(text: string): boolean {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.some(l =>
    /^(?:\d+(?:-\d+)?[\.\s]+)?(?:ИНТ|ЭКСТ|ИНТ-ЭКСТ)[\.\s]/i.test(l)
  )
}
