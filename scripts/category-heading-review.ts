import { readCategory } from './category-file';
import { chromium, webkit } from '@playwright/test';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const definitions = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8'));
const categories = readdirSync('categories')
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const category = readCategory('categories/' + file);
    return definitions.find((definition: any) => definition.slug === category.slug) || category;
  });
const engine = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const folder = 'review/round8/ui';
mkdirSync(folder, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const results = [];
for (const width of [320, 390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    const page = await browser.newPage({
      viewport: { width, height: width === 1440 ? 900 : 844 },
      colorScheme: theme,
    });
    await page.goto('http://127.0.0.1:5174/?r6=1&r8=1');
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
      if (c.name.length > 18 || c.slug === 'arthropods')
        await page.screenshot({
          path: `${folder}/heading-${engine}-${c.slug}-${width}-${theme}.png`,
          fullPage: true,
        });
    }
    await page.close();
  }
await browser.close();
writeFileSync(`review/round8/heading-results-${engine}.json`, JSON.stringify(results, null, 2));
if (results.some((r) => !r.fits || !r.singleLine || !r.noOverflow))
  throw new Error('Category heading failed its content stress test');
console.log('All ' + results.length + ' category, width and theme heading checks passed.');
