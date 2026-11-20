import type { HelpBlockType } from './types'

export const BLOCK_TYPES: HelpBlockType[] = [
  {
    name: 'Шапка сцены',
    shortcut: 'Tab ×1',
    example: '1. ИНТ. КАБИНЕТ — ДЕНЬ',
    auto: 'Автоматически: начинается с ИНТ./ЭКСТ./ПАВ. Автокапс. Автонумерация.',
    color: '#f59e0b',
  },
  {
    name: 'Действие',
    shortcut: 'Tab ×2',
    example: 'Иван входит в комнату и оглядывается.',
    auto: 'Автоматически: обычный текст после Enter.',
    color: '#6b7280',
  },
  {
    name: 'Персонаж',
    shortcut: 'Tab ×3',
    example: 'ИВАН',
    auto: 'Автоматически: заглавные буквы без точек. Автокапс. Добавляется в cast.',
    color: '#818cf8',
  },
  {
    name: 'Диалог',
    shortcut: 'Tab ×4',
    example: 'Ты здесь давно?',
    auto: 'Автоматически: Enter после блока Персонаж или Ремарка.',
    color: '#10b981',
  },
  {
    name: 'Ремарка',
    shortcut: 'Tab ×5',
    example: '(пауза, тихо)',
    auto: 'Автоматически: текст в скобках после Персонажа или другой Ремарки.',
    color: '#a78bfa',
  },
  {
    name: 'Переход',
    shortcut: 'Tab ×6',
    example: 'МОНТАЖ:',
    auto: 'Автоматически: ключевые слова МОНТАЖ, РАССВЕТ, CUT TO, FADE OUT и т.д.',
    color: '#f43f5e',
  },
  {
    name: 'Состав (Cast)',
    shortcut: '—',
    example: 'дед, бабка, внучка...',
    auto: 'Заполняется автоматически из блоков Персонаж текущей сцены.',
    color: '#0ea5e9',
  },
]
