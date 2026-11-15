#!/usr/bin/env node
// gen-handoff: SESSION_HANDOFF.md — «где я остановился» после паузы (автоген, ≤~700 симв)
import {execSync} from 'child_process';
import {readFileSync,writeFileSync} from 'fs';
const sh=c=>{try{return execSync(c,{encoding:'utf8'}).trim()}catch{return''}};
const branch=sh('git rev-parse --abbrev-ref HEAD'),last=sh('git log --oneline -1'),
recent=sh('git log --oneline -4').split('\n').filter(Boolean).map(c=>c.slice(0,60));
const EX='_ai_workspace/_extracted';
const rows=r=>readFileSync(`${EX}/${r}.md`,'utf8').split('\n').filter(l=>/^\|\s*[A-Z]-\d+/.test(l));
const cell=(l,i)=>(l.split('|').map(s=>s.trim())[i]||'');
const plan=readFileSync('_ai_workspace/v4/01_ПЛАН.md','utf8');
const sec=(plan.match(/## 🔴 СЕЙЧАС[\s\S]*?(?=\n## (?!🔴)|$)/)||[''])[0];
const next=[...sec.matchAll(/^\|\s*\d+\s*\|([^|]+)\|/gm)].map(m=>m[1].trim().slice(0,70)).slice(0,3);
const openQ=rows('questions').filter(l=>!cell(l,7).startsWith('✅')).map(l=>cell(l,1));
const lastD=rows('decisions').slice(-1).map(l=>cell(l,1)+' — '+cell(l,3).slice(0,60));
const date=new Date().toISOString().slice(0,10);
const md=`# HANDOFF (автоген) · ${date} · \`${branch}\` · ${last.slice(0,50)}

Сделано:
${recent.map(c=>'- '+c).join('\n')}

Дальше:
${next.map((n,i)=>`${i+1}. ${n}`).join('\n')||'— см. 01_ПЛАН'}

Ждут решения: ${openQ.join(', ')||'нет'} · Последнее решение: ${lastD[0]||'—'}
`;
writeFileSync('_ai_workspace/v4/SESSION_HANDOFF.md',md);
console.log(`✅ SESSION_HANDOFF: ${md.length} символов · ветка ${branch} · дальше ${next.length} · вопросов ${openQ.length}`);
