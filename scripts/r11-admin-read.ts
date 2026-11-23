import './test-traffic';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { origin } from './r11-practice';
const token = readFileSync('.dev.vars.staging', 'utf8')
  .split('\n')
  .find((s) => s.startsWith('ADMIN_TOKEN='))!
  .slice(12)
  .trim()
  .replace(/^['"]|['"]$/g, '');
const b = await chromium.launch(),
  results: any[] = [];
try {
  for (const width of [390, 1440, 2560])
    for (const theme of ['light', 'dark'] as const) {
      const c = await b.newContext({ viewport: { width, height: 900 }, colorScheme: theme }),
        p = await c.newPage();
      for (const route of ['live', 'schedule']) {
        await p.goto(origin + '/admin/' + route);
        await p.locator('#' + (route === 'live' ? 'live' : 'schedule') + '-token').fill(token);
        await p
          .getByRole('button', {
            name: route === 'live' ? 'Open Live' : 'Open calendar',
            exact: true,
          })
          .click();
        await expect(
          p.getByText(
            route === 'live'
              ? 'Free-tier usage'
              : 'Next 60 days · times shown locally · live and past days are locked.',
            { exact: true },
          ),
        ).toBeVisible();
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        const small =
          width < 900
            ? []
            : await p.locator('main *').evaluateAll((els) =>
                els
                  .filter(
                    (e) =>
                      e.getClientRects().length &&
                      [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()) &&
                      parseFloat(getComputedStyle(e).fontSize) < 14,
                  )
                  .map((e) => ({
                    tag: e.tagName,
                    text: e.textContent?.slice(0, 40),
                    size: getComputedStyle(e).fontSize,
                  })),
              );
        const axe = await new AxeBuilder({ page: p })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        results.push({
          route,
          width,
          theme,
          overflow,
          small,
          violations: axe.violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          })),
          passed: !overflow && !small.length && !axe.violations.length,
        });
        await p.screenshot({
          path: `review/round11/practice/admin-${route}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
      await c.close();
    }
} finally {
  await b.close();
  writeFileSync('review/round11/admin-pages.json', JSON.stringify(results, null, 2));
}
console.log(results);
if (results.some((r) => !r.passed)) process.exitCode = 1;
