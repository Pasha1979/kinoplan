export interface FormatBlock {
  id: string
  type: string
  content: string
}

const TYPE_MAP: Record<string, string> = {
  'scene-header': 'scene_header',
  'scene-character': 'character',
  'scene-parenthetical': 'parenthetical',
  'scene-transition': 'transition',
  'scene-action': 'action',
  'scene-dialog': 'dialog',
  'scene-cast': 'cast',
}

/**
 * Извлекает блоки форматирования из HTML-контента Tiptap редактора.
 * Каждый кастомный блок (шапка, персонаж, диалог и т.д.)
 * рендерится Tiptap как элемент с атрибутом data-type.
 */
export function extractBlocksFromHtml(html: string): FormatBlock[] {
  if (!html || html === '<p></p>' || html.trim() === '') {
    return []
  }

  // Браузер / Electron renderer — используем нативный DOMParser
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const blocks: FormatBlock[] = []

    const elements = doc.querySelectorAll('[data-type]')
    elements.forEach((el, index) => {
      const dataType = el.getAttribute('data-type') || ''
      const type = TYPE_MAP[dataType] || dataType
      blocks.push({
        id: `${type}-${index}`,
        type,
        content: el.textContent || '',
      })
    })

    return blocks
  }

  // Fallback для Node-окружений (тесты без jsdom)
  const blocks: FormatBlock[] = []
  const regex = /<[^>]+data-type="([^"]+)"[^>]*>([^<]*)<\/[^>]+>/g
  let match
  let index = 0
  while ((match = regex.exec(html)) !== null) {
    const dataType = match[1]
    const content = match[2]
    const type = TYPE_MAP[dataType] || dataType
    blocks.push({
      id: `${type}-${index}`,
      type,
      content,
    })
    index++
  }

  return blocks
}
