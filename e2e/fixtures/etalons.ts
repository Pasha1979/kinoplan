/**
 * T-92: пять эталонных сценариев для сверки пагинации с Word.
 * Формат — HTML редактора (data-type блоки), как сохраняется в контенте.
 * Из одного источника генерируется .doc для замера в Word и вход для
 * unit-теста пагинации (замер пользователя → ожидаемые значения ниже).
 */

const h = (type: string, text: string) => `<div data-type="${type}">${text}</div>`
const header = (text: string) => h('scene-header', text)
const action = (text: string) => h('scene-action', text)
const character = (text: string) => h('scene-character', text)
const dialog = (text: string) => h('scene-dialog', text)
const parenthetical = (text: string) => h('scene-parenthetical', text)
const transition = (text: string) => h('scene-transition', text)

const ACTION_1L = 'Герой идёт по комнате, останавливается у окна и смотрит на двор.'
const ACTION_2L = 'Герой идёт по комнате, останавливается у окна, смотрит на двор и вынимает из кармана старую фотографию.'

export interface Etalon {
  id: string
  title: string
  html: string
  /** Замер Word через COM (13.11.2026): страниц и 0-based индексы блоков,
   *  с которых начинается новая страница. Экспорт: Courier New 12pt,
   *  line-height 18pt, @page A4 2/2/2/3cm — та же геометрия, что у модели. */
  word: { pages: number; breakStartBlocks: number[] }
}

/** Текст для вставки в редактор (блоки через пустую строку) */
export const etalonText = (e: Etalon): string =>
  e.html
    .replace(/<div[^>]*>/g, '')
    .replace(/<\/div>/g, '\n\n')
    .trim()

/** 1. Короткие сцены — несколько маленьких сцен подряд */
const etalon1: Etalon = {
  id: 'short-scenes',
  title: 'Эталон 1 — короткие сцены',
  word: { pages: 1, breakStartBlocks: [] },
  html: [
    header('1. ИНТ. КВАРТИРА - ДЕНЬ'),
    action('ИВАН входит в прихожую, вешает пальто.'),
    action(`${ACTION_1L} Останавливается у зеркала.`),
    action('Слышит шум в соседней комнате.'),
    header('2. ИНТ. КУХНЯ - ДЕНЬ'),
    action('МАРЬЯ моет посуду, не оборачиваясь.'),
    action('На столе остывший чай и раскрытая тетрадь.'),
    header('3. ЭКСТ. ДВОР - ВЕЧЕР'),
    action('ИВАН выходит из подъезда, зажигает фонарь.'),
    action(`${ACTION_1L} Уходит в темноту.`),
  ].join(''),
}

/** 2. Длинная сцена на 2+ страницы */
const etalon2: Etalon = {
  id: 'long-scene',
  title: 'Эталон 2 — длинная сцена (2+ стр.)',
  word: { pages: 6, breakStartBlocks: [13, 26, 39, 52, 65] },
  html:
    header('1. ИНТ. ЗАВОДСКОЙ ЦЕХ - НОЧЬ') +
    Array.from({ length: 70 }, (_, i) =>
      action(`${ACTION_2L} Проход ${i + 1}.`)
    ).join(''),
}

/** 3. Диалоговый — много связок персонаж/з-к/реплика */
const etalon3: Etalon = {
  id: 'dialogue',
  title: 'Эталон 3 — диалоговый',
  word: { pages: 2, breakStartBlocks: [21] },
  html: [
    header('1. ИНТ. КАФЕ - ДЕНЬ'),
    action('За столиком ИВАН и МАРЬЯ. На улице дождь.'),
    ...Array.from({ length: 12 }, (_, i) => [
      character(i % 2 === 0 ? 'ИВАН' : 'МАРЬЯ'),
      ...(i % 3 === 0 ? [parenthetical('(тихо)')] : []),
      dialog(
        i % 2 === 0
          ? `Ты всё равно не понимаешь, о чём я говорю. Реплика номер ${i + 1}.`
          : `Понимаю, и поэтому молчу. Ответ номер ${i + 1}.`
      ),
    ]).flat(),
  ].join(''),
}

/** 4. Экшен-описательный — плотные абзацы прозы */
const ACTION_PARA =
  'Герой пересекает пустой склад, шаги гулко отдаются под сводами. ' +
  'Он подходит к окну, вытирает запотевшее стекло рукавом и всматривается в темноту двора. ' +
  'Где-то за воротами взвывает сирена, он замирает, прислушивается, затем продолжает путь вдоль стеллажей.'

const etalon4: Etalon = {
  id: 'action-prose',
  title: 'Эталон 4 — экшен-описательный',
  word: { pages: 2, breakStartBlocks: [7] },
  html: [
    header('1. ИНТ. СКЛАД - НОЧЬ'),
    action(ACTION_PARA),
    action(ACTION_PARA),
    action(ACTION_PARA),
    action(ACTION_PARA),
    header('2. ЭКСТ. ДВОР СКЛАДА - НОЧЬ'),
    action(ACTION_PARA),
    action(ACTION_PARA),
    action(ACTION_PARA),
  ].join(''),
}

/** 5. Смешанный — все типы блоков + переходы (титульный лист добавляется при печати) */
const etalon5: Etalon = {
  id: 'mixed',
  title: 'Эталон 5 — смешанный с переходами',
  word: { pages: 1, breakStartBlocks: [] },
  html: [
    header('1. ИНТ. КВАРТИРА - УТРО'),
    action('ИВАН просыпается от звонка будильника.'),
    character('ИВАН'),
    dialog('Ещё пять минут...'),
    action('Он встаёт и идёт на кухню.'),
    transition('МОНТАЖ:'),
    header('2. ЭКСТ. УЛИЦА - ДЕНЬ'),
    action('ИВАН бежит за отъезжающим автобусом.'),
    character('ИВАН'),
    parenthetical('(кричит)'),
    dialog('Подождите!'),
    transition('СМЕНА ПЛАНА:'),
    header('3. ИНТ. ОФИС - ДЕНЬ'),
    action('ИВАН садится за стол, открывает ноутбук.'),
    character('БОСС'),
    dialog('Ты опять опоздал.'),
    action(ACTION_PARA),
  ].join(''),
}

export const ETALONS: Etalon[] = [etalon1, etalon2, etalon3, etalon4, etalon5]
