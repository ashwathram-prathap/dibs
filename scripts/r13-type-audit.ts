import {chromium,webkit} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const results=[];
for(const engine of [chromium,webkit]) {
 const b=await engine.launch();try {for(const width of [390,1440]) for(const colorScheme of ['light','dark'] as const) {
 const p=await b.newPage({viewport:{width,height:width===390?844:900},colorScheme});
 for(const path of ['/?r6','/?r7-closed','/about','/archive','/certificate/fixture-1']) {
  await p.goto('http://127.0.0.1:5176'+path);await p.locator('.loading').waitFor({state:'hidden'});await p.evaluate(()=>document.fonts.ready);
  const small=await p.locator('main p').evaluateAll((es,min)=>es.filter(e=>e.getBoundingClientRect().height>5 && parseFloat(getComputedStyle(e).fontSize)<min).map(e=>({text:e.textContent?.slice(0,80),font:getComputedStyle(e).fontSize})),width===390?18:19);
  assert.deepEqual(small,[],`${engine.name()} ${width} ${path}`);
  if(path==='/archive') await p.screenshot({path:`review/round13/archive-${engine===chromium?'':engine.name()+'-'}${width}-${colorScheme}-after.png`,fullPage:true});
  results.push({engine:engine.name(),width,colorScheme,path,minimum:width===390?18:19,passed:true});
 }
 await p.close();
 }}finally{await b.close();writeFileSync('review/round13/type-audit.json',JSON.stringify(results,null,2));}
}
console.log(results.length+' body-type checks passed');
