import {readFileSync,writeFileSync} from 'node:fs';
import {findTypo,shardFor} from '../shared/catalog';import{normalize}from'../worker/domain';
const results:any[]=[];
for(const slug of ['animals','birds','plants','cities','foods','fruits-vegetables','countries']){
 const m=JSON.parse(readFileSync(`public/catalog/${slug}/manifest.json`,'utf8'));const dir=`public/catalog/${slug}/${m.version}`;
 const shards=Array.from({length:256},(_,i)=>JSON.parse(readFileSync(`${dir}/keys-${i}.json`,'utf8')));
 const keys=shards.flatMap(s=>Object.keys(s));const timings:number[]=[];const misses:number[]=[];
 for(let i=0;i<200;i++){const key=keys[Math.floor(i*keys.length/200)];const start=performance.now();if(!shards[shardFor(key)][key])throw Error('miss');timings.push(performance.now()-start);}
 const trees=new Map();let parsedBytes=0;
 for(let i=0;i<30;i++){const query=keys[Math.floor(i*keys.length/30)].slice(0,-1)+'x';for(let n=Math.max(1,query.length-2);n<=Math.min(96,query.length+2);n++)if(!trees.has(n)){const bytes=readFileSync(`${dir}/typos-${n}.json`);parsedBytes+=bytes.length;trees.set(n,JSON.parse(bytes.toString()));}const start=performance.now();for(let n=Math.max(1,query.length-2);n<=Math.min(96,query.length+2);n++)findTypo(trees.get(n),query,2);misses.push(performance.now()-start);}
 const p95=(v:number[])=>v.sort((a,b)=>a-b)[Math.floor(v.length*.95)];results.push({slug,entries:m.count,keys:keys.length,warmExactCpuP95Ms:p95(timings),warmTypoCpuP95Ms:p95(misses),parsedTypoBytes:parsedBytes});
}
writeFileSync('review/round8/local-lookup-benchmark.json',JSON.stringify({runtime:'Node local CPU proxy; not Cloudflare billing measurement',results},null,2));console.log(results);
