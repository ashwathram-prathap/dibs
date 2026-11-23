import './test-traffic';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('review/final', { recursive: true });
const browser = await chromium.launch();
const results: any[] = [];
const identities = new Set<string>();
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      let apiErrors: { url: string; status: number }[] = [];
      page.on('response', async (response) => {
        if (response.url().includes('/api/') && response.status() >= 400)
          apiErrors.push({ url: response.url(), status: response.status() });
        if (response.url() === 'https://dibs.here/api/me') {
          try {
            const data = await response.json();
            if (typeof data.user?.id === 'string') identities.add(data.user.id);
          } catch {}
        }
      });
      for (const [route, name] of [
        ['/', 'closed-office'],
        ['/archive', 'empty-archive'],
        ['/about', 'office-notice'],
        ['/stats', 'stats'],
      ]) {
        apiErrors = [];
        await page.goto('https://dibs.here' + route);
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
          apiErrors,
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
  writeFileSync('review/live-qa-identities.json', JSON.stringify([...identities]));
  writeFileSync('review/live-accessibility.json', JSON.stringify(results, null, 2));
}
if (results.some((r) => !r.noOverflow || r.violations.length)) process.exitCode = 1;
console.log(
  results.length +
    ' live layout/accessibility checks (API availability reported separately); ' +
    results.filter((r) => r.noOverflow && !r.violations.length).length +
    ' passed',
);
