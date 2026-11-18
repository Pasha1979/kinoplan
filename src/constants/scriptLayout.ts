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

// Отступы — только marginTop («space before»), marginBottom всегда 0:
// граница между блоками считается один раз, экран = счётчик = экспорт.
// Строка = 18px (12pt × 1.125 — одинарный интерлиньяж Courier, ~54–55 строк/стр
// как в Final Draft «Normal»; правило «1 стр ≈ 1 мин» держится именно на этом).
// Header: 2 пустые строки (36px) как в FD/КИТ; action/character/transition: 1 (18px);
// внутри связки персонаж→(з/к)→диалог — 0 (без пустой строки).
export const SCRIPT_LAYOUT: Record<'russian' | 'hollywood', ScriptLayout> = {
  // Русский формат — по стандарту КИТ Сценарист (отступы от полей текста)
  russian: {
    header: { marginTop: '36px', marginBottom: '0' },
    cast: { marginTop: '0', marginBottom: '0' },
    action: { marginTop: '18px', marginBottom: '0' },
    character: { marginTop: '18px', marginBottom: '0', characterIndent: '6.75cm' },
    dialog: { marginTop: '0', marginBottom: '0', leftIndent: '3.75cm', rightIndent: '3.75cm' },
    parenthetical: { marginTop: '0', marginBottom: '0', leftIndent: '5.5cm', rightIndent: '4.5cm' },
    transition: { marginTop: '18px', marginBottom: '0' },
  },
  // Голливудский формат — Final Draft / US industry standard.
  // FD задаёт отступы от КРАЯ листа (имя 3.7″, диалог 2.5″–6.0″, ремарка 3.1″);
  // левое поле 1.5″ → переведено в отступы от поля текста.
  hollywood: {
    header: { marginTop: '36px', marginBottom: '0' },
    cast: { marginTop: '0', marginBottom: '0' },
    action: { marginTop: '18px', marginBottom: '0' },
    character: { marginTop: '18px', marginBottom: '0', characterIndent: '5.59cm' },   // 3.7″ − 1.5″ = 2.2″
    dialog: { marginTop: '0', marginBottom: '0', leftIndent: '2.54cm', rightIndent: '3.81cm' }, // 2.5″−1.5″=1″ / правая до 6.0″
    parenthetical: { marginTop: '0', marginBottom: '0', leftIndent: '4.06cm', rightIndent: '4.83cm' }, // 3.1″−1.5″=1.6″ / до 5.6″
    transition: { marginTop: '18px', marginBottom: '0' },
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
