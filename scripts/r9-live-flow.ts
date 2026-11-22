import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='https://practice.dibs-7hz.pages.dev';
const token=readFileSync('.dev.vars.staging','utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
async function reset(){const r=await fetch(base+'/api/admin/practice-reset',{method:'POST',headers:{origin:base,authorization:'Bearer '+token,'content-type':'application/json'},body:'{}'});assert.equal(r.status,200);}
await reset();mkdirSync('review/round9/video',{recursive:true});
const browser=await chromium.launch();const report:any={checks:[],startedAt:new Date().toISOString()};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:'review/round9/video',size:{width:390,height:844}}});const page=await context.newPage();
 const verified=page.waitForResponse(r=>r.url().endsWith('/api/verify-session')&&r.ok(),{timeout:60000});await page.goto(base);await verified;
 const start=performance.now();
 const claim=async(answer:string)=>{await page.locator('#answer').fill(answer);const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/claim'&&[201,409].includes(r.status()),{timeout:60000});await page.getByRole('button',{name:'CALL DIBS'}).click();const r=await response;return{status:r.status(),data:await r.json()};};
 let wins=0;
 for(const answer of ['Cat','Okapi','Dog','Quokka','Pangolin']){
  assert.equal(await page.evaluate(()=>scrollY),0);const before=await page.getByRole('button',{name:'CALL DIBS'}).boundingBox();assert.ok(before!.y+before!.height<=520,'Play action fits above a 324px keyboard');
  const result=await claim(answer);assert.equal(result.status,['Cat','Dog'].includes(answer)?409:201);
  if(result.status===201){wins++;if(wins<3){await page.locator('.win-stamp').waitFor();await page.getByRole('button',{name:'Next dibs'}).click();}}
  else await page.locator('.strike-count').waitFor();
 }
 await page.locator('.day-certificate').waitFor();report.totalFileMs=performance.now()-start;report.checks.push('Three wins, two strikes, inline wins, direct Day Certificate; actions fit above keyboard');
 await page.screenshot({path:'review/round9/live-day-certificate.png',fullPage:true});
 const video=page.video()!;await context.close();copyFileSync(await video.path(),'review/round9/first-play.webm');
 await reset();
 const c2=await browser.newContext({viewport:{width:390,height:844}});const p2=await c2.newPage();const v2=p2.waitForResponse(r=>r.url().endsWith('/api/verify-session')&&r.ok(),{timeout:60000});await p2.goto(base);await v2;
 await reset();await p2.locator('#answer').fill('Okapi');const response=p2.waitForResponse(r=>r.url().endsWith('/api/claim')&&r.status()===201,{timeout:60000});await p2.getByRole('button',{name:'CALL DIBS'}).click();const data=await(await response).json();assert.equal(data.file.dibs,1);assert.equal(data.file.strikes,0);await p2.getByText('Practice was reset. You have a fresh file.').waitFor();assert.ok(!(await p2.locator('main').innerText()).includes('Cookies are required'));
 report.checks.push('Reset mid-session automatically retries with a fresh file and zero strikes');await c2.close();
}catch(e){report.error=String(e);throw e;}finally{await browser.close();await reset();writeFileSync('review/round9/live-flow.json',JSON.stringify(report,null,2));}
