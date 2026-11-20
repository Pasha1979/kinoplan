/** Паспорт страницы — единая модель контента справки */

export type PageId =
  | 'home' | 'text' | 'title' | 'breakdown' | 'cards'
  | 'development' | 'plan' | 'statistics'

export interface HelpItem {
  title: string
  body: string
  /** сворачиваемые «Подробности» — список пунктов */
  details?: string[]
}

/** Одна строка вкладки «Клавиши и действия»: действие → результат */
export interface HelpAction {
  /** что делает пользователь / описание строки */
  label: string
  /** клавиши (KeyBadge) — если действие клавиатурное */
  keys?: string[]
  /** результат — если действие мышью/кнопкой */
  result?: string
  /** мелкая метка («вход», «выход»…) */
  note?: string
}

export interface HelpActionGroup {
  group: string
  color?: string
  items: HelpAction[]
}

/** Группа подсказок вкладки «Возможности» */
export interface HelpTip {
  title: string
  body: string
  /** группа — блок данных страницы, которому принадлежит подсказка */
  group: string
}

export interface HelpTipGroup {
  group: string
  color?: string
  items: HelpItem[]
}

/** Тип блока сценария — таблица первой группы «Возможностей» страницы Текст */
export interface HelpBlockType {
  name: string
  shortcut: string
  example: string
  auto: string
  color: string
}

export interface PageHelp {
  pageId: PageId
  /** «Обзор» — есть всегда */
  overview: HelpItem[]
  /** «Клавиши и действия» — скрывается, если пусто */
  actions: HelpActionGroup[]
  /** «Возможности» — подсказки по группам; скрывается, если пусто */
  features: HelpTipGroup[]
  /** «Нюансы» — скрывается, если пусто */
  notes: HelpItem[]
  /** таблица типов блоков — только у страницы Текст, первая группа «Возможностей» */
  blockTypes?: HelpBlockType[]
}

export const PAGE_LABELS: Record<PageId, string> = {
  home: 'Главная',
  text: 'Текст',
  title: 'Титул',
  breakdown: 'Разбивка',
  cards: 'Карточки',
  development: 'Разработка',
  plan: 'План',
  statistics: 'Статистика',
}
