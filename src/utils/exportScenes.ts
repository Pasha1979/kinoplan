import type { Scene, Script } from '../store/scriptStore'
import { convertToWordCompatibleHtml } from './wordExport'
import { extractSceneHtml } from '../pages/Script/components/SceneEditModal'

/**
 * T-61/T-63: собирает Word-совместимый HTML из выбранных сцен сценария.
 * selectedIds === null → все сцены.
 */
export function buildScenesExportHtml(
  script: Pick<Script, 'content' | 'format'>,
  scenes: Scene[],
  selectedIds: ReadonlySet<string> | null
): string {
  const content = script.content || ''
  const format = (script.format as 'russian' | 'hollywood') || 'russian'
  const parts = scenes
    .map((s, idx) => (selectedIds === null || selectedIds.has(s.id)
      ? extractSceneHtml(content, s.number, idx)
      : ''))
    .filter(Boolean)
  return convertToWordCompatibleHtml(parts.join(''), format)
}

/** Оборачивает тело в документ, который Word открывает как .doc */
export function wrapAsWordDoc(bodyHtml: string, title: string): string {
  return [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">',
    `<head><meta charset="utf-8"><title>${title}</title></head>`,
    `<body>${bodyHtml}</body></html>`,
  ].join('')
}
