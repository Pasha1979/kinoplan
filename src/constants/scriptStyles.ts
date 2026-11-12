/**
 * Word-совместимые inline-стили для каждого типа блока сценария.
 * Используются как в редакторе (clipboard copy), так и в PageCounter (virtual A4).
 */

export const SCRIPT_STYLES: Record<string, { russian: string; hollywood: string }> = {
  'scene-header': {
    russian: 'margin-top: 16px; margin-bottom: 0; font-weight: 600; text-transform: uppercase; margin-left: 0',
    hollywood: 'margin-top: 16px; margin-bottom: 0; font-weight: 600; text-transform: uppercase; margin-left: 0',
  },
  'scene-cast': {
    russian: 'margin-top: 0; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; margin-left: 0',
    hollywood: 'margin-top: 0; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; margin-left: 0',
  },
  'scene-action': {
    russian: 'margin-top: 12px; margin-bottom: 12px; margin-left: 0',
    hollywood: 'margin-top: 12px; margin-bottom: 12px; margin-left: 0',
  },
  'scene-character': {
    russian: 'margin-top: 16px; margin-bottom: 0; text-align: center; font-weight: 600; text-transform: uppercase; margin-left: 0',
    hollywood: 'margin-top: 16px; margin-bottom: 0; margin-left: 9.3cm; font-weight: 600; text-transform: uppercase',
  },
  'scene-dialog': {
    russian: 'margin-top: 0; margin-bottom: 16px; margin-left: 3.75cm; margin-right: 3.75cm',
    hollywood: 'margin-top: 0; margin-bottom: 16px; margin-left: 6.35cm; margin-right: 2.5cm',
  },
  // Ремарка — те же отступы что --*-parenthetical-*-indent в index.css
  'scene-parenthetical': {
    russian: 'margin-top: 0; margin-bottom: 0; margin-left: 5.5cm; margin-right: 4.5cm',
    hollywood: 'margin-top: 0; margin-bottom: 0; margin-left: 7.8cm; margin-right: 2.5cm',
  },
  'scene-transition': {
    russian: 'margin-top: 16px; margin-bottom: 16px; text-align: right; font-weight: 600; text-transform: uppercase; margin-left: 0',
    hollywood: 'margin-top: 16px; margin-bottom: 16px; text-align: right; font-weight: 600; text-transform: uppercase; margin-left: 0',
  },
}
