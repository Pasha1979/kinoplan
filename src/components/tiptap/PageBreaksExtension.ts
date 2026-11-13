import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CONTINUED_MARKER_TYPES, type PageBreakInfo } from '../../services/pagination'

export const pageBreaksPluginKey = new PluginKey<PageBreaksState>('pageBreaks')

interface PageBreaksState {
  set: DecorationSet
  format: 'russian' | 'hollywood'
}

// sceneDialog → scene-dialog (camelCase PM-имя → data-type)
const dataTypeOf = (node: PMNode) =>
  node.type.name.replace(/([A-Z])/g, '-$1').toLowerCase()

function buildDecorations(
  doc: PMNode,
  breaks: PageBreakInfo[],
  format: 'russian' | 'hollywood'
): DecorationSet {
  if (!breaks.length) return DecorationSet.empty

  const children: { node: PMNode; pos: number }[] = []
  doc.forEach((node, pos) => children.push({ node, pos }))

  const decorations: Decoration[] = []
  for (const b of breaks) {
    const target = children[b.startIndex]
    if (!target) continue
    const attrs: Record<string, string> = { 'data-page-break': `Страница ${b.page}` }
    if (b.splitOffsetPx !== undefined) {
      // Разрыв внутри блока (T-16): линия по смещению + маркер для реплик
      attrs['data-page-split'] = String(Math.round(b.splitOffsetPx))
      attrs['style'] = `--split-offset:${Math.round(b.splitOffsetPx)}px`
      if (CONTINUED_MARKER_TYPES.has(dataTypeOf(target.node))) {
        attrs['data-continued'] = format === 'hollywood' ? "(CONT'D)" : '(ПРОДОЛЖЕНИЕ)'
      }
    }
    decorations.push(Decoration.node(target.pos, target.pos + target.node.nodeSize, attrs))
  }
  return DecorationSet.create(doc, decorations)
}

/**
 * Разрывы страниц как PM-декорации (T-16/T-94).
 * Почему не data-* атрибуты напрямую: ProseMirror пересинхронизирует DOM-атрибуты
 * нод при каждом ререндере и стирает чужие атрибуты. Decoration.node — часть
 * конвейера рендера PM, поэтому атрибуты переживают ререндеры и класс-апдейты
 * других плагинов. Обновление — meta-транзакцией (документ не меняется,
 * в сохранённый HTML и undo маркеры не попадают).
 */
export const PageBreaksExtension = Extension.create({
  name: 'pageBreaks',

  addProseMirrorPlugins() {
    return [
      new Plugin<PageBreaksState>({
        key: pageBreaksPluginKey,
        state: {
          init: () => ({ set: DecorationSet.empty, format: 'russian' }),
          apply(tr, value) {
            const meta = tr.getMeta(pageBreaksPluginKey) as
              | { breaks?: PageBreakInfo[]; format?: 'russian' | 'hollywood' }
              | undefined
            if (meta) {
              const format = meta.format ?? value.format
              return { set: buildDecorations(tr.doc, meta.breaks ?? [], format), format }
            }
            if (tr.docChanged) {
              return { set: value.set.map(tr.mapping, tr.doc), format: value.format }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            return pageBreaksPluginKey.getState(state)?.set ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})
