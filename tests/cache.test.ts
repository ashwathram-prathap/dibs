import { beforeAll, afterAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { registryDate, dropAt } from '../worker/domain';
let mf: Miniflare, db: any;
const evidence: any[] = [];
async function call(path:string, body?:any, cookie?:string, ip?:string) {
  const r = await mf.dispatchFetch('http://localhost/api'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{}),...(ip?{'x-test-ip':ip}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  evidence.push({action:path.split('?')[0],status:r.status,reads:Number(r.headers.get('x-d1-rows-read')||0),writes:Number(r.headers.get('x-d1-rows-written')||0)});
  return r;
}
async function account() {const r=await call('/bootstrap'); return {cookie:r.headers.get('set-cookie')!.split(';')[0], ...await r.json() as any};}
beforeAll(async()=>{
  const result=await build({entryPoints:['worker/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers'],loader:{'.woff':'binary','.otf':'binary'},plugins:[{name:'wasm-module',setup(b){b.onResolve({filter:/\.wasm$/},()=>({path:'./resvg.wasm',external:true}));}}]});
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'cache-test',modules:[{type:'ESModule',path:'worker.mjs',contents:result.outputFiles[0].text},{type:'CompiledWasm',path:'resvg.wasm',contents:readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm')}],compatibilityDate:'2026-11-20',d1Databases:['DB'],durableObjects:{REGISTRY:{className:'Registry',useSQLite:true}},bindings:{COOKIE_SECRET:'local-test-only',ADMIN_TOKEN:'local-admin',LOCAL_TEST:'true',TURNSTILE_SITE_KEY:'test'}}]}));
  db=await mf.getD1Database('DB');
  for(const file of ['0001_registry.sql','0002_foreign_key_indexes.sql','0003_remove_schools.sql']) await db.exec(readFileSync('migrations/'+file,'utf8').replace(/^--.*$/gm,'').replace(/CREATE TRIGGER[\s\S]*?\nEND;/g,m=>m.replace(/\n/g,' ')).replace(/\n/g,' '));
  const date=registryDate();
  await db.prepare('INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)').bind('test',date,'Animals','animals',2200,dropAt(date),'approved').run();
  for(let i=0;i<70;i++){
    await db.prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)').bind('a'+i,'test','animal'+i,'Animal '+i,'[]',4).run();
    await db.prepare('INSERT INTO answer_keys VALUES(?,?,?)').bind('test','animal'+i,'a'+i).run();
  }
},30000);
afterAll(async()=>{mkdirSync('review/round2',{recursive:true});writeFileSync('review/round2/d1-actions.json',JSON.stringify(evidence,null,2));await mf?.dispose();});
it('creates no D1 users or writes on page loads and cached polls',async()=>{
  const first=await account();
  const next=await account();
  expect(first.today.category.name).toBe('Animals');
  expect((await db.prepare('SELECT COUNT(*) n FROM users').first()).n).toBe(0);
  expect(evidence.slice(-2).every(r=>r.writes===0)).toBe(true);
  expect(evidence.at(-1).reads).toBe(0);
  await call('/ledger?category=test&since=0');
  await call('/ledger?since=900&category=test');
  expect(evidence.at(-1).reads).toBe(0);
  expect(next.rows).toEqual([]);
});
it('keeps the claim race safe behind the coordinator',async()=>{
  const accounts=await Promise.all(Array.from({length:50},account));
  const responses=await Promise.all(accounts.map((a,i)=>call('/claim',{answer:'Animal 0',turnstileToken:'test'},a.cookie,'race'+i)));
  expect(responses.filter(r=>r.status===201)).toHaveLength(1);
  expect(responses.filter(r=>r.status===409)).toHaveLength(49);
  const winner=responses.findIndex(r=>r.status===201);
  const data=await responses[winner].json() as any;
  expect(data.me.claim.id).toBe(data.claim.id);
  const r=await call('/certificate/'+data.claim.id);
  expect(r.status).toBe(200); expect(evidence.at(-1).reads).toBe(0);
  const second=await call('/claim',{answer:'Animal 1',turnstileToken:'test'},accounts[winner].cookie,'race-winner');
  expect(second.status).toBe(403);
  expect((await db.prepare('SELECT COUNT(*) n FROM users').first()).n).toBeLessThanOrEqual(50);
  const png=await call('/og/'+data.claim.id);
  expect(png.headers.get('content-type')).toBe('image/png');
  const bytes=await png.arrayBuffer(); expect(bytes.byteLength).toBeGreaterThan(1000);
  const again=await call('/og/'+data.claim.id);
  expect(Buffer.from(await again.arrayBuffer())).toEqual(Buffer.from(bytes));
  expect(evidence.at(-1).reads).toBe(0); expect(evidence.at(-1).writes).toBe(0);
},30000);
it('enforces rerolls and attempts in SQLite DO storage with zero D1 writes',async()=>{
  const a=await account();
  const rolls=await Promise.all(Array.from({length:5},()=>call('/me/reroll',{},a.cookie)));
  expect(rolls.filter(r=>r.status===200)).toHaveLength(3);
  expect(rolls.filter(r=>r.status===403)).toHaveLength(2);
  const rs=await Promise.all(Array.from({length:4},()=>call('/claim',{answer:'missing',turnstileToken:'test'},a.cookie)));
  expect(rs.filter(r=>r.status===422)).toHaveLength(3);
  expect(rs.filter(r=>r.status===429)).toHaveLength(1);
  expect(evidence.slice(-9).every(r=>r.writes===0)).toBe(true);
});
it('uses one WebSocket connection and returns cursor-filtered real records',async()=>{
  const r=await mf.dispatchFetch('http://localhost/api/live',{headers:{upgrade:'websocket'}});
  expect(r.status).toBe(101);
  const ws=r.webSocket!;ws.accept();
  const result=new Promise<any>(resolve=>ws.addEventListener('message',e=>resolve(JSON.parse(String(e.data))),{once:true}));
  ws.send(JSON.stringify({category:'test',since:900}));
  const message=await result;
  expect(message.today.category.id).toBe('test');expect(message.rows).toEqual([]);
  ws.close(1000);
});
