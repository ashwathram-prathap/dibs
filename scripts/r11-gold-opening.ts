import { chromium, webkit, expect } from '@playwright/test';
import { api, origin } from './r11-practice';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const browsers = await Promise.all([chromium.launch(), webkit.launch()]),
  pages: any[] = [],
  result: any = { openings: [], gold: [] };
try {
  assert.ok((await api('/admin/practice-reset', {}, undefined, true)).response.ok);
  const opensAt = new Date(Date.now() + 30000).toISOString();
  assert.ok((await api('/admin/practice-schedule', { opensAt }, undefined, true)).response.ok);
  result.opensAt = opensAt;
  for (const [i, b] of browsers.entries())
    for (const width of [390, 1440])
      for (const theme of ['light', 'dark'] as const) {
        const c = await b.newContext({ viewport: { width, height: 844 }, colorScheme: theme }),
          p = await c.newPage();
        await p.goto(origin);
        await p.locator('.closed-office').waitFor();
        pages.push({ p, browser: i ? 'webkit' : 'chromium', width, theme });
      }
  await Promise.all(
    pages.map(async ({ p, ...meta }) => {
      await p.locator('#answer').waitFor({ timeout: 45000 });
      result.openings.push({ ...meta, openedWithoutReload: true });
    }),
  );
  const r = spawnSync(
    './node_modules/.bin/wrangler',
    [
      'd1',
      'execute',
      'dibs-db-staging',
      '--remote',
      '-c',
      'worker/wrangler.staging.jsonc',
      '--json',
      '--command',
      "SELECT a.display FROM daily_specials d,json_each(d.golden_json) j JOIN answers a ON a.id=j.value WHERE d.category_id='practice'",
    ],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0);
  const names = JSON.parse(r.stdout)[0].results.map((r: any) => r.display);
  assert.ok(names.length >= 2);
  const chosen = [pages[3], pages[4]],
    used = new Set(names);
  const regular = ['Okapi', 'Quokka', 'Pangolin', 'Aardvark', 'Platypus', 'Wombat'].filter(
    (n) => !used.has(n),
  );
  for (const [i, { p, ...meta }] of chosen.entries()) {
    let firstId = '';
    for (const [j, answer] of [names[i], regular[i * 2], regular[i * 2 + 1]].entries()) {
      await p.locator('#answer').fill(answer);
      const req = p.waitForResponse((r: any) => r.url().endsWith('/api/claim'), { timeout: 60000 });
      await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
      const res = await req;
      assert.equal(res.status(), 201);
      const d = await res.json();
      if (j === 0) {
        assert.equal(d.claim.golden, 1);
        firstId = d.claim.id;
        await expect(p.locator('.gold-result .win-stamp')).toBeVisible();
        await p.screenshot({
          path: `review/round11/practice/gold-${meta.browser}-stamp.png`,
          fullPage: true,
        });
      }
      if (j < 2) await p.getByRole('button', { name: 'Next dibs' }).click();
    }
    await p.locator('.day-certificate').waitFor();
    await p.screenshot({
      path: `review/round11/practice/gold-${meta.browser}-day.png`,
      fullPage: true,
    });
    await p.locator(`a.view-certificate[href="/certificate/${firstId}"]`).click();
    await expect(p.locator('.certificate .gold-stamp')).toBeVisible();
    await p.screenshot({
      path: `review/round11/practice/gold-${meta.browser}-certificate.png`,
      fullPage: true,
    });
    result.gold.push({ ...meta, stamp: true, dayCertificate: true, individualCertificate: true });
  }
  result.passed = true;
} catch (e) {
  result.passed = false;
  result.error = String(e);
  process.exitCode = 1;
} finally {
  await Promise.all(browsers.map((b) => b.close()));
  writeFileSync('review/round11/gold-opening.json', JSON.stringify(result, null, 2));
  console.log(result);
}
