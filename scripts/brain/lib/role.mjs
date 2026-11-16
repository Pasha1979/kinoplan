// role (T-204, I-192, D-68): ролевая модель мозга — роль из профиля (brain.config.json → role).
// Суперадмин видит всё; остальные роли — фокус на своих модулях. Используется next/digest/boot.
import {readFileSync,existsSync} from 'fs';
import {join} from 'path';

// Роли по D-68. modules: null = полный доступ (суперадмин)
export const ROLES = {
  superadmin: {label:'Суперадмин',modules:null},
  scenarist: {label:'Сценарист',modules:['сценарий','текст','посерийник','разработка','синопсис','формат','титул','карточки','homepage','помощь','настройки','статистика']},
  director: {label:'Режиссёр',modules:['планирование','разбивка','вызывные','локации','кастинг','storyboards','сценарий','dashboard','собрания']},
  producer: {label:'Продюсер',modules:['dashboard','бюджет','статистика','отчёты','собрания','релиз','планирование']},
  second_ad: {label:'2-й режиссёр',modules:['планирование','вызывные','календарь','стрипборд','dood','расписание']},
  costumer: {label:'Костюмер',modules:['костюмы','continuity']},
  makeup: {label:'Гримёр',modules:['грим','continuity']},
  props: {label:'Реквизитор',modules:['реквизит','декорации']},
  transport: {label:'Транспорт',modules:['транспорт']},
  stunts: {label:'Каскадёры',modules:['каскадёры','трюки','пиротехника']},
  vfx: {label:'VFX',modules:['vfx','cg','шоты']},
};

export function getRole(root='.'){
  const p=join(root,'_ai_workspace','brain.config.json');
  if(!existsSync(p))return 'superadmin';
  try{const r=(JSON.parse(readFileSync(p,'utf8')).role||'superadmin');return ROLES[r]?r:'superadmin'}catch{return 'superadmin'}
}

export const roleLabel=r=>(ROLES[r]||ROLES.superadmin).label;

// Совпадает ли ячейка «Модуль» записи с фокусом роли
export function moduleMatches(moduleCell,role){
  const info=ROLES[role];
  if(!info||info.modules===null)return true; // суперадмин / неизвестная — всё
  const m=moduleCell.toLowerCase();
  return info.modules.some(k=>m.includes(k));
}

// Роли, чьи модули пересекаются с ячейкой (для brain:impact)
export function rolesForModule(moduleCell){
  return Object.keys(ROLES).filter(r=>ROLES[r].modules!==null&&moduleMatches(moduleCell,r));
}
