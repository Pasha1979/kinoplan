import { LayoutGrid, Lightbulb, MousePointerClick } from 'lucide-react'
import HelpModalBase, { KeyBadge } from '../../components/HelpModalBase'
import type { HelpColors } from '../../components/HelpModalBase'

interface HomeHelpModalProps {
  isDark: boolean
  onClose: () => void
}

const TABS = [
  { id: 'overview', label: 'Обзор',     icon: <LayoutGrid size={14} /> },
  { id: 'tips',     label: 'Подсказки', icon: <Lightbulb size={14} /> },
  { id: 'actions',  label: 'Действия',  icon: <MousePointerClick size={14} /> },
]

const OVERVIEW: { title: string; body: string }[] = [
  {
    title: 'Что это за страница',
    body: 'Главная страница КиноПлан — здесь собраны все ваши проекты. Каждая карточка показывает: название, тип (фильм, сериал, реклама), статус производства, количество съёмочных дней, серий и общую готовность.',
  },
  {
    title: 'Готовность проекта',
    body: 'Процент на карточке — средний прогресс по модулям: сценарий, кастинг, локации, расписание. Оранжевая полоса — общая готовность, ниже детализация по сценарию и расписанию.',
  },
  {
    title: 'Вкладки',
    body: '«Все» — весь список проектов. «Избранное» — только помеченные звёздочкой. «Недавние» — отсортированы по времени последнего открытия. «Архив» — скрытые проекты, их можно вернуть в любой момент.',
  },
  {
    title: 'Панель управления',
    body: 'Под вкладками — поиск по названию, сортировка и фильтры по типу, статусу и тегам. Справа — кнопки «Импорт» (загрузить проект из JSON-файла) и «Новый проект».',
  },
]

const TIPS: { tag?: string; title: string; body: string }[] = [
  {
    tag: 'Избранное',
    title: 'Звёздочка на карточке',
    body: 'Нажмите ⭐ в правом верхнем углу карточки — проект попадёт в избранное. Избранные всегда показываются первыми на вкладке «Все», а вся группа — на вкладке «Избранное».',
  },
  {
    tag: 'Недавние',
    title: 'Быстрый доступ к рабочим проектам',
    body: 'Вкладка «Недавние» показывает проекты, которые вы открывали, — самые свежие сверху. Время последнего открытия видно внизу карточки: «Открыт 2 часа назад».',
  },
  {
    tag: 'Сортировка',
    title: 'Пять вариантов порядка',
    body: 'По умолчанию сверху — недавно изменённые. Можно сортировать по названию, дате создания и прогрессу. Вариант «Свой порядок» позволяет расставить карточки вручную перетаскиванием.',
  },
  {
    tag: 'Фильтры',
    title: 'Фильтрация по типу, статусу и тегам',
    body: 'Выпадающие списки рядом с поиском сужают список: например, только сериалы или только проекты в съёмке. Активный фильтр подсвечивается оранжевым. Кнопка «Сбросить» очищает все фильтры.',
  },
  {
    tag: 'Теги',
    title: 'Метки для проектов',
    body: 'Правый клик по карточке → «Теги…». Введите название и нажмите Enter — тег появится на карточке. Теги удобны для пометок вроде «Приоритет», «В работе», «Пауза». По тегам можно фильтровать список.',
  },
  {
    tag: 'Меню',
    title: 'Правый клик по карточке',
    body: 'Контекстное меню карточки: открыть, добавить в избранное, редактировать теги, дублировать проект, экспортировать в файл, отправить в архив или удалить.',
  },
  {
    tag: 'Архив',
    title: 'Архивация вместо удаления',
    body: 'Если проект не нужен сейчас, но удалять жалко — отправьте его в архив через контекстное меню. Он исчезнет из всех списков, но останется на вкладке «Архив». Оттуда его можно вернуть.',
  },
  {
    tag: 'Файлы',
    title: 'Экспорт и импорт',
    body: 'Проект выгружается в JSON-файл — кнопка ⬇ на карточке или пункт в контекстном меню. Загрузить проект обратно можно кнопкой «Импорт» справа вверху. Так можно переносить проекты между компьютерами.',
  },
]

const ACTIONS: { action: string; result: string }[] = [
  { action: 'Клик по карточке',            result: 'Открыть проект' },
  { action: '⭐ на карточке',              result: 'Добавить / убрать из избранного' },
  { action: 'Наведение мыши на карточку',  result: 'Показать кнопки: экспорт, удалить' },
  { action: 'Правый клик по карточке',     result: 'Контекстное меню действий' },
  { action: 'Перетаскивание карточки',     result: 'Свой порядок (в сортировке «Свой порядок»)' },
  { action: 'Escape',                      result: 'Закрыть меню или редактор тегов' },
]

export default function HomeHelpModal({ isDark, onClose }: HomeHelpModalProps) {
  const renderTab = (tabId: string, c: HelpColors) => {
    if (tabId === 'overview') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OVERVIEW.map((item, i) => (
            <div
              key={i}
              style={{
                background: c.bgSecondary,
                borderRadius: 10,
                border: `1px solid ${c.border}`,
                padding: '13px 16px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.65 }}>{item.body}</div>
            </div>
          ))}
        </div>
      )
    }

    if (tabId === 'tips') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TIPS.map((tip, i) => (
            <div
              key={i}
              style={{
                background: c.bgSecondary,
                borderRadius: 10,
                border: `1px solid ${c.border}`,
                padding: '13px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {tip.tag && (
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#818cf8', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>{tip.tag}</span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{tip.title}</span>
              </div>
              <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.65 }}>{tip.body}</div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div
        style={{
          background: c.bgSecondary,
          borderRadius: 10,
          border: `1px solid ${c.border}`,
          overflow: 'hidden',
        }}
      >
        {ACTIONS.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: i < ACTIONS.length - 1 ? `1px solid ${c.border}` : 'none',
            }}
          >
            <span style={{ fontSize: 13, color: c.textPrimary }}>{item.action}</span>
            <span style={{ fontSize: 12, color: c.textMuted }}>{item.result}</span>
          </div>
        ))}
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${c.border}` }}>
          <span style={{ fontSize: 12, color: c.textMuted }}>
            Карточку также можно открыть клавишами <KeyBadge k="Enter" /> или <KeyBadge k="Space" />, когда она в фокусе.
          </span>
        </div>
      </div>
    )
  }

  return (
    <HelpModalBase
      isDark={isDark}
      title="Помощь — Главная страница"
      tabs={TABS}
      renderTab={renderTab}
      onClose={onClose}
    />
  )
}
