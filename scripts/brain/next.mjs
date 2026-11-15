#!/usr/bin/env node
// brain:next — «что дальше»: топ-3 готовых задачи + открытые вопросы (по запросу, не в boot/гейте)
import {readFileSync} from 'fs';
const EX='_ai_workspace/_extracted';
const rows=r=>readFileSync(`${EX}/${r}.md`,'utf8').split('\n').filter(l=>/^\|\s*[A-Z]-\d+/.test(l));
const cell=(l,i)=>(l.split('|').map(s=>s.trim())[i]||'');
const pNum=p=>{const m=(p.match(/P(\d)/)||[])[1];return m?+m:9};
const ready=rows('tasks')
 .map(l=>({id:cell(l,1),name:cell(l,2),status:cell(l,7),prio:cell(l,8)}))
 .filter(t=>t.status.startsWith('📅')||t.status.startsWith('🔄'))
 .sort((a,b)=>pNum(a.prio)-pNum(b.prio)||a.id.localeCompare(b.id,undefined,{numeric:true}));
const openQ=rows('questions').filter(l=>!cell(l,7).startsWith('✅'))
 .map(l=>({id:cell(l,1),essence:cell(l,3)}));
console.log('🎯 ЧТО ДАЛЬШЕ — топ-3 готовых задачи\n');
if(!ready.length)console.log('  В плане пусто — всё сделано или ждёт новых задач.');
else ready.slice(0,3).forEach((t,i)=>{
 const s=t.status.startsWith('🔄')?'(в работе)':'';
 console.log(`  ${i+1}. ${t.id} ${s}[${t.prio||'—'}] ${t.name.slice(0,110)}${t.name.length>110?'…':''}`);
});
if(ready.length>3)console.log(`  … ещё ${ready.length-3} в очереди (📅/🔄 всего ${ready.length})`);
console.log('\n❓ Открытые вопросы (ждут твоего решения)');
if(!openQ.length)console.log('  Вопросов нет — реестр чист.');
else openQ.forEach(q=>console.log(`  · ${q.id}: ${q.essence}`));
console.log('\nКоманда по запросу: npm run brain:next');
