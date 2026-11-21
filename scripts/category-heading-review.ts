import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const categories = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8'));
mkdirSync('review/headings', { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const width of [320, 390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    const page = await browser.newPage({
      viewport: { width, height: width === 1440 ? 900 : 844 },
      colorScheme: theme,
    });
    await page.goto('http://127.0.0.1:5173');
    await page.locator('h1.category').waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const c of categories) {
      // Content stress test of the same heading's font/resize measurement, without publishing a category.
      await page.locator('h1.category').evaluate((el, name) => {
        el.textContent = name;
        el.className = name.length > 12 ? 'category long' : 'category';
      }, c.name);
      await page.locator('h1.category').evaluate((el) => (el.style.width = 'calc(100% - 1px)'));
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      await page.locator('h1.category').evaluate((el) => (el.style.width = ''));
      await page.waitForTimeout(40);
      const result = await page.locator('h1.category').evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return {
          fits: r.getBoundingClientRect().width <= el.clientWidth + 1,
          singleLine:
            el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 1,
          noOverflow: document.documentElement.scrollWidth <= innerWidth,
        };
      });
      results.push({ name: c.name, width, theme, ...result });
      if (['Universities', 'Arthropods'].includes(c.name) && width !== 320)
        await page.screenshot({
          path: `review/headings/${c.slug}-${width}-${theme}.png`,
          fullPage: true,
        });
    }
    await page.close();
  }
await browser.close();
writeFileSync('review/headings/results.json', JSON.stringify(results, null, 2));
if (results.some((r) => !r.fits || !r.singleLine || !r.noOverflow))
  throw new Error('Category heading failed its content stress test');
console.log('All ' + results.length + ' category, width and theme heading checks passed.');
