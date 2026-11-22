import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
mkdirSync('review/round9/thumbnails', { recursive: true });
const cards = [];
for (const name of ['certificate', 'summary']) {
  const before = execFileSync('git', ['show', 'r8-done:review/final/r7-' + name + '-og.png']);
  const after = readFileSync('review/final/r7-' + name + '-og.png');
  writeFileSync('review/round9/thumbnails/' + name + '-after.png', after);
  cards.push({ label: name + ' OG', before, after });
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 520, height: 620 } });
await p.setContent(
  `<style>body{margin:24px;background:#e9e6df;color:#24251f;font:14px Georgia}h1{font-size:22px}main{display:grid;grid-template-columns:200px 200px;gap:20px}img{width:200px;display:block;border:1px solid #b3b0a5}p{margin:8px 0}</style><h1>Dibs · share-card proof</h1><main><b>Before</b><b>After</b>${cards.map((c) => [c.before, c.after].map((x) => `<div><img src="data:image/png;base64,${x.toString('base64')}"><p>${c.label} · 200px</p></div>`).join('')).join('')}</main>`,
);
await p.screenshot({ path: 'review/round9/thumbnails/grid-200px.png', fullPage: true });
await b.close();
