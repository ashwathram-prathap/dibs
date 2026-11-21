import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('review/motion', { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const width of [390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      colorScheme: theme,
      recordVideo: {
        dir: 'review/final/video',
        size: { width, height: width === 390 ? 844 : 900 },
      },
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5173');
    await page.getByLabel('ENTRY:', { exact: true }).fill('Axolotl');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    await page.locator('.claim-imprint').waitFor({ state: 'visible' });
    await page.waitForTimeout(200);
    const impact = await page.locator('.claim-imprint').evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        opacity: Number(getComputedStyle(el).opacity),
        inViewport: box.top >= 0 && box.bottom <= innerHeight,
        noOverflow: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    await page.screenshot({ path: `review/motion/impact-${width}-${theme}.png` });
    await page.locator('.claim-imprint').waitFor({ state: 'detached' });
    await page.screenshot({ path: `review/motion/receipt-${width}-${theme}.png` });
    results.push({ width, theme, ...impact });
    const video = page.video();
    await context.close();
    if (width === 390 && theme === 'light' && video)
      copyFileSync(await video.path(), 'review/final/claim-moment.webm');
  }
await browser.close();
writeFileSync('review/motion/results.json', JSON.stringify(results, null, 2));
if (results.some((r) => !r.inViewport || !r.noOverflow || r.opacity < 0.9))
  throw new Error('Impact was not visibly in the viewport');
console.log('Four visible stamp impacts and receipt reveals verified.');
