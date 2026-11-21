import type { PageId, HelpActionGroup, HelpAction } from '../help/types'

/** Единый реестр хоткеев и действий страниц.
 *  Одни данные порождают: таблицу «Клавиши и действия» справки
 *  и матчеры глобального диспетчера (runHotkeyDispatch).
 *  Редакторские клавиши (ProseMirror) — только документируются здесь:
 *  их обработка остаётся в useScriptEditorLogic. */

export interface HotkeyEntry {
  /** id нужен для диспетчера — обработчик находится по нему */
  id?: string
  /** страница справки, где строка отображается */
  page: PageId
  /** группа вкладки «Клавиши и действия» */
  group: string
  /** цвет группы (как в справке) */
  groupColor?: string
  /** бейджи клавиш (KeyBadge) */
  keys?: string[]
  /** текст строки */
  label: string
  /** результат — для действий мышью/кнопкой без клавиш */
  result?: string
  /** мелкая метка («вход», «выход»…) */
  note?: string
  /** якорь deep-link */
  anchor?: string
  /** рантайм-матчер глобального keydown — только у диспетчеризуемых клавиш */
  match?: (e: KeyboardEvent) => boolean
  /** диспетчер зовёт preventDefault (дефолт true; Escape-выходы — false) */
  preventDefault?: boolean
}

const ctrl = (code: string) => (e: KeyboardEvent) =>
  (e.ctrlKey || e.metaKey) && e.code === code && !e.shiftKey && !e.altKey
const key = (k: string) => (e: KeyboardEvent) => e.key === k

export const HOTKEYS: HotkeyEntry[] = [
  // ─── Текст: документ ───
  { id: 'script.save',          page: 'text', group: 'Документ', keys: ['Ctrl', 'S'], label: 'Сохранить сценарий вручную',
    match: ctrl('KeyS') },
  { page: 'text', group: 'Документ', keys: ['Ctrl', 'Z'], label: 'Отменить последнее действие' },
  { page: 'text', group: 'Документ', keys: ['Ctrl', 'Y'], label: 'Повторить отменённое действие' },
  { page: 'text', group: 'Документ', keys: ['Ctrl', 'A'], label: 'Выделить весь текст' },
  { page: 'text', group: 'Документ', keys: ['Ctrl', 'C'], label: 'Копировать' },
  { page: 'text', group: 'Документ', keys: ['Ctrl', 'X'], label: 'Вырезать' },
  { page: 'text', group: 'Документ', keys: ['Ctrl', 'V'], label: 'Вставить (с автоопределением типов блоков)' },
  { id: 'script.help',          page: 'text', group: 'Документ', keys: ['F1'], label: 'Справка по текущей вкладке',
    match: key('F1') },

  // ─── Главная ───
  { id: 'home.help',            page: 'home', group: 'Справка', keys: ['F1'], label: 'Открыть справку по странице',
    match: key('F1') },

  // ─── Текст: блоки и форматирование ───
  { page: 'text', group: 'Блоки и форматирование', keys: ['Tab'], label: 'Следующий тип блока по кругу' },
  { page: 'text', group: 'Блоки и форматирование', keys: ['Shift', 'Tab'], label: 'Предыдущий тип блока' },
  { page: 'text', group: 'Блоки и форматирование', keys: ['Enter'], label: 'Новая строка; тип определяется автоматически по контексту' },
  { page: 'text', group: 'Блоки и форматирование', keys: ['Shift', 'Enter'], label: 'Мягкий перенос — новая строка без смены типа блока' },
  { page: 'text', group: 'Блоки и форматирование', keys: ['Ctrl', 'B'], label: 'Жирный текст' },
  { page: 'text', group: 'Блоки и форматирование', keys: ['Ctrl', 'I'], label: 'Курсив' },
  { page: 'text', group: 'Блоки и форматирование', keys: ['Ctrl', 'U'], label: 'Подчёркнутый текст' },

  // ─── Текст: навигация ───
  { page: 'text', group: 'Навигация', keys: ['Ctrl', 'Home'], label: 'Перейти в начало документа' },
  { page: 'text', group: 'Навигация', keys: ['Ctrl', 'End'], label: 'Перейти в конец документа' },
  { page: 'text', group: 'Навигация', keys: ['↑', '↓'], label: 'Перемещение по строкам' },
  { page: 'text', group: 'Навигация', keys: ['←', '→'], label: 'Перемещение по символам' },
  { page: 'text', group: 'Навигация', keys: ['Ctrl', '←'], label: 'На слово назад' },
  { page: 'text', group: 'Навигация', keys: ['Ctrl', '→'], label: 'На слово вперёд' },
  { page: 'text', group: 'Навигация', keys: ['Ctrl', 'G'], label: 'Перейти к сцене по номеру (вкл. литеры «5-А»)' },
  { page: 'text', group: 'Навигация', keys: ['Alt', '↑'], label: 'Переместить сцену целиком вверх' },
  { page: 'text', group: 'Навигация', keys: ['Alt', '↓'], label: 'Переместить сцену целиком вниз' },
  { page: 'text', group: 'Навигация', keys: ['ПКМ'], label: 'Меню операций со сценой (дублировать, разделить, объединить, удалить)' },

  // ─── Текст: поиск и замена ───
  { id: 'script.search',        page: 'text', group: 'Поиск и замена', keys: ['Ctrl', 'F'], label: 'Открыть поиск по сценарию',
    match: ctrl('KeyF') },
  { id: 'script.replace',       page: 'text', group: 'Поиск и замена', keys: ['Ctrl', 'H'], label: 'Открыть поиск сразу с заменой',
    match: ctrl('KeyH') },
  { page: 'text', group: 'Поиск и замена', keys: ['Enter'], label: 'Следующее совпадение (в режиме поиска)' },
  { page: 'text', group: 'Поиск и замена', keys: ['Shift', 'Enter'], label: 'Предыдущее совпадение (в режиме поиска)' },
  { page: 'text', group: 'Поиск и замена', keys: ['Escape'], label: 'Закрыть поиск / сбросить выделение' },

  // ─── Текст: Split Screen ───
  { page: 'text', group: 'Split Screen — два окна редактора', groupColor: '#a78bfa', keys: ['⊞⊞'], label: 'Кнопка Split Screen в шапке (иконка двух колонок)', note: 'вход' },
  { page: 'text', group: 'Split Screen — два окна редактора', groupColor: '#a78bfa', keys: ['клик панели'], label: 'Сделать панель активной (синяя полоска сверху)' },
  { page: 'text', group: 'Split Screen — два окна редактора', groupColor: '#a78bfa', keys: ['клик сцены'], label: 'Переход к сцене — идёт в активную панель' },
  { page: 'text', group: 'Split Screen — два окна редактора', groupColor: '#a78bfa', keys: ['тяни divider'], label: 'Изменить ширину панелей (25–75%)' },
  { page: 'text', group: 'Split Screen — два окна редактора', groupColor: '#a78bfa', keys: ['селектор серии'], label: 'Правая панель: выбор серии — независимо от левой (для сериалов)' },
  { page: 'text', group: 'Split Screen — два окна редактора', groupColor: '#a78bfa', keys: ['⊞⊞'], label: 'Выключить Split Screen', note: 'выход' },

  // ─── Текст: Каркас сцен ───
  { page: 'text', group: 'Каркас сцен — обзор структуры', groupColor: '#f59e0b', keys: ['☰'], label: 'Кнопка в шапке редактора — сворачивает документ до шапок сцен', note: 'только просмотр' },
  { page: 'text', group: 'Каркас сцен — обзор структуры', groupColor: '#f59e0b', keys: ['Шапки + синопсис'], label: 'Переключатель сверху — показать описания под каждой сценой' },
  { page: 'text', group: 'Каркас сцен — обзор структуры', groupColor: '#f59e0b', keys: ['двойной клик / Enter'], label: 'Развернуть сцену — встроенный редактор, правки сохраняются кнопкой 💾' },
  { page: 'text', group: 'Каркас сцен — обзор структуры', groupColor: '#f59e0b', keys: ['Alt+↑/↓'], label: 'Переместить выделенную сцену' },
  { page: 'text', group: 'Каркас сцен — обзор структуры', groupColor: '#f59e0b', keys: ['драг'], label: 'Перестановка сцены мышью' },
  { page: 'text', group: 'Каркас сцен — обзор структуры', groupColor: '#f59e0b', keys: ['Esc'], label: 'Вернуться к полному тексту' },

  // ─── Текст: Focus Mode ───
  { page: 'text', group: 'Focus Mode — полноэкранный режим', groupColor: '#10b981', keys: ['⊞'], label: 'Кнопка в шапке редактора (иконка развернуть)', note: 'вход' },
  { id: 'script.exit-focus',    page: 'text', group: 'Focus Mode — полноэкранный режим', groupColor: '#10b981',
    keys: ['Escape'], label: 'Выйти из Focus Mode (если поиск закрыт)', match: key('Escape'), preventDefault: false },
  { page: 'text', group: 'Focus Mode — полноэкранный режим', groupColor: '#10b981', keys: ['↑ мышь'], label: 'Навести мышь к верху экрана — появится плашка выхода' },

  // ─── Текст: режимы диалогов и POV ───
  { id: 'script.exit-dialogue', page: 'text', group: 'Режимы диалогов и POV',
    keys: ['Escape'], label: 'Выйти из режима диалогов/POV (если поиск закрыт и нет Focus Mode)',
    match: key('Escape'), preventDefault: false },

  // ─── Текст: Multi-cursor ───
  { page: 'text', group: 'Multi-cursor — одновременное редактирование', groupColor: '#2196F3', keys: ['Ctrl', 'D'], label: 'Выделить слово под курсором', note: '1-е нажатие' },
  { page: 'text', group: 'Multi-cursor — одновременное редактирование', groupColor: '#2196F3', keys: ['Ctrl', 'D'], label: 'Добавить следующее совпадение того же слова', note: 'повторно' },
  { page: 'text', group: 'Multi-cursor — одновременное редактирование', groupColor: '#2196F3', keys: ['Escape'], label: 'Выйти из multi-cursor, вернуть обычный курсор' },
  { page: 'text', group: 'Multi-cursor — одновременное редактирование', groupColor: '#2196F3', keys: ['←', '→', '↑', '↓'], label: 'Сбросить multi-cursor и переместить курсор' },
  { page: 'text', group: 'Multi-cursor — одновременное редактирование', groupColor: '#2196F3', keys: ['Любой символ'], label: 'Ввод текста сразу во всех выделенных местах' },
  { page: 'text', group: 'Multi-cursor — одновременное редактирование', groupColor: '#2196F3', keys: ['Backspace'], label: 'Удалить символ слева во всех выделениях' },
  { page: 'text', group: 'Multi-cursor — одновременное редактирование', groupColor: '#2196F3', keys: ['Delete'], label: 'Удалить символ справа во всех выделениях' },
  { page: 'text', group: 'Multi-cursor — одновременное редактирование', groupColor: '#2196F3', keys: ['Ctrl', 'Z'], label: 'Отменить все изменения multi-cursor одним шагом' },

  // ─── Текст: пресеты и типографика ───
  { page: 'text', group: 'Пресеты клавиатуры и типографика', groupColor: '#fb923c', keys: ['Ctrl', 'Shift', 'S'], label: 'Новая сцена с автономером — работает во всех пресетах' },
  { page: 'text', group: 'Пресеты клавиатуры и типографика', groupColor: '#fb923c', keys: ['Enter', '×2'], label: 'Новая сцена на пустом блоке — только пресет «КИТ»' },
  { page: 'text', group: 'Пресеты клавиатуры и типографика', groupColor: '#fb923c', keys: ['селектор в шапке'], label: 'KinoPlan / Final Draft / КИТ — поведение Enter' },
  { page: 'text', group: 'Пресеты клавиатуры и типографика', groupColor: '#fb923c', keys: ['кнопка «»'], label: 'Авто-типографика: --→— · "→«» · (з/к)→(З/К)' },
  { page: 'text', group: 'Пресеты клавиатуры и типографика', groupColor: '#fb923c', keys: ['кнопка ⇕'], label: 'Typewriter — курсор всегда на середине экрана' },
  { page: 'text', group: 'Пресеты клавиатуры и типографика', groupColor: '#fb923c', keys: ['кнопка Формат'], label: 'Автоформатирование — распознать типы блоков заново' },
  { page: 'text', group: 'Пресеты клавиатуры и типографика', groupColor: '#fb923c', keys: ['кнопка ⚠'], label: 'Кнопки авто-исправлений в панели валидации' },

  // ─── Текст: SmartType ───
  { page: 'text', group: 'SmartType — автодополнение', keys: ['↑', '↓'], label: 'Навигация по подсказкам' },
  { page: 'text', group: 'SmartType — автодополнение', keys: ['Enter'], label: 'Принять выделенную подсказку', note: 'или Tab — настраивается в ⚙ → Редактор' },
  { page: 'text', group: 'SmartType — автодополнение', keys: ['Tab'], label: 'Принять подсказку, если выбрано в настройках' },
  { page: 'text', group: 'SmartType — автодополнение', keys: ['Escape'], label: 'Закрыть список подсказок' },
]

/** Таблица «Клавиши и действия» для страницы — из реестра, порядок групп как в списке */
export function helpActionGroups(page: PageId): HelpActionGroup[] {
  const groups: HelpActionGroup[] = []
  const byName = new Map<string, HelpActionGroup>()
  for (const h of HOTKEYS) {
    if (h.page !== page) continue
    let g = byName.get(h.group)
    if (!g) {
      g = { group: h.group, color: h.groupColor, items: [] }
      byName.set(h.group, g)
      groups.push(g)
    }
    if (h.groupColor && !g.color) g.color = h.groupColor
    const item: HelpAction = { keys: h.keys, label: h.label, result: h.result, note: h.note, anchor: h.anchor }
    g.items.push(item)
  }
  return groups
}

export interface HotkeyHandler {
  /** дополнительное условие (состояние компонента) — match одних клавиш недостаточно */
  when?: () => boolean
  run: () => void
}

/** Глобальный диспетчер: идёт по реестру, зовёт обработчик первого совпавшего id */
export function runHotkeyDispatch(e: KeyboardEvent, handlers: Record<string, HotkeyHandler>) {
  for (const h of HOTKEYS) {
    if (!h.id || !h.match?.(e)) continue
    const handler = handlers[h.id]
    if (!handler) continue
    if (handler.when && !handler.when()) continue
    if (h.preventDefault !== false) e.preventDefault()
    handler.run()
  }
}
