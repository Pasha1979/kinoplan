import type { HelpActionGroup } from './types'
import { helpActionGroups } from '../hotkeys/registry'

// Таблица «Клавиши и действия» генерируется из единого реестра хоткеев —
// справка и обработчики расходиться не могут (src/hotkeys/registry.ts)
export const TEXT_ACTIONS: HelpActionGroup[] = helpActionGroups('text')
