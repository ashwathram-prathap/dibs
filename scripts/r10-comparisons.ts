import './test-traffic';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const b = await chromium.launch(),
  p = await b.newPage();
let links = '';
try {
  for (const width of [390, 1440, 2560])
    for (const theme of ['light', 'dark'])
      for (const name of ['closed', 'play', 'day', 'certificate', 'archive', 'office', 'error']) {
        const images = ['before', 'after']
          .map(
            (phase) =>
              `<figure><figcaption>${phase === 'before' ? 'Round 7 final · r7-done' : 'Round 10'} / ${name} / ${width}px / ${theme}</figcaption><img src="data:image/png;base64,${readFileSync(`review/round10/before-after/${name}-${width}-${theme}-${phase}.png`).toString('base64')}"></figure>`,
          )
          .join('');
        await p.setViewportSize({ width: Math.min(width * 2 + 48, 1920), height: 900 });
        await p.setContent(
          `<style>body{margin:0;background:#ddd;font:14px monospace;display:flex;gap:16px;padding:16px;align-items:start}figure{margin:0;flex:1;min-width:0}img{width:100%;display:block}figcaption{padding:12px;background:#fff}</style>${images}`,
        );
        await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
        const file = `${name}-${width}-${theme}-comparison.png`;
        await p.screenshot({ path: 'review/round10/before-after/' + file, fullPage: true });
        links += `<li><a href="${file}">${name} · ${width} · ${theme}</a></li>`;
      }
} finally {
  await b.close();
}
writeFileSync(
  'review/round10/before-after/index.html',
  `<!doctype html><meta charset="utf-8"><title>Round 10 visual comparisons</title><style>body{max-width:900px;margin:40px auto;font:18px sans-serif;line-height:1.6}</style><h1>Round 7 final → Round 10</h1><p>Round 7 rendered from unchanged tag r7-done (8efbd8d), with labelled development fixtures. The 2560px baseline is re-rendered because no original capture existed. Paired source images remain alongside each comparison. Fixture times may differ; layout and content are the actual tagged implementations.</p><ul>${links}</ul>`,
);
