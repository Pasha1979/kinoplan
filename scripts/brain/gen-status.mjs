#!/usr/bin/env node
import {execSync} from 'child_process';
import {writeFileSync,readdirSync,readFileSync,statSync} from 'fs';
import {join} from 'path';
const sh=c=>{try{return execSync(c,{encoding:'utf8'}).trim()}catch{return''}};
const log=sh('git log --oneline -15'),branch=sh('git rev-parse --abbrev-ref HEAD'),
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
const date=new Date().toISOString().slice(0,10);
writeFileSync('_ai_workspace/v4/02_СТАТУС.md',`# 02 · СТАТУС (автогенерируемый — НЕ редактировать руками)
> Сгенерировано scripts/brain/gen-status.mjs · ${date}

## Git
- Ветка: \`${branch}\` · незакоммиченных файлов: ${dirty}
\`\`\`
${log}
\`\`\`

## Заглушки в коде (${stubs.length} файлов)
${stubs.map(s=>`- \`${s}\``).join('\n')||'— нет'}

## TODO/FIXME в коде (${todos.length})
${todos.map(s=>`- \`${s}\``).join('\n')||'— нет'}

## Готовность по модулям
См. v4/01_ПЛАН.md · реестр заглушек: _extracted/tasks.md T-33
`);
console.log(`✅ 02_СТАТУС: ветка ${branch}, заглушек ${stubs.length}, TODO ${todos.length}`);
