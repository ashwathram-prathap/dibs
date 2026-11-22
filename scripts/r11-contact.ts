import{chromium}from'@playwright/test';import{readFileSync}from'node:fs';
const b=await chromium.launch(),p=await b.newPage({viewport:{width:2100,height:900}});
for(const width of [390,1440,2560])for(const theme of ['light','dark']){
 let html='<style>body{margin:10px;font:16px monospace;background:#aaa}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.pair{background:#ddd;padding:10px}.images{display:flex;align-items:start;gap:8px}.images img{width:calc(50% - 4px)}h2{font-size:18px}</style><main>';
 for(const name of ['closed','play','mid-round','day','five-strikes','gold','certificate','archive','office','office-expanded','admin-live','calendar','stats','error']){
  html+=`<div class="pair"><h2>${name} · ${width}px · ${theme} (R7 → R11)</h2><div class="images">`;
  for(const phase of ['before','after'])html+=`<img src="data:image/png;base64,${readFileSync(`review/round11/vs-r7/${name}-${width}-${theme}-${phase}.png`).toString('base64')}">`;
  html+='</div></div>';
 }
 await p.setContent(html+'</main>');await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:`review/round11/contact-${width}-${theme}.png`,fullPage:true});
}await b.close();
