import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {normalize} from '../worker/domain';
// A fixed seed makes each unbiased draw repeatable, with misses retained.
let state=8129;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
for(const slug of ['animals','birds','plants','cities']){
 const old=JSON.parse(execFileSync('git',['show',`r7-done:categories/${slug}.json`],{maxBuffer:20e6}).toString());
 const current=JSON.parse(readFileSync('categories/'+slug+'.json','utf8'));
 const ranked=old.answers.filter((a:any)=>a.pageviews?.days>0).sort((a:any,b:any)=>b.pageviews.total/b.pageviews.days-a.pageviews.total/a.pageviews.days);
 // Independent pre-R8 Wikidata-derived pool, middle 50% by measured readership.
 const pool=ranked.slice(Math.floor(ranked.length*.25),Math.floor(ranked.length*.75));const selected:any[]=[];
 while(selected.length<50&&pool.length){const i=Math.floor(random()*pool.length);selected.push(pool.splice(i,1)[0]);}
 const keys=new Set(current.answers.flatMap((a:any)=>[normalize(a.display),...a.aliases.map(normalize)]));
 writeFileSync(`review/coverage/${slug}-independent.json`,JSON.stringify({source:'Pre-R8 independent Wikidata candidate set; sources retained per entry',seed:8129,method:'Uniform draw without replacement from the middle half of measured readership; misses are not replaced.',answers:selected.map(a=>a.display),samples:selected.map(a=>({answer:a.display,source:a.source,pageviews:a.pageviews,present:keys.has(normalize(a.display))}))},null,2));
}
