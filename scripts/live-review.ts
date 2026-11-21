import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('review/final', { recursive: true });
const browser = await chromium.launch();
const results: any[] = [];
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      for (const [route, name] of [
        ['/', 'closed-office'],
        ['/archive', 'empty-archive'],
        ['/schools', 'empty-schools'],
        ['/about', 'office-notice'],
        ['/stats', 'stats'],
      ]) {
        await page.goto('https://dibs-7hz.pages.dev' + route);
        await page.locator('main h1').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `review/final/live-${name}-${width}-${theme}.png`,
          fullPage: true,
        });
        const a11y = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        const noOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        results.push({
          route,
          width,
          theme,
          noOverflow,
          violations: a11y.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        });
      }
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync('review/live-accessibility.json', JSON.stringify(results, null, 2));
}
if (results.some((r) => !r.noOverflow || r.violations.length)) process.exitCode = 1;
console.log(
  results.length +
    ' live page checks; ' +
    results.filter((r) => r.noOverflow && !r.violations.length).length +
    ' passed',
);
