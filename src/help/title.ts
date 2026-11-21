import type { PageHelp } from './types'
import { helpActionGroups } from '../hotkeys/registry'
import { TITLE_FEATURES } from './title.tips'

export const titleHelp: PageHelp = {
  pageId: 'title',
  overview: [
    {
      title: 'Что это за страница',
      body: 'Вкладка «Титул» — титульный лист сценария: название, автор, режиссёр, кинокомпания и контакты. Заполняется один раз на проект и печатается первой страницей сценария.',
    },
    {
      title: 'Как устроен экран',
      body: 'Слева — поля ввода данных титула. Справа — живой предпросмотр листа, как он попадёт на печать. В шапке предпросмотра — переключатель формата и кнопка «Печатать».',
    },
  ],
  actions: helpActionGroups('title'),
  features: TITLE_FEATURES,
  notes: [
    {
      title: 'Титул при экспорте',
      body: 'Титульный лист включается в печать и экспорт сценария только при включённом переключателе «Печатать» на этой вкладке.',
    },
  ],
}
