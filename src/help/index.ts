import type { PageId, PageHelp } from './types'
import { homeHelp } from './home'
import { textHelp } from './text'
import { titleHelp } from './title'
import { breakdownHelp } from './breakdown'
import { cardsHelp } from './cards'
import { developmentHelp } from './development'
import { planHelp } from './plan'
import { statisticsHelp } from './statistics'

/** Реестр справки: pageId → паспорт страницы */
export const HELP_PAGES: Record<PageId, PageHelp> = {
  home: homeHelp,
  text: textHelp,
  title: titleHelp,
  breakdown: breakdownHelp,
  cards: cardsHelp,
  development: developmentHelp,
  plan: planHelp,
  statistics: statisticsHelp,
}

export function getPageHelp(pageId: string): PageHelp {
  return HELP_PAGES[(pageId as PageId) in HELP_PAGES ? (pageId as PageId) : 'text']
}
