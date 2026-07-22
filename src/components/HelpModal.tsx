import { useState } from 'react'
import { X, Keyboard, Lightbulb, AlignLeft, Info } from 'lucide-react'

interface HelpModalProps {
  isDark: boolean
  onClose: () => void
}

type Tab = 'shortcuts' | 'tips' | 'formatting' | 'about'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'shortcuts',  label: 'Горячие клавиши', icon: <Keyboard size={14} /> },
  { id: 'tips',       label: 'Подсказки',        icon: <Lightbulb size={14} /> },
  { id: 'formatting', label: 'Форматирование',   icon: <AlignLeft size={14} /> },
  { id: 'about',      label: 'О программе',      icon: <Info size={14} /> },
]

const SHORTCUTS: { group: string; color?: string; items: { keys: string[]; desc: string; note?: string }[] }[] = [
  {
    group: 'Документ',
    items: [
      { keys: ['Ctrl', 'S'],    desc: 'Сохранить сценарий вручную' },
      { keys: ['Ctrl', 'Z'],    desc: 'Отменить последнее действие' },
      { keys: ['Ctrl', 'Y'],    desc: 'Повторить отменённое действие' },
      { keys: ['Ctrl', 'A'],    desc: 'Выделить весь текст' },
      { keys: ['Ctrl', 'C'],    desc: 'Копировать' },
      { keys: ['Ctrl', 'X'],    desc: 'Вырезать' },
      { keys: ['Ctrl', 'V'],    desc: 'Вставить (с автоопределением типов блоков)' },
    ],
  },
  {
    group: 'Блоки и форматирование',
    items: [
      { keys: ['Tab'],           desc: 'Следующий тип блока по кругу' },
      { keys: ['Shift', 'Tab'],  desc: 'Предыдущий тип блока' },
      { keys: ['Enter'],         desc: 'Новая строка; тип определяется автоматически по контексту' },
      { keys: ['Ctrl', 'B'],     desc: 'Жирный текст' },
      { keys: ['Ctrl', 'I'],     desc: 'Курсив' },
      { keys: ['Ctrl', 'U'],     desc: 'Подчёркнутый текст' },
    ],
  },
  {
    group: 'Навигация',
    items: [
      { keys: ['Ctrl', 'Home'],  desc: 'Перейти в начало документа' },
      { keys: ['Ctrl', 'End'],   desc: 'Перейти в конец документа' },
      { keys: ['↑', '↓'],        desc: 'Перемещение по строкам' },
      { keys: ['←', '→'],        desc: 'Перемещение по символам' },
      { keys: ['Ctrl', '←'],     desc: 'На слово назад' },
      { keys: ['Ctrl', '→'],     desc: 'На слово вперёд' },
    ],
  },
  {
    group: 'Поиск и замена',
    items: [
      { keys: ['Ctrl', 'F'],     desc: 'Открыть поиск по сценарию' },
      { keys: ['Enter'],         desc: 'Следующее совпадение (в режиме поиска)' },
      { keys: ['Shift', 'Enter'],desc: 'Предыдущее совпадение (в режиме поиска)' },
      { keys: ['Escape'],        desc: 'Закрыть поиск / сбросить выделение' },
    ],
  },
  {
    group: 'Split Screen — два окна редактора',
    color: '#a78bfa',
    items: [
      { keys: ['⊞⊞'],              desc: 'Кнопка Split Screen в шапке (иконка двух колонок)', note: 'вход' },
      { keys: ['клик панели'],  desc: 'Сделать панель активной (синяя полоска сверху)' },
      { keys: ['клик сцены'],   desc: 'Переход к сцене — идёт в активную панель' },
      { keys: ['тяни divider'],  desc: 'Изменить ширину панелей (25–75%)' },
      { keys: ['⊞⊞'],              desc: 'Выключить Split Screen', note: 'выход' },
    ],
  },
  {
    group: 'Focus Mode — полноэкранный режим',
    color: '#10b981',
    items: [
      { keys: ['⊞'],               desc: 'Кнопка в шапке редактора (иконка развернуть)', note: 'вход' },
      { keys: ['Escape'],          desc: 'Выйти из Focus Mode (если поиск закрыт)' },
      { keys: ['↑ мышь'],         desc: 'Навести мышь к верху экрана — появится плашка выхода' },
    ],
  },
  {
    group: 'Multi-cursor — одновременное редактирование',
    color: '#2196F3',
    items: [
      { keys: ['Ctrl', 'D'],       desc: 'Выделить слово под курсором', note: '1-е нажатие' },
      { keys: ['Ctrl', 'D'],       desc: 'Добавить следующее совпадение того же слова', note: 'повторно' },
      { keys: ['Escape'],          desc: 'Выйти из multi-cursor, вернуть обычный курсор' },
      { keys: ['←', '→', '↑', '↓'], desc: 'Сбросить multi-cursor и переместить курсор' },
      { keys: ['Любой символ'],    desc: 'Ввод текста сразу во всех выделенных местах' },
      { keys: ['Backspace'],       desc: 'Удалить символ слева во всех выделениях' },
      { keys: ['Delete'],          desc: 'Удалить символ справа во всех выделениях' },
      { keys: ['Ctrl', 'Z'],       desc: 'Отменить все изменения multi-cursor одним шагом' },
    ],
  },
  {
    group: 'SmartType — автодополнение',
    items: [
      { keys: ['↑', '↓'],          desc: 'Навигация по подсказкам' },
      { keys: ['Enter'],            desc: 'Принять выделенную подсказку' },
      { keys: ['Escape'],           desc: 'Закрыть список подсказок' },
    ],
  },
]

const TIPS: { title: string; body: string; tag?: string }[] = [
  {
    tag: 'Автоматика',
    title: 'Автоопределение типа блока',
    body: 'Редактор сам распознаёт тип блока по мере набора. Строка, начинающаяся с «ИНТ.», «ЭКСТ.» и т.д., автоматически становится шапкой сцены. Имя заглавными буквами (без точек и запятых) превращается в блок «Персонаж». Строка после «Персонажа» — автоматически «Диалог».',
  },
  {
    tag: 'Автоматика',
    title: 'Автокапс и автонумерация',
    body: 'Шапка сцены и имя персонажа всегда переводятся в верхний регистр автоматически — не нужно держать Caps Lock. Шапки сцен нумеруются автоматически: введите «ИНТ.» — редактор добавит «1.» сам. Для сериала добавляется номер серии: «1-1. ИНТ.».',
  },
  {
    tag: 'Блоки',
    title: 'Как переключить тип блока вручную',
    body: 'Нажмите Tab для перебора типов по кругу: Шапка → Действие → Персонаж → Диалог → Ремарка → Переход → обратно. Shift+Tab — в обратную сторону. Если нужно зафиксировать тип — нажмите иконку 🔒 замка в шапке редактора.',
  },
  {
    tag: 'Блоки',
    title: 'Состав сцены (Cast) — автодобавление',
    body: 'Когда вы вводите имя в блоке «Персонаж» и нажимаете Enter или Tab, имя автоматически добавляется в список состава (cast) текущей сцены. Это работает при вставке текста тоже — персонажи из диалогов вставленного фрагмента попадут в cast.',
  },
  {
    tag: 'Поиск',
    title: 'Поиск и замена',
    body: 'Ctrl+F открывает панель поиска. Нажмите стрелку «→» рядом с полем, чтобы включить режим замены. Можно фильтровать поиск по типам блоков (только в диалогах, только в шапках и т.д.). «Заменить все» работает за одну транзакцию — Ctrl+Z отменит всё сразу.',
  },
  {
    tag: 'Split Screen',
    title: 'Split Screen — два окна редактора',
    body: 'Нажмите кнопку двух колонок (⊞⊞) в шапке — редактор делится на две независимые панели. Кликните на панель — она становится активной (синяя полоска сверху). Щелчок по сцене в навигаторе — переход в активную панель. Границу между панелями можно перетащить (25–75%). Удобно сравнивать сцены или писать параллельный монтаж.',
  },
  {
    tag: 'Focus Mode',
    title: 'Focus Mode — пишите без отвлечений',
    body: 'Нажмите иконку развернуть (⊞) в шапке редактора — браузер перейдёт в полноэкранный режим. Все панели и шапка скрываются, остаётся только текст, отцентрированный по экрану. Наведите мышь к верхнему краю экрана — появится плашка с названием сценария и кнопкой «Выйти». Выйти также можно клавишей Escape.',
  },
  {
    tag: 'Multi-cursor',
    title: 'Как использовать Multi-cursor',
    body: 'Поставьте курсор на слово → Ctrl+D: выделится слово. Ещё Ctrl+D — добавится следующее такое же в этом же типе блока. Продолжайте до нужного количества, затем печатайте — текст появится везде одновременно. Счётчик «N selections» в статусбаре показывает активные выделения. Escape — выход.',
  },
  {
    tag: 'Multi-cursor',
    title: 'Что отключается во время Multi-cursor',
    body: 'Пока активен multi-cursor, временно отключаются: автоопределение типа блока, SmartType подсказки и автодобавление персонажей в cast. Всё восстанавливается автоматически при выходе (Escape, клик мышью или стрелки).',
  },
  {
    tag: 'SmartType',
    title: 'SmartType — умное автодополнение',
    body: 'В блоке «Шапка сцены» SmartType предлагает: префиксы (ИНТ., ЭКСТ., ПАВ. и т.д.), локации и времена суток из уже написанного сценария. В блоке «Персонаж» — имена персонажей. Часто используемые варианты поднимаются выше. Выбор: стрелки + Enter.',
  },
  {
    tag: 'Хронометраж',
    title: 'Как рассчитывается хронометраж',
    body: 'Два режима: «По символам» — 1 страница ≈ 1500 символов; «Точный» — по реальному объёму страниц A4. Для каждого жанра задаётся коэффициент (экшн — быстрее, драма — медленнее). Настройки открываются кнопкой ⚙ в шапке редактора.',
  },
  {
    tag: 'Хронометраж',
    title: 'Жанровый коэффициент',
    body: 'По умолчанию «авто» — 1 минута на страницу. Для боевика поставьте 0.7–0.8 (страница читается быстрее). Для диалоговой драмы — 1.2–1.5. Настройка влияет на хронометраж всего сценария и каждой сцены отдельно.',
  },
  {
    tag: 'Навигация',
    title: 'Переход к нужной сцене',
    body: 'В правой панели (кнопка → в шапке) находится список всех сцен с хронометражом и составом. Кликните по сцене — редактор прокрутится к ней. Сцены можно перетаскивать для смены порядка (drag-and-drop).',
  },
  {
    tag: 'Вставка',
    title: 'Умная вставка текста',
    body: 'При вставке текста в формате сценария (с шапками «ИНТ.», именами, репликами) редактор автоматически определяет типы блоков. Персонажи из вставленных диалогов добавляются в состав сцены. Для HTML — вставляется только чистый текст.',
  },
  {
    tag: 'Фильтрация',
    title: 'Dialogue Isolation Mode — подсветка диалогов',
    body: 'Нажмите кнопку диалогов в шапке редактора → выберите персонажа. Его имя и все диалоги подсветятся янтарным цветом. Удобно сосредоточиться на репликах конкретного персонажа. Escape — выход из режима.',
  },
  {
    tag: 'Фильтрация',
    title: 'Character POV Filter — режим «глазами персонажа»',
    body: 'В списке персонажей нажмите кнопку 👁 (Eye) — скроются все сцены где выбранного персонажа нет в составе (cast). Удобно видеть только сцены с конкретным героем. Повторное нажатие — показать все сцены. POV и подсветка диалогов не работают одновременно.',
  },
]

const BLOCK_TYPES: { name: string; shortcut: string; example: string; auto: string; color: string }[] = [
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

function KeyBadge({ k }: { k: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: 5,
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 600,
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(99,102,241,0.3)',
        color: '#818cf8',
        whiteSpace: 'nowrap',
      }}
    >
      {k}
    </span>
  )
}

export default function HelpModal({ isDark, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('shortcuts')

  const bg         = isDark ? '#1e1e2e' : '#ffffff'
  const bgSecondary= isDark ? '#252535' : '#f8f9fc'
  const border     = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const textPrimary= isDark ? '#f1f5f9' : '#111827'
  const textMuted  = isDark ? '#9ca3af' : '#6b7280'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 14,
          width: 680,
          maxWidth: '95vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        {/* Шапка */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 0',
            borderBottom: `1px solid ${border}`,
            paddingBottom: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>Помощь</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: textMuted,
              padding: 4,
              borderRadius: 6,
              marginBottom: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Табы */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: `1px solid ${border}` }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? '#818cf8' : textMuted,
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #818cf8' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>

          {/* ── Горячие клавиши ── */}
          {activeTab === 'shortcuts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {SHORTCUTS.map(group => (
                <div key={group.group}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted, marginBottom: 10 }}>
                    {group.group}
                  </div>
                  <div
                    style={{
                      background: bgSecondary,
                      borderRadius: 10,
                      border: `1px solid ${border}`,
                      overflow: 'hidden',
                    }}
                  >
                    {group.items.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          borderBottom: i < group.items.length - 1 ? `1px solid ${border}` : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          <span style={{ fontSize: 13, color: textPrimary }}>{item.desc}</span>
                          {item.note && (
                            <span style={{ fontSize: 10, color: group.color || textMuted, background: group.color ? `${group.color}22` : 'transparent', border: group.color ? `1px solid ${group.color}55` : 'none', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{item.note}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginLeft: 16 }}>
                          {item.keys.map((k, ki) => (
                            <span key={ki} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <KeyBadge k={k} />
                              {ki < item.keys.length - 1 && <span style={{ fontSize: 10, color: textMuted }}>+</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Подсказки ── */}
          {activeTab === 'tips' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TIPS.map((tip, i) => (
                <div
                  key={i}
                  style={{
                    background: bgSecondary,
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    padding: '13px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {tip.tag && (
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#818cf8', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>{tip.tag}</span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{tip.title}</span>
                  </div>
                  <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.65 }}>{tip.body}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Форматирование ── */}
          {activeTab === 'formatting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: textMuted, lineHeight: 1.6, margin: 0 }}>
                Каждый абзац — отдельный тип блока. Переключайте клавишей <KeyBadge k="Tab" /> или <KeyBadge k="Shift+Tab" />. Большинство типов определяется автоматически.
              </p>
              <div
                style={{
                  background: bgSecondary,
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  overflow: 'hidden',
                }}
              >
                {/* Заголовок таблицы */}
                <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 1fr', gap: 0, padding: '7px 14px', borderBottom: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted }}>Тип блока</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted }}>Tab</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted }}>Пример</span>
                </div>
                {BLOCK_TYPES.map((bt, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 60px 1fr',
                      gap: 0,
                      padding: '10px 14px',
                      borderBottom: i < BLOCK_TYPES.length - 1 ? `1px solid ${border}` : 'none',
                      alignItems: 'start',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: bt.color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{bt.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: textMuted, fontFamily: 'ui-monospace, monospace' }}>{bt.shortcut}</span>
                    <div>
                      <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: bt.color, marginBottom: 3 }}>{bt.example}</div>
                      <div style={{ fontSize: 11, color: textMuted, lineHeight: 1.5 }}>{bt.auto}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: textMuted, lineHeight: 1.6 }}>
                <strong style={{ color: textPrimary }}>Замок формата (🔒)</strong> — кнопка в шапке. Когда активен, Tab не меняет тип блока, автоопределение отключено. Удобно при ручном форматировании.
              </div>
            </div>
          )}

          {/* ── О программе ── */}
          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: bgSecondary,
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: textPrimary }}>KinoPlan</div>
                <div style={{ fontSize: 13, color: textMuted }}>Редактор сценариев с автоформатированием и хронометражом</div>
                <div style={{ fontSize: 12, color: textMuted, marginTop: 4 }}>
                  <span style={{ color: textPrimary, fontWeight: 600 }}>Версия:</span> 0.1.0-beta
                </div>
              </div>

              {[
                {
                  section: 'Редактор',
                  items: [
                    { done: true,  text: 'Tiptap/ProseMirror редактор с кастомными типами блоков' },
                    { done: true,  text: 'Автоопределение типов блоков при наборе (Tab, Enter)' },
                    { done: true,  text: 'Автокапс шапок сцен и имён персонажей' },
                    { done: true,  text: 'Автонумерация сцен (фильм и сериал)' },
                    { done: true,  text: 'Замок формата — фиксация типа блока' },
                    { done: true,  text: 'Drag-and-drop перестановка сцен' },
                    { done: true,  text: 'Авто-добавление персонажей в состав сцены (cast)' },
                    { done: true,  text: 'Умная вставка: автораспознавание screenplay-текста' },
                  ],
                },
                {
                  section: 'Поиск и Multi-cursor',
                  items: [
                    { done: true,  text: 'Поиск по всему сценарию с подсветкой (Ctrl+F)' },
                    { done: true,  text: 'Замена текста: текущее совпадение или все сразу' },
                    { done: true,  text: 'Фильтрация поиска по типам блоков' },
                    { done: true,  text: 'Дебаунс поиска для больших документов (150 мс)' },
                    { done: true,  text: 'Multi-cursor редактирование (Ctrl+D) — до 50 мест' },
                    { done: true,  text: 'Ввод/удаление во всех выделениях одной транзакцией' },
                    { done: true,  text: 'Визуальная подсветка multi-cursor + счётчик в статусбаре' },
                  ],
                },
                {
                  section: 'SmartType и подсказки',
                  items: [
                    { done: true,  text: 'SmartType: автодополнение в шапке (ИНТ., локации, время)' },
                    { done: true,  text: 'SmartType: автодополнение имён персонажей' },
                    { done: true,  text: 'Учёт частоты использования — часто применяемое выше' },
                  ],
                },
                {
                  section: 'Хронометраж',
                  items: [
                    { done: true,  text: 'Расчёт страниц по символам или точный (A4)' },
                    { done: true,  text: 'Жанровый коэффициент (0.5–2.0)' },
                    { done: true,  text: 'Хронометраж каждой сцены и сценария целиком' },
                    { done: true,  text: 'Правая панель: список сцен с хронометражом и составом' },
                    { done: true,  text: 'Навигация по сценам — клик → прокрутка к сцене' },
                  ],
                },
                {
                  section: 'Интерфейс',
                  items: [
                    { done: true,  text: 'Тёмная и светлая темы' },
                    { done: true,  text: 'Focus Mode — полноэкранный режим без отвлечений' },
                    { done: true,  text: 'Split Screen — два независимых окна редактора с перетаскиваемым divider' },
                    { done: true,  text: 'Автосохранение в localStorage' },
                    { done: true,  text: 'Экспорт в Word-совместимый HTML' },
                    { done: false, text: 'Экспорт в PDF (в разработке)' },
                    { done: false, text: 'Совместная работа / облако (в планах)' },
                  ],
                },
              ].map(({ section, items }) => (
                <div
                  key={section}
                  style={{
                    background: bgSecondary,
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted, marginBottom: 10 }}>{section}</div>
                  {items.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0', fontSize: 13, color: f.done ? textPrimary : textMuted }}>
                      <span style={{ color: f.done ? '#10b981' : isDark ? '#374151' : '#d1d5db', fontSize: 14, flexShrink: 0, marginTop: 1 }}>{f.done ? '✓' : '○'}</span>
                      {f.text}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
