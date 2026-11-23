import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {extname,join} from 'node:path';
import {chromium,webkit,expect} from '@playwright/test';
import {SECURITY_HEADERS} from '../shared/security';
const dir='.tmp/e2e-dist';const bytesPerSecond=200000,latency=150;
const server=createServer(async(req,res)=>{
 const path=new URL(req.url!,'http://localhost').pathname;const file=join(dir,path.includes('.')?path:'/index.html');
 if(!file.startsWith(dir)||!existsSync(file)){res.writeHead(404);res.end();return;}
 const all=readFileSync(file);let start=0,end=all.length-1;const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);if(range){start=Number(range[1]);end=Math.min(end,range[2]?Number(range[2]):end);}
 const body=all.subarray(start,end+1);const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webm':'audio/webm','.m4a':'audio/mp4','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
 await new Promise(r=>setTimeout(r,latency));res.writeHead(range?206:200,{...SECURITY_HEADERS,'content-type':mime[extname(file)]||'application/octet-stream','content-length':body.length,'accept-ranges':'bytes',...(range?{'content-range':`bytes ${start}-${end}/${all.length}`}:{})});
 for(let i=0;i<body.length&&!res.destroyed;i+=16000){res.write(body.subarray(i,i+16000));await new Promise(r=>setTimeout(r,16000/bytesPerSecond*1000));}res.end();
});await new Promise<void>(r=>server.listen(5193,'127.0.0.1',r));
mkdirSync('review/round15/filmstrip',{recursive:true});const results:any[]=[];
try{for(const engine of [chromium,webkit]){const b=await engine.launch();try{for(const theme of ['light','dark'] as const){const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,colorScheme:theme});const p=await c.newPage();
 await p.addInitScript(()=>{(window as any).firstSound=null;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const at=performance.now();this.addEventListener('playing',()=>{(window as any).firstSound=performance.now()-at},{once:true});return play.call(this);};});
 for(const cache of ['cold','warm']){const nav=p.goto('http://127.0.0.1:5193/?r7-closed',{waitUntil:'commit'});await nav;const frames:any[]=[];for(let i=0;i<14;i++){const state=await p.evaluate(()=>({background:getComputedStyle(document.documentElement).backgroundColor,theme:document.documentElement.dataset.theme,fallback:document.querySelector('.seo-fallback')?getComputedStyle(document.querySelector('.seo-fallback')!).clipPath:null,at:performance.now()}));frames.push(state);await p.screenshot({path:`review/round15/filmstrip/${engine.name()}-${theme}-${cache}-${String(i).padStart(2,'0')}.png`});await p.waitForTimeout(70);}
 await p.locator('.closed-office').waitFor();expect(frames.every(f=>f.background=== (theme==='dark'?'rgb(22, 21, 15)':'rgb(241, 236, 226)'))).toBe(true);expect(frames.every(f=>f.fallback===null||f.fallback==='inset(50%)')).toBe(true);results.push({engine:engine.name(),theme,cache,frames});}
 await p.locator('.header-settings > summary').click();await p.getByRole('button',{name:'Turn music on',exact:true}).click();await expect.poll(()=>p.evaluate(()=>(window as any).firstSound)).not.toBeNull();const firstSound=await p.evaluate(()=>(window as any).firstSound);results.push({engine:engine.name(),theme,firstSoundMs:firstSound,model:{latencyMs:latency,bytesPerSecond},note:'playing event is a browser proxy for first audible output; physical speaker latency is not measurable here'});await c.close();}}finally{await b.close();}}}finally{server.closeAllConnections();server.close();writeFileSync('review/round15/throttled-media.json',JSON.stringify(results,null,2));}
