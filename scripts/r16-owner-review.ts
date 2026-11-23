import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase = process.argv[2] || 'after';
const dir = 'review/round16/owner-review';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const metrics: any[] = [];
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
        timezoneId: 'America/Toronto',
      });
      const page = await context.newPage();
      for (const [name, path] of [
        ['closed', '/?r7-closed'],
        ['how', '/how-it-works'],
        ['office', '/about'],
        ['archive', '/archive'],
        ['settings', '/?r7-closed'],
      ]) {
        await page.goto('http://127.0.0.1:5190' + path);
        await page.locator('.loading').waitFor({ state: 'hidden' });
        await page.evaluate(() => document.fonts.ready);
        if (['how', 'office', 'archive'].includes(name)) await page.locator('main h1').waitFor();
        if (name === 'settings') {
          await page.locator('.header-settings > summary').click();
          await page.locator('.music-toggle').waitFor();
        }
        await page.screenshot({
          path: `${dir}/${phase}-${name}-${width}-${theme}.png`,
          fullPage: true,
        });
        metrics.push({
          name,
          width,
          theme,
          overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        });
        if (name === 'closed')
          for (const digits of ['44:44:44', '11:11:11', '00:00:00']) {
            // Visual-only glyph proof; no production clock/data is changed.
            await page.locator('.clock').evaluate((el, value) => (el.textContent = value), digits);
            await page.locator('.drop-countdown').screenshot({
              path: `${dir}/${phase}-clock-${digits.replaceAll(':', '')}-${width}-${theme}.png`,
            });
          }
      }
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(`${dir}/${phase}-metrics.json`, JSON.stringify(metrics, null, 2));
}
