import {readFileSync,writeFileSync} from 'node:fs';
const base='https://practice.dibs-7hz.pages.dev';const token=readFileSync('.dev.vars.staging','utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
const api=async(path:string,body:any)=>{const r=await fetch(base+'/api'+path,{method:'POST',headers:{origin:base,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json();if(!r.ok)throw Error(r.status+': '+d.message);return d;};
await api('/admin/practice-reset',{});
const c=JSON.parse(readFileSync('categories/animals.json','utf8'));const manifest=JSON.parse(readFileSync('public/catalog/animals/manifest.json','utf8'));const coverage=JSON.parse(readFileSync('review/coverage/results.json','utf8')).find((r:any)=>r.slug==='animals');
await api('/admin/static-catalog',{id:'practice',slug:'animals',name:'Animals',manifest,coverage});
const words=readFileSync('review/coverage/animals.txt','utf8').trim().split('\n');const rows:any[]=[];
for(let i=0;i<words.length;i+=20){const d=await api('/admin/check-answers',{answers:words.slice(i,i+20)});rows.push(...d.rows);}
const warm:any[]=[];for(let i=0;i<100;i+=20)warm.push(...(await api('/admin/check-answers',{answers:words.slice(0,20)})).rows);
const p95=(r:any[])=>r.map(x=>x.ms).sort((a,b)=>a-b)[Math.floor(r.length*.95)];
const report={date:new Date().toISOString(),catalog:manifest,entries:c.answers.length,obvious:rows.length,accepted:rows.filter(r=>r.found).length,missing:rows.filter(r=>!r.found),lookupColdP95:p95(rows),lookupWarmP95:p95(warm),rows};writeFileSync('review/round8/practice-catalog-check.json',JSON.stringify(report,null,2));console.log({accepted:report.accepted,obvious:report.obvious,cold:report.lookupColdP95,warm:report.lookupWarmP95});if(report.missing.length)throw Error('Live obvious coverage failed');
