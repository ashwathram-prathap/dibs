import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({args:['--enable-precise-memory-info']});
const results:any[]=[];
try {
 for(const [version,port] of [['r20',5254],['r21',5251]] as const) for(let trial=0;trial<3;trial++) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript({content:'globalThis.__name=(fn)=>fn;'});
  await page.goto(`http://127.0.0.1:${port}/?r19&r19c&r6&r21`);
  await page.locator('#answer').waitFor();await page.evaluate(()=>document.fonts.ready);
  const sampling=page.evaluate(async()=>{
   const heap=()=>Number((performance as any).memory?.usedJSHeapSize)||null;
   const before=heap(), gaps:number[]=[];let last=performance.now();const start=last;
   await new Promise<void>(resolve=>{const next=(now:number)=>{gaps.push(now-last);last=now;if(now-start>=2100)resolve();else requestAnimationFrame(next)};requestAnimationFrame(next)});
   const sorted=gaps.slice(1).sort((a,b)=>a-b);
   return {heapBefore:before,heapAfter:heap(),frames:sorted.length,p50GapMs:sorted[Math.floor(sorted.length*.5)],p95GapMs:sorted[Math.floor(sorted.length*.95)],maxGapMs:sorted.at(-1)};
  });
  await page.locator('#answer').fill('Okapi');await page.getByRole('button',{name:'CALL DIBS',exact:true}).click();
  results.push({version,trial,...await sampling});await page.close();
 }
}finally{await browser.close()}
writeFileSync('review/r21-flow/browser-cost.json',JSON.stringify({at:new Date().toISOString(),scope:'Local Chromium fixture diagnostic at 390x844; concurrent local browser validation was running. JS heap is the whole page, not Worker/DO memory; rAF gaps are not physical device frame guarantees. Three trials per build; no causal or hosted capacity claim.',results},null,2));
console.log(results);
