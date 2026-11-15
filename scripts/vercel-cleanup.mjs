#!/usr/bin/env node
// T-131: чистка старых деплоев Vercel.
// По умолчанию: продакшен НЕ трогаем (точки отката), из preview оставляем последние 10.
// Флаги: --dry-run · --keep=N (preview) · --prod-keep=N (чистить и продакшен, оставить N последних)
// Использование: npm run vercel:cleanup · node scripts/vercel-cleanup.mjs --dry-run
import {readFileSync,existsSync} from 'fs';

const num=(name,def)=>{const a=process.argv.find(x=>x.startsWith(`--${name}=`));return a?+a.split('=')[1]:def};
const KEEP=num('keep',10), PROD_KEEP=num('prod-keep',null), DRY=process.argv.includes('--dry-run');

const env=existsSync('.env')?readFileSync('.env','utf8'):'';
const token=(env.match(/^VERCEL_TOKEN=(.+)$/m)||[])[1]?.trim();
if(!token){console.error('❌ VERCEL_TOKEN не найден в .env');process.exit(1)}
const {projectId,orgId}=JSON.parse(readFileSync('.vercel/project.json','utf8'));

const api=async(path,method='GET')=>{
 const r=await fetch(`https://api.vercel.com${path}${path.includes('?')?'&':'?'}teamId=${orgId}`,{
  method,headers:{Authorization:`Bearer ${token}`}});
 if(!r.ok)throw new Error(`${method} ${path} → ${r.status} ${await r.text()}`);
 return r.status===204?null:r.json();
};

// пагинация: тянем страницами по `until`, пока не кончатся (лимит безопасности — 50 страниц)
let all=[],until=null;
for(let i=0;i<50;i++){
 const q=`/v6/deployments?projectId=${projectId}&limit=100&state=READY,ERROR,CANCELED${until?`&until=${until}`:''}`;
 const {deployments}=await api(q);
 if(!deployments?.length)break;
 all.push(...deployments);
 const oldest=deployments[deployments.length-1];
 const c=oldest.created||oldest.createdAt;
 if(deployments.length<100||c===until)break;
 until=c-1;
}

const prod=all.filter(d=>d.target==='production').sort((a,b)=>(b.created||b.createdAt)-(a.created||a.createdAt));
const previews=all.filter(d=>d.target!=='production').sort((a,b)=>(b.created||b.createdAt)-(a.created||a.createdAt));
const toDelete=[...previews.slice(KEEP),...(PROD_KEEP!==null?prod.slice(PROD_KEEP):[])];
const show=d=>{
 const age=Math.round((Date.now()-(d.created||d.createdAt))/86400000);
 console.log(`  ${d.uid} · ${d.target||'preview'} · ${d.state} · ${age} дн. · ${(d.meta?.githubCommitMessage||'').slice(0,50)}`);
};

console.log(`Деплоев всего: ${all.length} (prod: ${prod.length}, preview: ${previews.length})`);
console.log(`Оставляем: ${PROD_KEEP!==null?`последние ${PROD_KEEP} продакшен`:'все продакшен (точки отката)'} + последние ${KEEP} preview`);
if(!toDelete.length){console.log('✅ Чистить нечего');process.exit(0)}
console.log(`${DRY?'[DRY-RUN] ':''}К удалению: ${toDelete.length}:`);
toDelete.slice(0,30).forEach(show);
if(toDelete.length>30)console.log(`  …и ещё ${toDelete.length-30}`);
if(DRY){console.log('DRY-RUN: ничего не удалено. Без --dry-run удалит реально.');process.exit(0)}

let ok=0,fail=0;
for(const d of toDelete){
 try{await api(`/v13/deployments/${d.uid}?force=1`,'DELETE');ok++}
 catch(e){fail++;console.log(`  ⚠️ ${d.uid}: ${e.message}`)}
}
console.log(`✅ Удалено ${ok}${fail?`, ошибок ${fail}`:''}`);
