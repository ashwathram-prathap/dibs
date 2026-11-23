import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const root=process.cwd();
for(const phase of ['before','after']) {
 const result=await build({stdin:{contents:phase==='before'?execFileSync('git',['show','r16-done:src/share.ts'],{encoding:'utf8'}):`export * from './share';`,resolveDir:root+'/src',sourcefile:'export-proof.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser'});
 writeFileSync(`.tmp/e2e-dist/r17-${phase}-exports.js`,result.outputFiles[0].text);
}
mkdirSync('review/round17/certificate',{recursive:true});
const browser=await chromium.launch();const results=[];
try {
 for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:theme as any});await page.goto('http://127.0.0.1:5199/certificate/fixture-1?r17=closed');await page.locator('.certificate').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const phase of ['before','after'])for(const summary of [false,true])for(const story of [false,true]) {
   const result=await page.evaluate(async({phase,summary,story,theme})=>{
    document.documentElement.dataset.theme=theme;
    const exports=await import(`/r17-${phase}-exports.js`);
    const claim={id:'fixture-1',category_id:'fixture-animals',category_slug:'animals',category_name:'Animals',category_date:'2026-11-23',display:'Pangolin',claim_no:1,created_at:'2026-11-24T02:01:00Z',obscurity:4,handle:'Rust Finch #12',percentile:.94,points:95,bonus:0,golden:false,total_registrable:2400,revealed:true};
    const category={id:'fixture-animals',date:claim.category_date,name:'Animals',slug:'animals',total_registrable:2400,drop_at:'2026-11-24T02:00:00Z'};
    const file={category_id:category.id,claims:[claim],dibs:1,strikes:0,events:[{kind:'dibs',at:claim.created_at,display:claim.display,claimId:claim.id,points:95}],closed:true,completedAt:claim.created_at,handle:claim.handle,points:95,rank:1,players:1,streak:1,revealed:true};
    const image=summary?await exports.exportSummary(file,category,story):await exports.exportCertificate(claim,story);
    const bytes=new Uint8Array(await image.arrayBuffer());let text='';for(const b of bytes)text+=String.fromCharCode(b);
    return {bytes:image.size,type:image.type,base64:btoa(text)};
   },{phase,summary,story,theme});
   const name=`${phase}-${theme}-${summary?'summary':'certificate'}-${story?'story':'feed'}`;
   writeFileSync(`review/round17/certificate/${name}.${result.type==='image/jpeg'?'jpg':'png'}`,Buffer.from(result.base64,'base64'));
   results.push({name,bytes:result.bytes,type:result.type});
  }
  await page.close();
 }
}finally{await browser.close();}
writeFileSync('review/round17/export-sizes.json',JSON.stringify(results,null,2));console.log(results);
