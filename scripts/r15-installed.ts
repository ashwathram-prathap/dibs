import './test-traffic';
import {chromium,webkit,expect} from '@playwright/test';
import {api,origin} from './r11-practice';
import {existsSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const opensAt=new Date(Date.now()+20*60000).toISOString();
assert.ok((await api('/admin/practice-schedule',{opensAt},undefined,true)).response.ok);
const result:any={opensAt,checks:[]};const browsers=[];const pages=[];
try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch();browsers.push(browser);
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
  await p.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>true});const native=window.matchMedia;window.matchMedia=(query:string)=>query==='(display-mode: standalone)'?{...native.call(window,query),matches:true} as MediaQueryList:native.call(window,query);});
  await p.goto(origin);await p.locator('.closed-office').waitFor();await p.locator('.header-settings > summary').click();await p.locator('#file-settings summary').click();await p.locator('#restore-key').fill('not-a-real-backup');
  const oldBuild=await p.evaluate(async()=> (await (await fetch('/version.json')).json()).buildId);await p.evaluate(()=>{(window as any).__oldPage=true;});pages.push({p,engine:engine.name(),oldBuild});
 }
 writeFileSync('.tmp/r15-installed-ready','ready');console.log('Standalone browsers ready on first practice deployment.');
 const deadline=Date.now()+15*60000;while(!existsSync('.tmp/r15-practice-deployed')){if(Date.now()>deadline)throw Error('Second deploy wait expired');await new Promise(r=>setTimeout(r,2000));}
 for(const {p,engine,oldBuild} of pages){
  const newBuild=await p.evaluate(async()=> (await (await fetch('/version.json',{cache:'no-cache'})).json()).buildId);assert.ok(newBuild>oldBuild);
  await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForTimeout(1800);assert.equal(await p.evaluate(()=>(window as any).__oldPage),true,'Typing must prevent reload');
  await p.locator('#restore-key').blur();const nav=p.waitForNavigation({waitUntil:'networkidle'});await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await nav;await p.locator('.closed-office').waitFor();assert.equal(await p.evaluate(()=>(window as any).__oldPage),undefined);
  result.checks.push({engine,oldBuild,newBuild,typingProtected:true,idleUpdated:true});await p.screenshot({path:`review/round15/installed-${engine}.png`,fullPage:true});
 }
 result.passed=true;
}catch(e){result.error=String(e);process.exitCode=1;}finally{for(const b of browsers)await b.close();writeFileSync('review/round15/installed-update.json',JSON.stringify(result,null,2));console.log(result);}
