import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
const groups = [
  'payoff-phone',
  'payoff',
  'done',
  'streak',
  'settings',
  'themes',
  'preferences',
  'exports',
  'examples',
  'design-review',
];
const escape = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const sections = groups.map((group) => {
  let files: string[];
  try {
    files = readdirSync('review/round19/' + group).filter((f) => /\.(png|jpg)$/.test(f));
  } catch {
    return '';
  }
  return `<section><h2>${group}</h2><div class="grid">${files.map((f) => `<a href="${group}/${escape(f)}"><img loading="lazy" src="${group}/${escape(f)}" alt="${escape(f)}"><span>${escape(f)}</span></a>`).join('')}</div></section>`;
});
writeFileSync(
  'review/round19/index.html',
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dibs R19 review</title><style>body{margin:32px;font:16px system-ui;background:#eee9df;color:#181914}h1{font-size:40px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:24px}a{color:inherit;overflow-wrap:anywhere}img{display:block;width:100%;max-height:380px;object-fit:contain;object-position:top;margin-bottom:8px}section{margin-block:40px}p{max-width:70ch}</style><h1>Dibs R19 visual review</h1><p>Local development fixtures only. Phone payoffs come first. Full-resolution images open from each thumbnail. Final route screenshots are also in review/final/round19. See <a href="REPORT.md">the release report</a> for test results, decisions and limits.</p>${sections.join('')}</html>`,
);
const final = JSON.parse(readFileSync('review/round19/final-metrics.json', 'utf8'));
const payoff = JSON.parse(readFileSync('review/round19/visual-metrics.json', 'utf8'));
if (final.some((r: any) => r.overflow) || payoff.some((r: any) => r.overflow))
  throw Error('Visual layout metrics failed');
console.log('Wrote local visual index.');
