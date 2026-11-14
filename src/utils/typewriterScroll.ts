import type { Editor } from '@tiptap/react'

/**
 * T-105: typewriter-режим — блок с курсором держится на вертикальной
 * середине экрана. Вызывается на selectionUpdate/update редактора.
 * Без smooth — каждый символ иначе запускал бы плавную прокрутку.
 */
export function centerCursorBlock(editor: Editor): void {
  const { $from } = editor.state.selection
  if ($from.depth < 1) return
  const domNode = editor.view.nodeDOM($from.before(1)) as HTMLElement | null
  domNode?.scrollIntoView?.({ block: 'center' })
}
