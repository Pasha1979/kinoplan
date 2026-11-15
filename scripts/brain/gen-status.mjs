#!/usr/bin/env node
import {execSync} from 'child_process';
import {writeFileSync,readdirSync,readFileSync,statSync} from 'fs';
import {join} from 'path';
const sh=c=>{try{return execSync(c,{encoding:'utf8'}).trim()}catch{return''}};
const log=sh('git log --oneline -5'),branch=sh('git rev-parse --abbrev-ref HEAD'),
dirty=sh('git status --porcelain').split('\n').filter(Boolean).length;
const stubs=[],todos=[];
const isStub=(t,f)=>{
 // файл — заглушка, только если плейсхолдер является его ОСНОВНЫМ контентом
 if(/<ComingSoonPage/.test(t)){
  // каждый «return» в файле возвращает ComingSoonPage → весь файл плейсхолдер
  const rets=(t.match(/return\s*\(/g)||[]).length;
  const soonRoots=(t.match(/return\s*\(\s*<ComingSoonPage/g)||[]).length;
  return soonRoots>0&&soonRoots===rets;
 }
 // иначе: малый файл, где маркер-заглушка — единственный контент
 return f.endsWith('.tsx')&&Buffer.byteLength(t)<4096&&/Функция в разработке|>Скоро</.test(t);
};
const norm=p=>p.replace(/\\/g,'/');
(function walk(d){for(const f of readdirSync(d)){const p=join(d,f);
 if(statSync(p).isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(f)){
  const t=readFileSync(p,'utf8');
  if(isStub(t,f))stubs.push(norm(p));
  for(const [i,l] of t.split('\n').entries())if(/TODO|FIXME|HACK/.test(l))todos.push(`${norm(p)}:${i+1}`)}}})('src');
// ── счётчики реестров ──
const EX='_ai_workspace/_extracted';
const rows=r=>readFileSync(`${EX}/${r}.md`,'utf8').split('\n').filter(l=>/^\|\s*[A-Z]-\d+/.test(l));
const cell=(l,i)=>l.split('|').map(s=>s.trim())[i]||'';
const tasks=rows('tasks');
const tStat=s=>s.startsWith('✅')?'done':s.startsWith('🔄')?'wip':s.startsWith('📅')?'plan':s.startsWith('⏸️')?'hold':'other';
const tc={done:0,wip:0,plan:0,hold:0,other:0};for(const l of tasks)tc[tStat(cell(l,7))]++;
const nIdeas=rows('ideas').length,nDec=rows('decisions').length;
const openQ=rows('questions').filter(l=>!cell(l,7).startsWith('✅'));
// ── СЕЙЧАС из плана (не встраиваем — check-boot считает её из 01_ПЛАН, дубль раздувает бюджет) ──
const date=new Date().toISOString().slice(0,10);
writeFileSync('_ai_workspace/v4/02_СТАТУС.md',`# 02 · СТАТУС (автогенерируемый — НЕ редактировать руками)
> Сгенерировано scripts/brain/gen-status.mjs · ${date}

## Реестры
- Задачи: ${tasks.length} — ✅ ${tc.done} · 🔄 ${tc.wip} · 📅 ${tc.plan} · ⏸️ ${tc.hold}${tc.other?` · прочие ${tc.other}`:''}
- Идеи: ${nIdeas} · Решения: ${nDec} · Открытые вопросы: ${openQ.length}

## СЕЙЧАС
→ см. 01_ПЛАН.md, раздел «🔴 СЕЙЧАС» (boot читает её там)

${openQ.length?`## Открытые вопросы\n${openQ.map(l=>`- **${cell(l,1).replace(/\s*\(.*\)/,'')}**: ${cell(l,3)}`).join('\n')}\n`:''}
## Git
- Ветка: \`${branch}\` · незакоммиченных файлов: ${dirty}
\`\`\`
${log}
\`\`\`

## Заглушки в коде
${stubs.length} файлов (ComingSoonPage-плейсхолдеры) · TODO/FIXME: ${todos.length}${todos.length?` — ${todos.map(s=>`\`${s}\``).join(', ')}`:''}

## Готовность по модулям
См. v4/01_ПЛАН.md · реестр заглушек: _extracted/tasks.md T-33
`);
console.log(`✅ 02_СТАТУС: ветка ${branch}, задач ${tasks.length} (✅${tc.done}/🔄${tc.wip}/📅${tc.plan}/⏸️${tc.hold}), вопросов ${openQ.length}, заглушек ${stubs.length}, TODO ${todos.length}`);
