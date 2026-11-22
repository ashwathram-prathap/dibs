import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {normalize} from '../worker/domain';
// All source rows are considered. Missing Wikipedia articles never exclude a real reference answer.
const raw=JSON.parse(readFileSync('.category-cache/r8/candidates.json','utf8'));
const iso=await import('../.category-cache/r8/iso.mjs');
raw.countries=iso.iso31661.map((r:any)=>({display:r.name,aliases:[r.alpha2,r.alpha3],source:'https://github.com/wooorm/iso-3166'}));
const overrides:Record<string,Record<string,string[]>>={animals:{Wolf:['wolves'],Mouse:['mice'],Octopus:['octopi','octopuses'],Cow:['cattle'],Puma:['cougar','mountain lion'],Orca:['killer whale'],Ladybug:['ladybird']},cities:{'New York':['NYC','New York City'],'Saint Petersburg':['St Petersburg'],'St. John’s':['Saint Johns']},countries:{'Vatican City':['Holy See'],'Brunei':['Brunei Darussalam'],'Micronesia':['Micronesia, Federated States of'],'Democratic Republic of the Congo':['Congo, Democratic Republic of the'],'Republic of the Congo':['Congo'],'Cape Verde':['Cabo Verde'],'United States':['USA','US','United States of America','America'],'United Kingdom':['UK','Great Britain','Britain'],'Netherlands':['Holland'],'Ivory Coast':['Côte d’Ivoire'],'South Korea':['Korea, Republic of'],'North Korea':['Korea, Democratic People’s Republic of'],'Russia':['Russian Federation'],'Iran':['Iran, Islamic Republic of'],'Vietnam':['Viet Nam'],'Taiwan':['Taiwan, Province of China'],'Bolivia':['Bolivia, Plurinational State of'],'Venezuela':['Venezuela, Bolivarian Republic of'],'Tanzania':['Tanzania, United Republic of'],'Syria':['Syrian Arab Republic'],'Moldova':['Moldova, Republic of'],'Laos':['Lao People’s Democratic Republic'],'Turkey':['Türkiye'],'Czechia':['Czech Republic'],'Eswatini':['Swaziland'],'Myanmar':['Burma']}};
const supplement=existsSync('scripts/r8-common-names.json')?JSON.parse(readFileSync('scripts/r8-common-names.json','utf8')):{};
const catalogs:Record<string,any[]>={};
for(const [slug,input] of Object.entries(raw) as any){
 const used=new Set<string>();const rows:any[]=[];
 const replacements=Object.entries(overrides[slug]||{}).map(([display,aliases])=>({display,aliases,source:'Dibs common-name editorial supplement'}));
 const ordered=[...replacements,...(supplement[slug]||[]).map((display:string)=>({display,aliases:[],source:'Dibs common-name editorial supplement'})),...input.sort((a:any,b:any)=>(b.population||0)-(a.population||0))];
 const byKey=new Map<string,any>();const aliasOwner=new Map<string,any>();
 for(const a of ordered){
  const key=normalize(a.display);if(!key)continue;
  if(aliasOwner.has(key)){const prev=aliasOwner.get(key);prev.aliases.push(a.display,...a.aliases);continue;}
  if(byKey.has(key)){const prev=byKey.get(key);prev.aliases.push(...a.aliases);continue;}
  byKey.set(key,a);rows.push(a);for(const alias of a.aliases)aliasOwner.set(normalize(alias),a);
 }
 for(const a of rows)used.add(normalize(a.display));
 for(const a of rows){a.canonical=normalize(a.display);a.display=a.display[0].toUpperCase()+a.display.slice(1);a.aliases=[...new Set(a.aliases as string[])].filter((x:any)=>{const key=normalize(x);if(!key||used.has(key))return false;used.add(key);return true;});}
 catalogs[slug]=rows;
}
const cacheFile='.category-cache/r8/pageviews.json';
const cache:Record<string,any>=existsSync(cacheFile)?JSON.parse(readFileSync(cacheFile,'utf8')):{};
const title=(s:string)=>s[0].toUpperCase()+s.slice(1);
const pending=[...new Set(Object.values(catalogs).flat().map(a=>title(a.display)))].filter(t=>!cache[t]);
console.log('Measuring',pending.length,'uncapped candidate titles');
let cursor=0,done=0,failedBatches=0;
async function measure(batch:string[]){
 const params={action:'query',format:'json',prop:'pageviews|pageprops',pvipdays:'30',titles:batch.join('|'),redirects:'1'};
 let data:any={query:{pages:{},redirects:[],normalized:[]}},cont:any={};
 do{
  let response:any;
  for(let i=0;i<3;i++){
   try{const r=await fetch('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({...params,...cont}),{headers:{'User-Agent':'DibsCatalog/2.0 (https://dibs.here/about)'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(String(r.status));response=await r.json();if(response.error)throw Error(response.error.info);break;}catch(e){if(i===2)throw e;await new Promise(r=>setTimeout(r,1000*(i+1)));}
  }
  Object.assign(data.query.pages,response.query?.pages);data.query.redirects.push(...(response.query?.redirects||[]));data.query.normalized.push(...(response.query?.normalized||[]));cont=response.continue;
 }while(cont);
 const redirects=new Map([...data.query.normalized,...data.query.redirects].map((r:any)=>[r.from,r.to]));
 for(const t of batch){let key:any=t;for(let i=0;i<5&&redirects.has(key);i++)key=redirects.get(key);const p:any=Object.values(data.query.pages).find((p:any)=>p.title===key);const points=Object.entries(p?.pageviews||{}).filter(([,n])=>typeof n==='number');cache[t]=!p||p.missing!==undefined||p.pageprops?.disambiguation!==undefined||!points.length?{total:0,days:0,status:'unavailable'}:{total:points.reduce((n,[,v])=>n+(v as number),0),days:points.length,start:points[0][0],end:points.at(-1)![0],title:p.title,status:'measured'};}
}
if(!process.argv.includes('--offline')) await Promise.all(Array.from({length:1},async()=>{while(cursor<pending.length){const batch=pending.slice(cursor,cursor+=40);try{await measure(batch);}catch(e){console.error('Unmeasured batch',batch[0],String(e));if(++failedBatches>=3){console.error('BLOCKED: three batches failed after three request attempts each; preserving unknown measurements.');break;}}done+=batch.length;if(done%400===0){writeFileSync(cacheFile,JSON.stringify(cache));console.log('Measured',done,'/',pending.length);}await new Promise(r=>setTimeout(r,400));}}));
writeFileSync(cacheFile,JSON.stringify(cache));
const names:any={animals:'Animals',birds:'Birds',plants:'Plants',foods:'Foods',cities:'Cities',countries:'Countries & territories','fruits-vegetables':'Fruits & vegetables'};
const scopes:any={animals:'English common names for animals of every kind, including general groups and bird species.',birds:'Bird species and general bird names.',plants:'English common names for plants, including trees, flowers, herbs and crops.',foods:'Foods, dishes and edible ingredients.',cities:'Named populated places in GeoNames cities1000: population 1,000+ or administrative seats; one answer per name.',countries:'ISO 3166 countries and territories, with common alternate names.','fruits-vegetables':'Culinary fruits and vegetables, including varieties.'};
for(const [slug,answers]of Object.entries(catalogs)){
 for(const a of answers){a.pageviews=cache[title(a.display)]||{total:0,days:0,status:'unavailable'};const mean=a.pageviews.days?a.pageviews.total/a.pageviews.days:0;a.obscurity=a.pageviews.days?(mean>=1000?1:mean>=200?2:mean>=50?3:mean>=10?4:5):null;}
 answers.sort((a,b)=>(b.pageviews.total/(b.pageviews.days||1))-(a.pageviews.total/(a.pageviews.days||1))||a.display.localeCompare(b.display));
 const old=existsSync('categories/'+slug+'.json')?JSON.parse(readFileSync('categories/'+slug+'.json','utf8')):{};
 writeFileSync('categories/'+slug+'.json',JSON.stringify({...old,id:slug,slug,name:names[slug],status:'draft',date:old.date||null,total_registrable:answers.length,provenance:{source:'Full reference extraction, editorial common names, Wikipedia PageViewInfo',scopeNote:scopes[slug],builtAt:new Date().toISOString(),identityPolicy:'complete-reference-v2',reviewRequired:true,coverageRequired:true,unmeasured:answers.filter(a=>!a.pageviews.days).length,license:'See /data/licenses.txt',completeSources:slug==='cities'||slug==='birds'||slug==='countries',ranking:'30 available days; unavailable pageviews retained as unknown, never fabricated'},answers})+'\n');console.log('BUILT',slug,answers.length);
}
