import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='.category-cache/r8/pageviews.json',cache=JSON.parse(readFileSync(path,'utf8'));
for(const slug of ['animals','birds','plants','cities']){const c=JSON.parse(execFileSync('git',['show',`HEAD:categories/${slug}.json`],{maxBuffer:20e6}).toString());for(const a of c.answers){const title=a.display[0].toUpperCase()+a.display.slice(1);if(!cache[title])cache[title]={...a.pageviews,title,status:'measured'};}}
writeFileSync(path,JSON.stringify(cache));
