import './test-traffic';
import { chromium } from '@playwright/test';
import {mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('review/round10/video',{recursive:true});
const b=await chromium.launch(), c=await b.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'review/round10/video',size:{width:1440,height:900}}}),p=await c.newPage();
const report:any={scroll:[],duration:'30 seconds minimum; closed office then complete five-guess file'};const start=Date.now();
try{
 await p.goto('http://127.0.0.1:5173/?r7-closed');await p.locator('.closed-office').waitFor();await p.waitForTimeout(10000);
 await p.goto('http://127.0.0.1:5173/?r6');await p.locator('#answer').waitFor();await p.waitForTimeout(2000);
 for(const a of ['Pangolin','Axolotl','Dog','Okapi','Quokka']){
  await p.locator('#answer').pressSequentially(a,{delay:120});await p.waitForTimeout(500);
  report.scroll.push({answer:a,y:await p.evaluate(()=>scrollY)});assert.equal(report.scroll.at(-1).y,0);
  await p.getByRole('button',{name:'CALL DIBS',exact:true}).click();await p.waitForTimeout(1300);
  if(['Axolotl','Okapi'].includes(a))await p.getByRole('button',{name:'Next dibs'}).click();
  else if(a!=='Quokka')await p.locator('#answer').fill('');
 }
 await p.locator('.day-certificate').waitFor();await p.waitForTimeout(Math.max(2000,31000-(Date.now()-start)));
 report.ms=Date.now()-start;await c.close();copyFileSync(await p.video()!.path(),'review/round10/closed-and-full-play-1440.webm');
}finally{await b.close();writeFileSync('review/round10/recording.json',JSON.stringify(report,null,2));}
