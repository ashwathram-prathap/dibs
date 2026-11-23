import './test-traffic';
import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const production = process.argv.includes('--production');
const folder = production ? 'calendar-production' : 'calendar';
const origin = production ? 'https://dibs.here' : 'https://practice.dibs-7hz.pages.dev',
  token = readFileSync(production ? '.dev.vars' : '.dev.vars.staging', 'utf8').match(
    /^ADMIN_TOKEN=(.+)$/m,
  )![1];
mkdirSync('review/round9/' + folder, { recursive: true });
const results: any[] = [];
for (const [engine, name] of [
  [chromium, 'chromium'],
  [webkit, 'webkit'],
] as const) {
  const b = await engine.launch();
  try {
    for (const width of [390, 1440])
      for (const colorScheme of ['light', 'dark'] as const) {
        const context = await b.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          colorScheme,
        });
        const p = await context.newPage();
        await p.goto(origin + '/admin/schedule');
        await p.locator('#schedule-token').fill(token);
        await p.getByRole('button', { name: 'Open calendar', exact: true }).click();
        await p.locator('.calendar-day').first().waitFor();
        await p.locator('#schedule-token').waitFor({ state: 'hidden' });
        assert.equal(await p.locator('.calendar-day').count(), 60);
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const issues = await new AxeBuilder({ page: p })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          [],
        );
        await p.screenshot({
          path: `review/round9/${folder}/${name}-${width}-${colorScheme}.png`,
          fullPage: true,
        });
        await p.getByRole('button', { name: /2026-12-15:/ }).click();
        await p.locator('.calendar-editor').waitFor();
        await p.locator('#topic-search').fill('countries');
        assert.equal(await p.locator('#topic-choice option').count(), 2);
        await p.screenshot({
          path: `review/round9/${folder}/editor-${name}-${width}-${colorScheme}.png`,
          fullPage: true,
        });
        results.push({
          engine: name,
          width,
          colorScheme,
          days: 60,
          noOverflow: true,
          axeViolations: 0,
          librarySearch: true,
        });
        await context.close();
      }
  } finally {
    await b.close();
  }
}
writeFileSync('review/round9/' + folder + '-ui.json', JSON.stringify(results, null, 2));
console.log(results.length + ' calendar UI checks passed');
