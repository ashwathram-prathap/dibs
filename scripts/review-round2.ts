import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const results=JSON.parse(readFileSync('review/devices/results.json','utf8'));
const projects=new Map<string,{passed:number;failed:number}>();
function walk(s:any){for(const spec of s.specs||[])for(const t of spec.tests||[]){const key=t.projectName;const p=projects.get(key)||{passed:0,failed:0};if(t.status==='expected')p.passed++;else p.failed++;projects.set(key,p);}for(const sub of s.suites||[])walk(sub);}
walk(results);
let md='# Round 2 browser verification\n\nEngine/device emulation, not physical phones or native webviews.\n\n| Configuration | Passed | Failed |\n| --- | ---: | ---: |\n';
for(const [name,r]of projects)md+=`| ${name} | ${r.passed} | ${r.failed} |\n`;
md+='\nFirefox desktop (1280/1440/2560, both themes): BLOCKED before app load. Retried default launch, project-local temporary profiles, and a clean Firefox install. All report “Could not find profile folder.” No OS settings were changed. Rerun `npm run test:e2e` on a host where Firefox launches. Physical Safari 16, Samsung Internet, branded Edge, social in-app browsers, native sharing and on-screen keyboards remain owner device checks.\n';
writeFileSync('review/round2/devices.md',md);
writeFileSync('review/round2/browser-summary.json',JSON.stringify({passed:results.stats.expected,failed:results.stats.unexpected,projects:Object.fromEntries(projects),firefox:'blocked before app launch'},null,2));
for(const kind of ['feed','story'])copyFileSync(`review/devices/iPhone-15-Pro-light/certificate-${kind}.png`,`review/final/certificate-${kind}.png`);
const old=readFileSync('review/index.html','utf8');
let html=old.slice(0,old.indexOf('</style>')+8)+'<h1>Dibs / Round 2 review.</h1><p>Local development proofs, including clearly labelled example claims. No fixture players are deployed. Remote D1 verification is deferred until November 21 at 7 PM Toronto.</p><nav><a href="ACCEPTANCE.md">Acceptance record</a><a href="categories.md">Draft category checklist</a><a href="round2/devices.md">Device results</a><a href="round2/free-tier.md">Measured free-tier budget</a><a href="lighthouse/mobile.html">Lighthouse 96 / 100</a></nav>';
for(const width of [390,1440])for(const theme of ['light','dark']){
 html+=`<details open><summary>${width}px / ${theme}</summary><div class="grid">`;
 for(const name of ['today','taken','success','certificate','archive','about','stats','closed','quota']){const file=`final/${name}-${width}-${theme}.png`;html+=`<figure><a href="${file}"><img loading="lazy" src="${file}" alt="${name}, ${width}px, ${theme}"></a><figcaption>${name}</figcaption></figure>`;}
 html+='</div></details>';
}
html+='<h2>Current export proofs</h2><div class="grid">';
for(const file of ['certificate-feed.png','certificate-story.png','og.png'])html+=`<figure><a href="final/${file}"><img loading="lazy" src="final/${file}" alt="${file}"></a><figcaption>${file}</figcaption></figure>`;
html+='</div><h2>The claim moment</h2><video controls preload="metadata" src="final/claim-moment.webm"></video><footer>Private repository. Administrative commands and remaining checks are in the ignored MORNING_REPORT.md.</footer></html>';
copyFileSync('review/round2/og.png','review/final/og.png');writeFileSync('review/index.html',html);
console.log('Saved compact device evidence, exports, and current review gallery.');
