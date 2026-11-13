import { SCRIPT_LAYOUT, type ScriptLayout } from './scriptLayout'

/**
 * Word-совместимые inline-стили для каждого типа блока сценария.
 * Используются как в редакторе (clipboard copy), так и в PageCounter (virtual A4).
 * T-58: стили генерируются из SCRIPT_LAYOUT — единого источника с CSS-переменными.
 */

const upper = 'font-weight: 600; text-transform: uppercase'

function styles(l: ScriptLayout): Record<string, string> {
  return {
    'scene-header': `margin-top: ${l.header.marginTop}; margin-bottom: ${l.header.marginBottom}; ${upper}; margin-left: 0`,
    'scene-cast': `margin-top: ${l.cast.marginTop}; margin-bottom: ${l.cast.marginBottom}; ${upper}; margin-left: 0`,
    'scene-action': `margin-top: ${l.action.marginTop}; margin-bottom: ${l.action.marginBottom}; margin-left: 0`,
    'scene-character': `margin-top: ${l.character.marginTop}; margin-bottom: ${l.character.marginBottom}; margin-left: ${l.character.characterIndent}; ${upper}`,
    'scene-dialog': `margin-top: ${l.dialog.marginTop}; margin-bottom: ${l.dialog.marginBottom}; margin-left: ${l.dialog.leftIndent}; margin-right: ${l.dialog.rightIndent}`,
    'scene-parenthetical': `margin-top: ${l.parenthetical.marginTop}; margin-bottom: ${l.parenthetical.marginBottom}; margin-left: ${l.parenthetical.leftIndent}; margin-right: ${l.parenthetical.rightIndent}`,
    'scene-transition': `margin-top: ${l.transition.marginTop}; margin-bottom: ${l.transition.marginBottom}; text-align: right; ${upper}; margin-left: 0`,
  }
}

export const SCRIPT_STYLES: Record<string, { russian: string; hollywood: string }> = {
  'scene-header': {
    russian: styles(SCRIPT_LAYOUT.russian)['scene-header'],
    hollywood: styles(SCRIPT_LAYOUT.hollywood)['scene-header'],
  },
  'scene-cast': {
    russian: styles(SCRIPT_LAYOUT.russian)['scene-cast'],
    hollywood: styles(SCRIPT_LAYOUT.hollywood)['scene-cast'],
  },
  'scene-action': {
    russian: styles(SCRIPT_LAYOUT.russian)['scene-action'],
    hollywood: styles(SCRIPT_LAYOUT.hollywood)['scene-action'],
  },
  'scene-character': {
    russian: styles(SCRIPT_LAYOUT.russian)['scene-character'],
    hollywood: styles(SCRIPT_LAYOUT.hollywood)['scene-character'],
  },
  'scene-dialog': {
    russian: styles(SCRIPT_LAYOUT.russian)['scene-dialog'],
    hollywood: styles(SCRIPT_LAYOUT.hollywood)['scene-dialog'],
  },
  'scene-parenthetical': {
    russian: styles(SCRIPT_LAYOUT.russian)['scene-parenthetical'],
    hollywood: styles(SCRIPT_LAYOUT.hollywood)['scene-parenthetical'],
  },
  'scene-transition': {
    russian: styles(SCRIPT_LAYOUT.russian)['scene-transition'],
    hollywood: styles(SCRIPT_LAYOUT.hollywood)['scene-transition'],
  },
}
