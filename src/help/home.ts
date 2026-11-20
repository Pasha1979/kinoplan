import type { PageHelp } from './types'
import {
  OVERVIEW, TABS_INFO, SEARCH_INFO, SORT_INFO, FILTERS_INFO,
  CARD_PARTS, MENU_INFO, ACTIONS, NOTES,
} from './home.data'

export const homeHelp: PageHelp = {
  pageId: 'home',
  overview: OVERVIEW,
  actions: [
    {
      group: 'Все действия',
      items: ACTIONS.map((a) => ({ label: a.action, result: a.result })),
    },
  ],
  features: [
    {
      group: 'Вкладки',
      items: TABS_INFO.map((t) => ({ title: t.name, body: t.desc, details: t.details })),
    },
    {
      group: 'Поиск и сортировка',
      items: [
        ...SEARCH_INFO.map((s) => ({ title: s.title, body: s.body })),
        ...SORT_INFO.map((s) => ({ title: `Сортировка «${s.name}»`, body: s.body })),
      ],
    },
    {
      group: 'Фильтры',
      items: FILTERS_INFO.map((f) => ({ title: f.name, body: f.body })),
    },
    {
      group: 'Карточка проекта',
      items: CARD_PARTS.map((c) => ({ title: c.name, body: c.body })),
    },
    {
      group: 'Контекстное меню',
      items: MENU_INFO.map((m) => ({ title: m.name, body: m.body })),
    },
  ],
  notes: NOTES,
}
