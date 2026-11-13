/**
 * Единый источник геометрии сценария (T-58).
 * Числа живут здесь — index.css не дублирует значения, а потребляет
 * CSS-переменные, которые выставляет applyScriptLayoutVars() при старте.
 * SCRIPT_STYLES (экспорт/Word/PageCounter) строится из тех же констант —
 * поэтому «экран = бумага» гарантированно.
 */

export interface BlockMetrics {
  marginTop: string
  marginBottom: string
  leftIndent?: string
  rightIndent?: string
  /** Имя персонажа по канону — отступ от левого края (не центрирование) */
  characterIndent?: string
}

export interface ScriptLayout {
  header: BlockMetrics
  cast: BlockMetrics
  action: BlockMetrics
  character: BlockMetrics
  dialog: BlockMetrics
  parenthetical: BlockMetrics
  transition: BlockMetrics
}

export const SCRIPT_LAYOUT: Record<'russian' | 'hollywood', ScriptLayout> = {
  // Русский формат — по стандарту КИТ Сценарист
  russian: {
    header: { marginTop: '16px', marginBottom: '0' },
    cast: { marginTop: '0', marginBottom: '8px' },
    action: { marginTop: '12px', marginBottom: '12px' },
    character: { marginTop: '16px', marginBottom: '0', characterIndent: '6.75cm' },
    dialog: { marginTop: '0', marginBottom: '16px', leftIndent: '3.75cm', rightIndent: '3.75cm' },
    parenthetical: { marginTop: '0', marginBottom: '0', leftIndent: '5.5cm', rightIndent: '4.5cm' },
    transition: { marginTop: '16px', marginBottom: '16px' },
  },
  // Голливудский формат — US industry standard (дюймы → см)
  hollywood: {
    header: { marginTop: '16px', marginBottom: '0' },
    cast: { marginTop: '0', marginBottom: '8px' },
    action: { marginTop: '12px', marginBottom: '12px' },
    character: { marginTop: '16px', marginBottom: '0', characterIndent: '9.3cm' },
    dialog: { marginTop: '0', marginBottom: '16px', leftIndent: '6.35cm', rightIndent: '2.5cm' },
    parenthetical: { marginTop: '0', marginBottom: '0', leftIndent: '7.8cm', rightIndent: '2.5cm' },
    transition: { marginTop: '16px', marginBottom: '16px' },
  },
}

/** CSS-переменные :root, которые выставляет applyScriptLayoutVars() */
export function layoutCssVars(format: 'russian' | 'hollywood'): Record<string, string> {
  const l = SCRIPT_LAYOUT[format]
  const prefix = `--${format}`
  return {
    [`${prefix}-header-margin-top`]: l.header.marginTop,
    [`${prefix}-header-margin-bottom`]: l.header.marginBottom,
    [`${prefix}-cast-margin-top`]: l.cast.marginTop,
    [`${prefix}-cast-margin-bottom`]: l.cast.marginBottom,
    [`${prefix}-action-margin-top`]: l.action.marginTop,
    [`${prefix}-action-margin-bottom`]: l.action.marginBottom,
    [`${prefix}-character-margin-top`]: l.character.marginTop,
    [`${prefix}-character-margin-bottom`]: l.character.marginBottom,
    [`${prefix}-character-indent`]: l.character.characterIndent!,
    [`${prefix}-dialog-margin-top`]: l.dialog.marginTop,
    [`${prefix}-dialog-margin-bottom`]: l.dialog.marginBottom,
    [`${prefix}-dialog-left-indent`]: l.dialog.leftIndent!,
    [`${prefix}-dialog-right-indent`]: l.dialog.rightIndent!,
    [`${prefix}-transition-margin-top`]: l.transition.marginTop,
    [`${prefix}-transition-margin-bottom`]: l.transition.marginBottom,
    [`${prefix}-parenthetical-margin-top`]: l.parenthetical.marginTop,
    [`${prefix}-parenthetical-margin-bottom`]: l.parenthetical.marginBottom,
    [`${prefix}-parenthetical-left-indent`]: l.parenthetical.leftIndent!,
    [`${prefix}-parenthetical-right-indent`]: l.parenthetical.rightIndent!,
  }
}

/** Применить метрики к :root — вызывается один раз при старте приложения */
export function applyScriptLayoutVars(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const format of ['russian', 'hollywood'] as const) {
    const vars = layoutCssVars(format)
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value)
    }
  }
}
