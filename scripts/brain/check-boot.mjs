#!/usr/bin/env node
// check-boot: бюджет размера boot-набора (00_ВИДЕНИЕ + 02_СТАТУС + 04_ПРАВИЛА + «СЕЙЧАС» из 01_ПЛАН)
// бюджет: BOOT_BUDGET env или 8000 символов (≈ 2 страницы; текущий ~6478, запас ~23%)
import {readFileSync,existsSync} from 'fs';
const BUDGET=+(process.env.BOOT_BUDGET||8000);
const V4='_ai_workspace/v4';
const parts=[];
for(const f of ['SESSION_HANDOFF.md','CONTEXT_CHECKPOINT.md','00_ВИДЕНИЕ.md','TARGET_STATE.md','02_СТАТУС.md','04_ПРАВИЛА.md'])
 parts.push([f,existsSync(`${V4}/${f}`)?readFileSync(`${V4}/${f}`,'utf8').length:0]);
const plan=readFileSync(`${V4}/01_ПЛАН.md`,'utf8');
const m=plan.match(/## 🔴 СЕЙЧАС[\s\S]*?(?=\n## (?!🔴)|$)/);
parts.push(['01_ПЛАН.md «СЕЙЧАС»',(m?m[0]:'').length]);
const total=parts.reduce((s,[,n])=>s+n,0);
for(const [f,n] of parts)console.log(`  ${String(n).padStart(6)}  ${f}`);
console.log(`boot-набор: ${total} символов · бюджет: ${BUDGET}`);
if(total>BUDGET){console.log(`❌ check-boot: превышение на ${total-BUDGET} символов — boot раздут (правило: ≤2 страницы)`);process.exit(1)}
console.log(`✅ check-boot: в пределах бюджета (запас ${BUDGET-total})`);
