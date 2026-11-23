import './test-traffic';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const dir = 'review/round18';
const style = `body{margin:24px;background:#f1ece2;color:#1a1a17;font:17px/1.5 sans-serif}h1,h2{line-height:1.15}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}img{display:block;width:100%;height:auto}figure{margin:0}figcaption{padding:12px 0;font-weight:bold}a{color:inherit}nav{display:flex;flex-wrap:wrap;gap:20px}section{margin:48px 0} @media(max-width:700px){.grid{grid-template-columns:1fr}}`;
let html = `<!doctype html><meta charset="utf-8"><title>Dibs R18 visual review</title><style>${style}</style><h1>Dibs · R18 visual review</h1><p>Local fixture screenshots; no fabricated records were put in production. Open each image at its native size.</p><nav><a href="REPORT.md">Release report</a><a href="../../BRAND.md">Brand guide</a><a href="#layout">Settings, feedback, footer</a><a href="#clock">R7 clock comparison</a><a href="#carbon">Paper and carbon comparison</a><a href="#exports">Exports</a></nav><section id=layout><h2>Settings, feedback and footer</h2>`;
const fig = (path: string, label: string) =>
  `<figure><a href="${path}"><img loading=lazy src="${path}" alt="${label}"></a><figcaption>${label}</figcaption></figure>`;
for (const width of [320, 375, 390, 430, 768, 1440]) {
  html += `<h3>${width}px</h3><div class=grid>`;
  for (const theme of ['light', 'dark'])
    for (const screen of ['settings', 'settings-scrolled', 'feedback', 'footer'])
      html += fig(`after-${screen}-${width}-${theme}.png`, `${screen} · ${width}px · ${theme}`);
  html += '</div>';
}
html += '</section><section id=clock><h2>R7 clock comparison</h2>';
for (const width of [390, 1440])
  for (const theme of ['light', 'dark'])
    html += fig(`clock/comparison-${width}-${theme}.png`, `${width}px · ${theme}`);
html += '</section><section id=carbon><h2>Before / after</h2>';
for (const screen of ['play', 'done', 'certificate'])
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark']) {
      html += `<h3>${screen} · ${width}px · ${theme}</h3><div class=grid>`;
      for (const phase of ['before', 'after'])
        html += fig(`${phase}-${screen}-${width}-${theme}.png`, phase);
      html += '</div>';
    }
html += '</section><section id=exports><h2>Export samples</h2><div class=grid>';
for (const theme of ['light', 'dark'])
  for (const kind of ['certificate', 'summary'])
    html += fig(`exports/after-${theme}-${kind}-feed.jpg`, `${kind} · ${theme}`);
html +=
  '</div></section><h2>All final routes</h2><p><a href="../final/round18/">390px and 1440px, both themes</a></p>';
writeFileSync(`${dir}/index.html`, html);
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark']) {
      const names = [
        'closed',
        'live',
        'done',
        'leaderboard',
        'how',
        'office',
        'certificate',
        'archive',
        'stats',
        'admin',
        'calendar',
        'error',
      ];
      for (let start = 0; start < names.length; start += 6) {
        const items = names
          .slice(start, start + 6)
          .map((name) => {
            const path = `review/final/round18/${name}-${width}-${theme}-after.png`;
            if (!existsSync(path)) throw Error('Missing ' + path);
            return `<figure><figcaption>${name} · ${width} · ${theme}</figcaption><img src="data:image/png;base64,${readFileSync(path).toString('base64')}"></figure>`;
          })
          .join('');
        await p.setContent(
          `<style>body{margin:0;background:#ddd;font:18px sans-serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0;background:#eee}figcaption{padding:8px}img{width:100%;height:490px;object-fit:contain;object-position:top}</style><div class=grid>${items}</div>`,
        );
        await p
          .locator('img')
          .evaluateAll((els) => Promise.all(els.map((el) => (el as HTMLImageElement).decode())));
        await p.screenshot({
          path: `${dir}/contact-${width}-${theme}-${start}.png`,
          fullPage: true,
        });
      }
    }
} finally {
  await b.close();
}
