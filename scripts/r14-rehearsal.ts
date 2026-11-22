import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
const result: any = { checks: [], errors: [] };
const status = await api('/today');
let at = status.data.nextDrop;
{
  // Always use a short isolated practice opening for this release check.
  const next = new Date(Date.now() + 90000).toISOString();
  assert.ok((await api('/admin/practice-reset', {}, undefined, true)).response.ok);
  assert.ok(
    (await api('/admin/practice-schedule', { opensAt: next }, undefined, true)).response.ok,
  );
  at = next;
}
result.opensAt = at;
const verified: boolean[] = [];
const challengeLoaded: boolean[] = [];
const browsers = await Promise.all([chromium.launch(), webkit.launch()]);
try {
  const pages = await Promise.all(
    browsers.map(async (b, i) => {
      const p = await b.newPage({
        viewport: { width: i ? 390 : 1440, height: i ? 844 : 900 },
        timezoneId: 'America/Toronto',
      });
      p.on('response', (r) => {
        if (r.url().endsWith('/api/verify-session') && r.ok()) verified[i] = true;
      });
      p.on('request', (r) => {
        if (r.url().includes('challenges.cloudflare.com')) challengeLoaded[i] = true;
      });
      await p.goto(origin);
      await p.locator('.closed-office').waitFor();
      await expect(p.locator('.game-explanation')).toContainText('One category a day.');
      await p.screenshot({ path: `review/round14/practice-${i}-closed.png`, fullPage: true });
      return p;
    }),
  );
  result.checks.push(
    'First visit: Chromium desktop and WebKit phone start closed with the new explanation',
  );
  console.log('Waiting for the scheduled practice opening at ' + at);
  await Promise.all(
    pages.map((p) =>
      p
        .locator('#answer')
        .waitFor({ timeout: Math.max(30000, Date.parse(at) - Date.now() + 45000) }),
    ),
  );
  result.openedAt = new Date().toISOString();
  result.checks.push('Both tabs opened automatically at zero without reloading');
  for (const [i, p] of pages.entries()) {
    await expect.poll(() => verified[i], { timeout: 30000 }).toBe(true);
    assert.ok(challengeLoaded[i], 'Turnstile loaded from Cloudflare');
    await p.locator('#answer').fill(i ? 'Quokka' : 'Okapi');
    const response = p.waitForResponse((r) => r.url().endsWith('/api/claim'));
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    assert.equal((await response).status(), 201);
    await expect(p.locator('.win-stamp')).toBeVisible();
    await p.screenshot({ path: `review/round14/practice-${i}-claimed.png`, fullPage: true });
  }
  result.checks.push('Both claimed successfully with official test Turnstile');
  result.passed = true;
} catch (e) {
  result.error = String(e);
  result.passed = false;
  process.exitCode = 1;
} finally {
  await Promise.all(browsers.map((b) => b.close()));
  writeFileSync('review/round14/practice-first-visit.json', JSON.stringify(result, null, 2));
  console.log(result);
}
