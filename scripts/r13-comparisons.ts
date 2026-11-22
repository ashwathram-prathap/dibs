import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const b = await chromium.launch();
try {
  const p = await b.newPage();
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'])
      for (const [name, old] of [
        ['closed', 'closed'],
        ['live', 'mid-round'],
        ['done', 'clean'],
      ]) {
        const paths = [
          `review/final/r7-chromium-${width}-${theme}-${old}.png`,
          `review/round13/${name}-${width}-${theme}-after.png`,
        ];
        await p.setViewportSize({ width: Math.min(width * 2 + 48, 1920), height: 900 });
        await p.setContent(
          `<style>body{margin:0;padding:16px;display:flex;align-items:start;gap:16px;background:#ddd;font:16px monospace}figure{margin:0;flex:1;min-width:0}img{width:100%}figcaption{padding:12px;background:white}</style>` +
            paths
              .map(
                (path, i) =>
                  `<figure><figcaption>${i ? 'R13' : 'R7'} · ${name} · ${width}px · ${theme}</figcaption><img src="data:image/png;base64,${readFileSync(path).toString('base64')}"></figure>`,
              )
              .join(''),
        );
        await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
        await p.screenshot({
          path: `review/round13/vs-r7-${name}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
} finally {
  await b.close();
}
