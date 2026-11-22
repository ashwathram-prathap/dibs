import {chromium,webkit,expect} from '@playwright/test';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {GAME_DESCRIPTION,GAME_EXPLANATION,LIMIT_EXPLANATION} from '../shared/copy';
const checks:any[]=[];
async function rollback(){
 const ids=JSON.parse(readFileSync('review/round12/rollback.json','utf8'));
 const auth=spawnSync('./node_modules/.bin/wrangler',['auth','token'],{encoding:'utf8'});
 if(auth.status)throw Error('Rollback authentication unavailable');
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/pages/projects/dibs/deployments/${ids.pages}/rollback`,{method:'POST',headers:{authorization:'Bearer '+auth.stdout.trim()}});
 const result:any=await r.json();
 const worker=spawnSync('./node_modules/.bin/wrangler',['rollback',ids.workerVersion,'-c','worker/wrangler.jsonc','--yes','--message','R12 production smoke failed'],{encoding:'utf8'});
 appendFileSync('.tmp/r12/rollback.log',worker.stdout+worker.stderr);
 writeFileSync('review/round12/rollback-result.json',JSON.stringify({pages:r.ok&&result.success,worker:worker.status===0,at:new Date().toISOString()},null,2));
 assert.ok(r.ok&&result.success&&worker.status===0,'Rollback needs attention');
}
try{
 const today=await(await fetch('https://dibs.here/api/today')).json() as any;
 assert.equal(today.category,null);assert.equal(today.nextDrop,'2026-11-24T02:00:00.000Z');
 for(const engine of [chromium,webkit]){
 const b=await engine.launch();try{
 for(const width of [390,1440])for(const colorScheme of ['light','dark'] as const){
  const c=await b.newContext({viewport:{width,height:width===390?844:900},colorScheme,timezoneId:'America/Toronto'});const p=await c.newPage();const errors:string[]=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto('https://dibs.here');await p.locator('.closed-office').waitFor();
  await expect(p.locator('.game-explanation')).toContainText(GAME_EXPLANATION);await expect(p.locator('.game-explanation')).toContainText(LIMIT_EXPLANATION);
  await expect(p.locator('.closed-office h1')).toContainText('Monday at 9:00 PM');await expect(p.locator('.opening-zone')).toContainText('9:00 PM ET');
  await expect(p.locator('meta[name=description]')).toHaveAttribute('content',GAME_DESCRIPTION);
  await p.locator('.reminder-button').click();await expect(p.getByRole('link',{name:'Google Calendar'})).toBeVisible();await expect(p.getByRole('link',{name:'Outlook',exact:true})).toBeVisible();await p.locator('.reminder-button').click();
  const initial=await p.locator('html').getAttribute('data-theme');await p.locator('.theme-toggle').click();await expect(p.locator('html')).toHaveAttribute('data-theme',initial==='light'?'dark':'light');await p.locator('.theme-toggle').click();
  assert.equal(await p.locator('#answer').count(),0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:`review/round12/production-${engine.name()}-${width}-${colorScheme}.png`,fullPage:true});assert.deepEqual(errors,[]);
  checks.push({browser:engine.name(),width,colorScheme,passed:true,consoleErrors:errors});await c.close();
 }
 }finally{await b.close();}}
 writeFileSync('review/round12/production-smoke.json',JSON.stringify({passed:true,at:new Date().toISOString(),nextDrop:today.nextDrop,checks},null,2));console.log('Production smoke passed: closed, Monday 9 PM ET, rules, reminders, dark mode, no console errors.');
}catch(e){writeFileSync('review/round12/production-smoke.json',JSON.stringify({passed:false,checks,error:String(e)},null,2));if(process.argv.includes('--rollback-on-failure'))await rollback();throw e;}
