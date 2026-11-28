import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const dir = 'review/r21-flow/og/crops';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const files = [
  'light-home',
  'dark-home',
  'light-offgold-answers-summary',
  'dark-off-answers-summary',
  'light-top-answers-summary',
  'dark-offgold-sealed-certificate',
];
const results = [];
try {
  for (const name of files)
    for (const [width, height] of [
      [552, 289],
      [300, 157],
      [504, 264],
    ]) {
      await page.setViewportSize({ width, height });
      const data = readFileSync(`review/r21-flow/og/${name}.jpg`).toString('base64');
      await page.setContent(
        `<style>html,body{margin:0}img{width:100%;height:100%;object-fit:cover;display:block}</style><img src="data:image/jpeg;base64,${data}"/>`,
      );
      await page.locator('img').evaluate((i: HTMLImageElement) => i.decode());
      await page.screenshot({ path: `${dir}/${name}-${width}.png` });
      results.push({ name, width, height });
    }
} finally {
  await browser.close();
}
writeFileSync('review/r21-flow/og/crops.json', JSON.stringify(results, null, 2));
