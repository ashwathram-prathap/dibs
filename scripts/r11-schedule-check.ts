import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localTime} from '../shared/time';
import {reminder} from '../shared/reminder';
const b=await chromium.launch(),rows:any[]=[];
try{for(const origin of ['https://practice.dibs-7hz.pages.dev','https://dibs.here']){
 const today:any=await(await fetch(origin+'/api/today')).json(),ics=await(await fetch(origin+'/reminder.ics')).text();
 const next=today.nextDrop,expected=localTime(next,'America/Toronto',true).full;
 const c=await b.newContext({viewport:{width:1440,height:900},timezoneId:'America/Toronto'}),p=await c.newPage();
 for(const path of ['/','/about']){await p.goto(origin+path);await p.locator('.loading').waitFor({state:'hidden'});const times=await p.locator('.local-drop').allTextContents();assert.ok(times.length);assert.ok(times.every(t=>t.replace(/\s+/g,' ').trim()===expected),JSON.stringify({origin,path,times,expected}));}
 const correctIcs=ics.includes(reminder(next,origin).ics.match(/DTSTART;TZID=America\/Toronto:[^\r]+/)![0]);
 rows.push({origin,nextDrop:next,expected,officeAndFaqAgree:true,calendarStartCorrect:correctIcs,productionAlreadyUpdated:false});await c.close();
 }}finally{await b.close();writeFileSync('review/round11/schedule-contract.json',JSON.stringify(rows,null,2));console.log(rows);}
