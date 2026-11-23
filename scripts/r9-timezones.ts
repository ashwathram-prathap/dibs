import './test-traffic';
import{chromium}from'@playwright/test';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const browser=await chromium.launch(),report:any[]=[];
try{for(const [zone,expected]of [['America/Vancouver','PT'],['Europe/London','GMT'],['Asia/Kolkata','GMT+5:30']]){
 const context=await browser.newContext({timezoneId:zone,viewport:{width:390,height:844}});const page=await context.newPage();
 for(const path of ['/','/?r7-closed','/certificate/fixture-1','/archive','/about','/admin/live','/missing']){
 await page.goto('http://127.0.0.1:5173'+path);await page.locator('.loading').waitFor({state:'hidden'});const label=await page.locator('.timezone-control').innerText();assert.ok(label.includes(expected),zone+':'+label);assert.ok(!(await page.locator('main').innerText()).match(/Toronto time|Eastern time|9 PM ET/));report.push({zone,path,passed:true});
 }
 await page.getByLabel('Timezone',{exact:true}).selectOption('America/Vancouver');await page.reload();assert.equal(await page.getByLabel('Timezone',{exact:true}).inputValue(),'America/Vancouver');await context.close();
}}finally{await browser.close();writeFileSync('review/round9/timezones.json',JSON.stringify(report,null,2));}
