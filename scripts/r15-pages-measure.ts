import './test-traffic';
import { chromium, webkit } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const phase = process.argv[2] || 'before';
const origin = 'https://practice.dibs-7hz.pages.dev';
const results: any[] = [];
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  try {
    for (const width of [390, 1440])
      for (const colorScheme of ['light', 'dark'] as const) {
        const c = await b.newContext({
          viewport: { width, height: width === 390 ? 844 : 900 },
          colorScheme,
          timezoneId: 'America/Toronto',
          extraHTTPHeaders: { 'x-r15-measure': phase },
        });
        const p = await c.newPage();
        let requests: string[] = [];
        p.on('request', (r) => {
          const u = new URL(r.url());
          if (u.origin === origin) requests.push(u.pathname);
        });
        const at = new Date().toISOString();
        await p.goto(origin);
        await p.locator('.loading').waitFor({ state: 'hidden' });
        await p.evaluate(() => document.fonts.ready);
        await p.screenshot({
          path: `review/round15/${phase}-${engine.name()}-${width}-${colorScheme}.png`,
          fullPage: true,
        });
        results.push({
          phase,
          engine: engine.name(),
          width,
          colorScheme,
          cache: 'cold',
          at,
          paths: requests,
        });
        requests = [];
        await p.reload();
        await p.locator('.loading').waitFor({ state: 'hidden' });
        await p.waitForTimeout(1500);
        results.push({
          phase,
          engine: engine.name(),
          width,
          colorScheme,
          cache: 'warm',
          at: new Date().toISOString(),
          paths: requests,
        });
        await c.close();
      }
  } finally {
    await b.close();
  }
}
writeFileSync(`review/round15/pages-${phase}.json`, JSON.stringify(results, null, 2));
