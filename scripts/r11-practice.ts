import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const config='worker/wrangler.staging.jsonc';
const vars=Object.fromEntries(readFileSync('.dev.vars.staging','utf8').split('\n').filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}));
const run=(args:string[],input?:string)=>{const r=spawnSync('./node_modules/.bin/wrangler',args,{input,encoding:'utf8',maxBuffer:16*1024*1024});appendFileSync('.tmp/r11/practice-ops.log',r.stdout+'\n'+r.stderr);if(r.status!==0)throw Error('Practice operation failed; see private log');};
export const origin='https://practice.dibs-7hz.pages.dev';
export async function api(path:string,body?:any,cookie?:string,admin=false){const r=await fetch(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),...(admin?{authorization:'Bearer '+vars.ADMIN_TOKEN}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {response:r,data:await r.json() as any};}
if(process.argv[1]?.endsWith('r11-practice.ts')){
 const command=process.argv[2];
 if(command==='test-keys'){
  run(['secret','put','TURNSTILE_SECRET','-c',config],'1x0000000000000000000000000000000AA\n');
  const topic=readFileSync('FIXES-R9.md','utf8').match(/using topic `([^`]+)`/)?.[1];if(!topic)throw Error('No rehearsal notification destination');
  run(['secret','put','NTFY_TOPIC','-c',config],topic+'\n');
  run(['deploy','-c',config,'--var','TURNSTILE_SITE_KEY:1x00000000000000000000AA','--define','DIBS_PRACTICE_TEST_MODE:true']);
  console.log('Official test verification installed on practice only.');
 }else if(command==='restore-real'){
  run(['secret','put','TURNSTILE_SECRET','-c',config],vars.TURNSTILE_SECRET+'\n');run(['deploy','-c',config]);console.log('Real practice verification restored.');
 }else if(command==='schedule'){
  const at=process.argv[3]==='tonight'?'2026-11-23T02:00:00.000Z':new Date(Date.now()+15*60000).toISOString();
  const reset=await api('/admin/practice-reset',{},undefined,true);if(!reset.response.ok)throw Error('Practice reset failed');
  const result=await api('/admin/practice-schedule',{opensAt:at},undefined,true);if(!result.response.ok)throw Error(JSON.stringify(result.data));
  writeFileSync('review/round11/'+(process.argv[3]==='tonight'?'public-rehearsal':'timed-rehearsal-schedule')+'.json',JSON.stringify({origin,opensAt:at},null,2));console.log('Practice opens '+at+' at '+origin);
 }else if(command==='status'){
  const boot=await api('/bootstrap'),live=await api('/admin/live',undefined,undefined,true);
  console.log(JSON.stringify({today:boot.data.today,usage:live.data.usage,limits:live.data.limits},null,2));
 }
}
