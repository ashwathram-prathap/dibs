import './test-traffic';
import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const origin = process.argv[2];
assert.ok(['https://dibs.here', 'https://practice.dibs-7hz.pages.dev'].includes(origin));
const stage = origin.includes('practice') ? 'practice' : 'production';
const results: any[] = [];
for (const [engine, label] of [
  [chromium, 'chromium'],
  [webkit, 'webkit'],
] as const) {
  const browser = await engine.launch();
  try {
    for (const width of [360, 1440])
      for (const colorScheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({
          viewport: { width, height: width === 360 ? 844 : 900 },
          colorScheme,
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        for (const path of ['/', '/about', '/how-it-works']) {
          await page.goto(origin + path);
          await expect(page.locator('.loading')).toBeHidden();
          const footer = page.locator('footer');
          await expect(
            footer.getByRole('link', {
              name: 'Ashwathram Prathap',
              exact: true,
              includeHidden: true,
            }),
          ).toHaveAttribute('href', 'https://ashwathram.ca');
          await expect(
            footer.getByRole('link', { name: 'Ashwathram Prathap on X', includeHidden: true }),
          ).toHaveAttribute('href', 'https://x.com/ashwarathap');
          if (path !== '/')
            await expect(page.locator('.builder-note')).toContainText(
              'Dibs is built by Ashwathram Prathap, a student at the University of Waterloo.',
            );
          else await expect(page.locator('main')).not.toContainText('Ashwathram');
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            'Page overflow',
          );
          await page.evaluate(() => document.fonts.ready);
          const dir = `review/round19g/${stage}/${label}-${width}-${colorScheme}`;
          mkdirSync(dir, { recursive: true });
          await page.screenshot({
            path: `${dir}/${path.replaceAll('/', '') || 'home'}.png`,
            fullPage: true,
            animations: 'disabled',
          });
          results.push({ engine: label, width, colorScheme, path, passed: true });
        }
        assert.deepEqual(errors, [], 'Browser console must be clean');
        await context.close();
      }
  } finally {
    await browser.close();
  }
}
writeFileSync(
  `review/round19g/${stage}-smoke.json`,
  JSON.stringify({ passed: true, at: new Date().toISOString(), results }, null, 2),
);
console.log({ stage, passed: true, checks: results.length });
