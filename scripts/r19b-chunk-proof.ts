import './test-traffic';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const phase = process.argv[2] || 'after';
const b = await chromium.launch();
const results = [];
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const p = await b.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
      });
      let navigations = 0;
      const errors: string[] = [];
      p.on('pageerror', (e) => errors.push(e.message));
      p.on('request', (r) => {
        if (r.resourceType() === 'document') navigations++;
      });
      await p.route('**/assets/Archive-*.js', (r) => r.abort());
      await p.goto('http://127.0.0.1:5199/?no-analytics=1');
      await p.getByRole('link', { name: 'Archive', exact: true }).first().click();
      await p.waitForTimeout(700);
      const fallback = await p
        .getByRole('heading', { name: 'A new version is available. Reload', exact: true })
        .count();
      await p.screenshot({
        path: `review/round19b/chunk-${phase}-${width}-${theme}.png`,
        fullPage: true,
      });
      if (phase === 'after') {
        assert.equal(fallback, 1);
        assert.equal(navigations, 1);
        assert.equal(await p.getByRole('button', { name: 'Reload', exact: true }).count(), 1);
      }
      results.push({ width, theme, fallback, navigations, errors });
      await p.close();
    }
} finally {
  await b.close();
  writeFileSync(`review/round19b/chunk-${phase}.json`, JSON.stringify(results, null, 2));
}
