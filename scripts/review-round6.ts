import './test-traffic';
import { chromium } from '@playwright/test';
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
mkdirSync('review/final', { recursive: true });
const browser = await chromium.launch();
const checks: any[] = [];
try {
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
      const shot = async (name: string) => {
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `review/final/r6-${name}-${width}-${theme}.png`,
          fullPage: true,
        });
        checks.push({
          name,
          width,
          theme,
          noOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        });
      };
      for (const [path, name] of [
        ['/', 'today'],
        ['/archive', 'empty-archive'],
        ['/about', 'about'],
        ['/stats', 'stats'],
      ]) {
        await page.goto('http://127.0.0.1:5173' + path);
        await page.locator('main').waitFor();
        await page.waitForTimeout(350);
        await shot(name);
      }
      await page.goto('http://127.0.0.1:5173/?r6=1');
      const input = page.getByLabel('ENTRY:', { exact: true });
      await input.fill('Dog');
      await page.getByRole('button', { name: 'CALL DIBS' }).click();
      await page.locator('.house-strike').waitFor();
      await shot('house-strike');
      await input.fill('Axolotl');
      await page.getByRole('button', { name: 'CALL DIBS' }).click();
      await page.locator('.gold-imprint').waitFor();
      await page.screenshot({ path: `review/final/r6-gold-animation-${width}-${theme}.png` });
      await page.evaluate(() => {
        history.pushState({}, '', '/certificate/fixture-2');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.locator('.gold-certificate').waitFor();
      await shot('gold-certificate');
      await page
        .locator('.gold-stamp')
        .screenshot({ path: `review/final/r6-gold-stamp-${width}-${theme}.png` });
      if (width === 390 && theme === 'light')
        for (const kind of ['Feed', 'Story']) {
          const download = page.waitForEvent('download');
          await page.getByRole('button', { name: kind + ' PNG', exact: true }).click();
          await (await download).saveAs('review/final/r6-gold-' + kind.toLowerCase() + '.png');
        }
      await page.evaluate(() => {
        document.documentElement.classList.add('low-power');
      });
      await page
        .locator('.gold-stamp')
        .screenshot({ path: `review/final/r6-gold-static-${width}-${theme}.png` });
      await page.evaluate(() => document.documentElement.classList.remove('low-power'));
      await page.evaluate(() => {
        history.pushState({}, '', '/');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      for (const answer of ['Okapi', 'Quokka']) {
        await page.getByLabel('ENTRY:', { exact: true }).fill(answer);
        await page.getByRole('button', { name: 'CALL DIBS' }).click();
        await page.locator('.certificate').waitFor();
        await page.waitForTimeout(1400);
      }
      await page.locator('.day-summary').waitFor();
      await shot('gold-summary');
      await page.goto('http://127.0.0.1:5173/archive?r6=1');
      await page.locator('.reserved-list').waitFor();
      await shot('reserved-list');
      const video = page.video();
      await context.close();
      if (width === 390 && theme === 'light' && video)
        copyFileSync(await video.path(), 'review/final/r6-gold-flow.webm');
    }
  for (const kind of ['feed', 'story']) {
    const png = PNG.sync.read(readFileSync('review/final/r6-gold-' + kind + '.png'));
    checks.push({
      name: 'gold-' + kind,
      width: png.width,
      height: png.height,
      noOverflow: png.width === 1080 && png.height === (kind === 'story' ? 1920 : 1350),
    });
  }
} finally {
  await browser.close();
  writeFileSync('review/round6/visual-review.json', JSON.stringify(checks, null, 2));
}
if (checks.some((c) => !c.noOverflow)) throw Error('Review overflow or export dimensions failed');
console.log(checks.length + ' final visual/export checks passed.');
