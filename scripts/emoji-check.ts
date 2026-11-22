import {readdirSync,readFileSync} from 'node:fs';
const bad=/[\u2190-\u21ff\u2500-\u27bf\u{1f000}-\u{1ffff}]/u;
const failures:string[]=[];
for(const dir of ['src','shared','worker'])for(const file of readdirSync(dir).filter(f=>/\.(tsx?|css)$/.test(f))){const path=dir+'/'+file;readFileSync(path,'utf8').split('\n').forEach((line,i)=>{if(path==='src/share.ts'&&line.includes('file.events.map'))return;if(path==='src/Icon.tsx'&&/[■□★]/.test(line))return;if(bad.test(line))failures.push(path+':'+(i+1));});}
if(failures.length)throw Error('Emoji-capable UI glyphs: '+failures.join(', '));
console.log('No emoji-capable glyphs outside encoded share text and its SVG renderer.');
