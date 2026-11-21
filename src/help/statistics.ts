import type { PageHelp } from './types'
import { helpActionGroups } from '../hotkeys/registry'
import { STATISTICS_FEATURES } from './statistics.tips'

export const statisticsHelp: PageHelp = {
  pageId: 'statistics',
  overview: [
    {
      title: 'Что это за страница',
      body: 'Вкладка «Статистика» — аналитика сценария: метрики, распределение действия и диалогов, темп, тепловая карта персонажей × сцен, маркеры структуры актов и автоматические алерты.',
    },
    {
      title: 'Как устроен экран',
      body: 'В шапке — пилюли фильтра по сериям («Все / С1 / С2…») — вся аналитика пересчитывается под выбор. Ниже блоки: метрики и готовность серий, хронометраж по сценам с маркерами актов, темп, тепловая карта и «Инсайты и алерты».',
    },
  ],
  actions: helpActionGroups('statistics'),
  features: STATISTICS_FEATURES,
  notes: [
    {
      title: 'Маркеры актов — общие с доской',
      body: 'Маркеры АКТ 2, МИДПОИНТ и КУЛЬМИНАЦИЯ, расставленные здесь, отображаются и на доске карточек — редактируются в любом из двух мест.',
    },
  ],
}
