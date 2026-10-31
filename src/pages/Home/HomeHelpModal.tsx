import { LayoutGrid, FolderOpen, SlidersHorizontal, IdCard, MousePointerClick } from 'lucide-react'
import HelpModalBase, { KeyBadge } from '../../components/HelpModalBase'
import type { HelpColors } from '../../components/HelpModalBase'

interface HomeHelpModalProps {
  isDark: boolean
  onClose: () => void
}

const TABS = [
  { id: 'overview', label: 'Обзор',              icon: <LayoutGrid size={14} /> },
  { id: 'tabs',     label: 'Вкладки',            icon: <FolderOpen size={14} /> },
  { id: 'filters',  label: 'Поиск и фильтры',    icon: <SlidersHorizontal size={14} /> },
  { id: 'card',     label: 'Карточка проекта',   icon: <IdCard size={14} /> },
  { id: 'actions',  label: 'Все действия',       icon: <MousePointerClick size={14} /> },
]

/* ─── 1. Обзор ─── */

const OVERVIEW: { title: string; body: string }[] = [
  {
    title: 'Что это за страница',
    body: 'Главная страница КиноПлан — стартовый экран со списком всех ваших проектов. Отсюда вы попадаете внутрь любого проекта, создаёте новые, импортируете готовые из файлов и управляете списком: сортируете, фильтруете, архивируете.',
  },
  {
    title: 'Как устроен экран',
    body: 'Шапка — логотип КиноПлан, кнопка импорта, переключатель темы (тёмная/светлая), эта справка и настройки. Ниже — вкладки со списками проектов и кнопки «Импорт» / «Новый проект». Ещё ниже — панель поиска, сортировки и фильтров. Основную часть занимает сетка карточек проектов.',
  },
  {
    title: 'Карточка проекта',
    body: 'Каждый проект — карточка с полной сводкой: название, тип, статус производства, количество съёмочных дней и серий, общий процент готовности и прогресс по отдельным модулям (сценарий, расписание). Клик по карточке открывает проект.',
  },
  {
    title: 'Готовность проекта',
    body: 'Процент «готовность» — среднее по четырём модулям: сценарий, кастинг, локации, расписание. Оранжевая полоса — общий прогресс, ниже — детализация по сценарию (синяя) и расписанию (фиолетовая). Пока работает только модуль сценария — остальные проценты заполнятся по мере разработки модулей.',
  },
  {
    title: 'Первый запуск',
    body: 'Если проектов ещё нет, показывается приветственный экран с кнопкой «Создать первый проект». После создания вы сразу попадаете внутрь проекта.',
  },
  {
    title: 'Где хранятся данные',
    body: 'Все проекты, избранное, теги, порядок карточек и время последнего открытия хранятся локально на этом устройстве (localStorage браузера) и сохраняются автоматически — ничего нажимать не нужно.',
  },
]

/* ─── 2. Вкладки ─── */

const TABS_INFO: { name: string; desc: string; details: string[] }[] = [
  {
    name: 'Все',
    desc: 'Основной список — все проекты, кроме архивных.',
    details: [
      'Избранные проекты всегда показываются первыми (кроме сортировки «Свой порядок» — там порядок задаёте вы сами).',
      'Единственная вкладка, где работает ручное перетаскивание карточек.',
      'Счётчик показывает общее количество проектов без архива.',
    ],
  },
  {
    name: 'Избранное',
    desc: 'Только проекты, отмеченные звёздочкой.',
    details: [
      'Звёздочка ставится на карточке (правый верхний угол) или через контекстное меню.',
      'Пустая вкладка подскажет, как добавить первый избранный проект.',
      'Применяются те же поиск, сортировка и фильтры, что и на «Все».',
    ],
  },
  {
    name: 'Недавние',
    desc: 'Проекты, которые вы открывали, — самые свежие сверху.',
    details: [
      'Сортируются автоматически по времени последнего открытия — выпадающий список сортировки на этой вкладке скрыт.',
      'Время открытия записывается при клике по карточке, а также после создания и импорта проекта.',
      'Внизу карточки видно: «Открыт 5 минут назад», «вчера», «3 дня назад».',
      'Архивные проекты здесь не показываются.',
    ],
  },
  {
    name: 'Архив',
    desc: 'Скрытые проекты — не мешаются, но и не удалены.',
    details: [
      'Проект отправляется в архив через правый клик → «В архив».',
      'Архивные проекты не видны ни на одной другой вкладке и не участвуют в поиске.',
      'Вернуть: правый клик по карточке в архиве → «Вернуть из архива».',
      'Удаление из архива работает так же — через контекстное меню.',
    ],
  },
]

/* ─── 3. Поиск и фильтры ─── */

const SEARCH_INFO: { title: string; body: string }[] = [
  {
    title: 'Поиск',
    body: 'Поле «Найти проект...» фильтрует список по названию мгновенно, по мере набора. Регистр букв не важен. Поиск работает на всех вкладках — в том числе внутри архива.',
  },
  {
    title: 'Активные фильтры',
    body: 'Выбранный фильтр подсвечивается оранжевой рамкой — всегда видно, что список ограничен. Кнопка «Сбросить» появляется рядом и очищает все фильтры одним нажатием (поиск при этом сохраняется).',
  },
  {
    title: 'Пустые результаты',
    body: 'Если поиск или фильтры ничего не нашли, появится «Ничего не найдено». Если вкладка пуста сама по себе — подсказка, что туда попадает (например, как добавить проект в избранное).',
  },
]

const SORT_INFO: { name: string; body: string }[] = [
  { name: 'Сначала изменённые', body: 'По умолчанию: недавно редактированные проекты сверху.' },
  { name: 'По названию (А–Я)',  body: 'Алфавитный порядок с учётом русского языка.' },
  { name: 'По дате создания',   body: 'Новые проекты сверху, старые внизу.' },
  { name: 'По прогрессу',       body: 'Самые готовые проекты первыми — удобно видеть, что ближе к завершению.' },
  { name: 'Свой порядок',       body: 'Включает ручное перетаскивание карточек мышью. Порядок сохраняется навсегда. Работает только на вкладке «Все» без активного поиска и фильтров.' },
]

const FILTERS_INFO: { name: string; body: string }[] = [
  { name: 'Тип',     body: 'Сериал, полный метр, реклама, клип или другое. Показывает проекты только выбранного формата.' },
  { name: 'Статус',  body: 'Пре-продакшн, в съёмке, пост-продакшн или завершён. Фильтр по стадии производства.' },
  { name: 'Теги',    body: 'Появляется автоматически, когда у хотя бы одного проекта есть теги. Показывает проекты с выбранной меткой. Теги ставятся через правый клик → «Теги…».' },
]

/* ─── 4. Карточка проекта ─── */

const CARD_PARTS: { name: string; body: string }[] = [
  { name: 'Иконка и название',      body: 'Иконка типа проекта (📺 сериал, 🎬 фильм, 📢 реклама, 🎵 клип, 📁 другое) и название. Под названием — тип и теги (до трёх, остальные сворачиваются в «+N»).' },
  { name: 'Звёздочка',              body: '⭐ в правом верхнем углу — избранное. Жёлтая = в избранном. Клик переключает состояние.' },
  { name: 'Бейдж статуса',          body: 'Цветная метка стадии: «Пре-продакшн» (синяя), «В съёмке» (оранжевая), «Пост-продакшн» (фиолетовая), «Завершён» (зелёная).' },
  { name: 'Статистика',             body: 'Три колонки: запланированные съёмочные дни, количество серий (для сериалов), общая готовность в процентах.' },
  { name: 'Полосы прогресса',       body: 'Оранжевая градиентная полоса — общая готовность. Ниже детализация: «Сценарий» (синяя) и «Расписание» (фиолетовая) с процентами.' },
  { name: 'Нижняя строка',          body: 'Слева — дата начала проекта (📅). Справа — «Открыт N назад» (время последнего открытия) или «Изменён (дата)», если проект ещё не открывали.' },
  { name: 'Кнопки при наведении',   body: 'Наведите мышь на карточку — внизу справа появятся кнопки: ⬇ экспорт в JSON-файл и 🗑 удалить (спросит подтверждение).' },
  { name: 'Контекстное меню',       body: 'Правый клик по карточке — меню действий: открыть, избранное, теги, дублировать, экспорт, архив, удалить.' },
]

const MENU_INFO: { name: string; body: string }[] = [
  { name: 'Открыть',            body: 'Переход внутрь проекта — то же, что клик по карточке.' },
  { name: 'В избранное',        body: 'Добавляет или снимает звёздочку избранного.' },
  { name: 'Теги…',              body: 'Открывает редактор тегов: введите метку и нажмите Enter. Существующие теги удаляются крестиком. Дубликаты не создаются.' },
  { name: 'Дублировать',        body: 'Создаёт копию проекта с названием «Название (копия)» — со всеми настройками и данными.' },
  { name: 'Экспорт',            body: 'Скачивает проект в JSON-файл — для переноса на другой компьютер или резервной копии.' },
  { name: 'В архив',            body: 'Прячет проект на вкладку «Архив». Не удаляет — можно вернуть в любой момент.' },
  { name: 'Удалить',            body: 'Удаляет проект безвозвратно вместе с черновиками сценария. Сначала спросит подтверждение.' },
]

/* ─── 5. Действия ─── */

const ACTIONS: { action: string; result: string }[] = [
  { action: 'Клик по карточке',              result: 'Открыть проект' },
  { action: 'Enter / Space на карточке',     result: 'Открыть проект (с клавиатуры)' },
  { action: '⭐ на карточке',                result: 'Избранное вкл/выкл' },
  { action: 'Наведение мыши на карточку',    result: 'Показать кнопки: экспорт, удалить' },
  { action: 'Правый клик по карточке',       result: 'Контекстное меню (7 действий)' },
  { action: 'Перетаскивание карточки',       result: 'Свой порядок — см. условия ниже' },
  { action: 'Escape',                        result: 'Закрыть меню, теги, модальные окна' },
  { action: 'Клик вне меню',                 result: 'Закрыть меню или редактор тегов' },
  { action: '«Импорт»',                      result: 'Загрузить проект из JSON-файла' },
  { action: '«Новый проект»',                result: 'Мастер создания проекта' },
  { action: '«☀️/🌙» в шапке',               result: 'Переключить тёмную/светлую тему' },
]

const NOTES: { title: string; body: string }[] = [
  {
    title: 'Условия перетаскивания',
    body: 'Drag-and-drop карточек работает только когда: вкладка «Все», сортировка «Свой порядок», нет текста в поиске и нет активных фильтров. Иначе порядок был бы неоднозначным.',
  },
  {
    title: 'Создание проекта',
    body: 'Мастер «Новый проект» спросит: название, описание, тип (фильм/сериал/реклама/клип/другое), число серий и их хронометраж (для сериалов), выработку в день, съёмочные дни и место хранения. После создания проект открывается сразу.',
  },
  {
    title: 'Импорт проекта',
    body: 'Принимает JSON-файл, выгруженный через «Экспорт». Файл проверяется на корректность — неправильный формат покажет ошибку, но ничего не сломает. После импорта проект сразу открывается.',
  },
  {
    title: 'Удаление — безвозвратно',
    body: 'Удаление проекта стирает также все черновики его сценариев. Действие нельзя отменить — поэтому всегда спрашивает подтверждение. Если проект нужно просто убрать с глаз — используйте архив.',
  },
]

/* ─── Компонент ─── */

export default function HomeHelpModal({ isDark, onClose }: HomeHelpModalProps) {
  const card = (c: HelpColors, title: React.ReactNode, body: string, tag?: string, key?: React.Key) => (
    <div
      key={key}
      style={{
        background: c.bgSecondary,
        borderRadius: 10,
        border: `1px solid ${c.border}`,
        padding: '13px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {tag && (
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#818cf8', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>{tag}</span>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.65 }}>{body}</div>
    </div>
  )

  const groupLabel = (c: HelpColors, text: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.textMuted, marginTop: 14, marginBottom: 10 }}>{text}</div>
  )

  const renderTab = (tabId: string, c: HelpColors) => {
    /* ─── Обзор ─── */
    if (tabId === 'overview') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OVERVIEW.map((item, i) => card(c, item.title, item.body, undefined, i))}
        </div>
      )
    }

    /* ─── Вкладки ─── */
    if (tabId === 'tabs') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TABS_INFO.map((tab, i) => (
            <div
              key={i}
              style={{
                background: c.bgSecondary,
                borderRadius: 10,
                border: `1px solid ${c.border}`,
                padding: '13px 16px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 4 }}>{tab.name}</div>
              <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.65, marginBottom: 8 }}>{tab.desc}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {tab.details.map((d, di) => (
                  <li key={di} style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.7 }}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )
    }

    /* ─── Поиск и фильтры ─── */
    if (tabId === 'filters') {
      return (
        <div>
          {groupLabel(c, 'Поиск')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SEARCH_INFO.map((item, i) => card(c, item.title, item.body, undefined, i))}
          </div>

          {groupLabel(c, 'Сортировка — 5 вариантов')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SORT_INFO.map((item, i) => card(c, item.name, item.body, undefined, i))}
          </div>

          {groupLabel(c, 'Фильтры')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FILTERS_INFO.map((item, i) => card(c, item.name, item.body, undefined, i))}
          </div>
        </div>
      )
    }

    /* ─── Карточка проекта ─── */
    if (tabId === 'card') {
      return (
        <div>
          {groupLabel(c, 'Элементы карточки')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CARD_PARTS.map((item, i) => card(c, item.name, item.body, undefined, i))}
          </div>

          {groupLabel(c, 'Контекстное меню — правый клик')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MENU_INFO.map((item, i) => card(c, item.name, item.body, undefined, i))}
          </div>
        </div>
      )
    }

    /* ─── Все действия ─── */
    return (
      <div>
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
                gap: 16,
                padding: '10px 14px',
                borderBottom: i < ACTIONS.length - 1 ? `1px solid ${c.border}` : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: c.textPrimary }}>{item.action}</span>
              <span style={{ fontSize: 12, color: c.textMuted, textAlign: 'right' }}>{item.result}</span>
            </div>
          ))}
        </div>

        {groupLabel(c, 'Важно знать')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NOTES.map((item, i) => card(c, item.title, item.body, undefined, i))}
          {card(c, 'Клавиатура', 'Карточку можно открыть клавишами Enter или Space, когда она в фокусе — перемещайтесь по карточкам клавишей Tab.', undefined, 'kbd')}
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, color: c.textMuted }}>
            Подсказка: <KeyBadge k="Escape" /> закрывает любое всплывающее окно на этой странице.
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
