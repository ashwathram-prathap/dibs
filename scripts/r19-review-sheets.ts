import './test-traffic';
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
mkdirSync('review/round19/design-review', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 1500 }, deviceScaleFactor: 1 });
for (const screen of [
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
]) {
  const cells = [];
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark']) {
      const src = readFileSync(
        `review/final/round19/${screen}-${width}-${theme}-after.png`,
      ).toString('base64');
      cells.push(
        `<section><h2>${screen} · ${width} · ${theme}</h2><div class="preview"><img src="data:image/png;base64,${src}"></div></section>`,
      );
    }
  await p.setContent(
    `<style>body{margin:0;background:#ddd;font:14px sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;box-sizing:border-box}section{margin:0;min-width:0}h2{font-size:16px;margin:0 0 8px}.preview{height:690px;overflow:hidden}img{display:block;width:100%;height:auto}</style>${cells.join('')}`,
  );
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await p.screenshot({ path: `review/round19/design-review/${screen}.png` });
}
await b.close();
