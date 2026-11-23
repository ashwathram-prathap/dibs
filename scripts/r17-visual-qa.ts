import { chromium, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const results: any[] = [];
mkdirSync('review/round17/rarity-curve', { recursive: true });
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (const width of [390, 1440])
      for (const colorScheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 900 },
          colorScheme,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        for (const mode of ['holder', 'sealed', 'closed']) {
          await page.goto(`http://127.0.0.1:5199/certificate/fixture-1?r17=${mode}&p=.94`);
          await expect(page.locator('.certificate')).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          if (mode !== 'sealed') await expect(page.locator('.rarity-curve')).toBeVisible();
          await page.screenshot({
            path: `review/round17/certificate/${engine.name()}-${width}-${colorScheme}-${mode}.png`,
            fullPage: true,
          });
          if (mode !== 'sealed')
            await page
              .locator('.rarity-curve')
              .screenshot({
                path: `review/round17/rarity-curve/${engine.name()}-${width}-${colorScheme}-${mode}.png`,
              });
          const axe = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(
            axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
            false,
          );
          results.push({
            browser: engine.name(),
            width,
            colorScheme,
            mode,
            axe: 0,
            overflow: false,
          });
        }
        if (width === 1440) {
          await page.evaluate(() => (document.documentElement.style.zoom = '2'));
          const curve = page.locator('.rarity-curve');
          const geometry = await curve.evaluate((el) => {
            const a = el.querySelector('.rarity-marker-label')!.getBoundingClientRect(),
              b = el.querySelector('.rarity-axis')!.getBoundingClientRect();
            return {
              overlap: a.bottom > b.top,
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          expect(geometry).toEqual({ overlap: false, overflow: false });
          await page.screenshot({
            path: `review/round17/rarity-curve/${engine.name()}-200percent-${colorScheme}.png`,
            fullPage: true,
          });
          results.push({ browser: engine.name(), colorScheme, zoom: 200, ...geometry });
        }
        if (width === 390) {
          await page.goto('http://127.0.0.1:5199/?r6');
          await page.locator('#answer').fill('Okapi');
          await page.locator('#answer').press('Enter');
          await expect(page.locator('.claim-payoff .rarity-curve')).toBeVisible();
          const button = page.getByRole('button', { name: 'Next claim', exact: true });
          const box = await button.boundingBox();
          expect(box!.y + box!.height).toBeLessThanOrEqual(844);
          await page.screenshot({
            path: `review/round17/rarity-curve/${engine.name()}-390-payoff-${colorScheme}.png`,
          });
          results.push({
            browser: engine.name(),
            colorScheme,
            width,
            payoffButtonBottom: box!.y + box!.height,
          });
        }
        await context.close();
      }
  } finally {
    await browser.close();
  }
}
writeFileSync('review/round17/visual-qa.json', JSON.stringify({ passed: true, results }, null, 2));
