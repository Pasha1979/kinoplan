export interface FormatBlock {
  id: string
  type: string
  content: string
  /** T-103: UUID сцены из data-scene-id (только у шапок) — устойчивый маппинг блоков */
  sceneId?: string
}

function contentHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h ? h.toString(36) : ''
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
      // Стабильный id: sceneId сцены или хеш контента — вставка блока выше
      // не должна воскрешать пропущенные предупреждения
      const content = el.textContent || ''
      const sceneId = el.getAttribute('data-scene-id')
      blocks.push({
        id: sceneId ? `${type}-${sceneId}` : `${type}-${contentHash(content) || index}`,
        type,
        content,
        sceneId: sceneId ?? undefined,
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
