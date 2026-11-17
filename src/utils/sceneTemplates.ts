// T-143: встроенные шаблоны сцен — заготовки «шапка + скелет блоков».
// Номер в шапке («1.») при вставке заменяется литерным относительно текущей сцены.

export interface SceneTemplate {
  name: string
  html: string
}

const header = (type: string) =>
  `<div data-type="scene-header">1. ${type}. ЛОКАЦИЯ — ДЕНЬ</div>`
const action = (t: string) => `<div data-type="scene-action">${t}</div>`
const cast = '<div data-type="scene-cast">ИМЯ</div>'
const ch = (n: string) => `<div data-type="scene-character">${n}</div>`
const dlg = (t: string) => `<div data-type="scene-dialog">${t}</div>`
const par = '<div data-type="scene-parenthetical">(ремарка)</div>'

export const BUILTIN_SCENE_TEMPLATES: SceneTemplate[] = [
  {
    name: 'Диалог в помещении',
    html: header('ИНТ') + cast + action('Описание места и настроения сцены.') +
      ch('ИМЯ') + dlg('Реплика.') + ch('ИМЯ 2') + par + dlg('Ответ.'),
  },
  {
    name: 'Экшн на улице',
    html: header('ЭКСТ') + cast +
      action('Динамичное действие: кто, что, куда. Короткие фразы.') +
      action('Кульминация движения.') + ch('ИМЯ') + dlg('Короткая реплика.'),
  },
  {
    name: 'Флешбек',
    html: '<div data-type="scene-header">1. ИНТ. ЛОКАЦИЯ — ДЕНЬ (ФЛЕШБЕК)</div>' +
      cast + action('Событие из прошлого героя.') + ch('ИМЯ') + dlg('Реплика из прошлого.'),
  },
  {
    name: 'Телефонный разговор',
    html: header('ИНТ') + cast +
      action('Герой снимает трубку.') +
      ch('ИМЯ') + '<div data-type="scene-parenthetical">(в телефон)</div>' + dlg('Алло?') +
      ch('ГОЛОС') + '<div data-type="scene-parenthetical">(з/к)</div>' + dlg('Ответ из трубки.'),
  },
  {
    name: 'Монтаж',
    html: '<div data-type="scene-header">1. МОНТАЖ — РАЗНОЕ</div>' +
      action('— первый кадр монтажа.') +
      action('— второй кадр монтажа.') +
      action('— третий кадр монтажа.'),
  },
]
