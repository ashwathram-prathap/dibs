import './test-traffic';
import { chromium, webkit } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
const schedule = JSON.parse(readFileSync('review/round11/timed-rehearsal-schedule.json', 'utf8'));
const result: any = { opensAt: schedule.opensAt, checks: [] };
const browsers = await Promise.all([chromium.launch(), webkit.launch()]);
const pages = await Promise.all(
  browsers.map(async (b, i) => {
    const p = await b.newPage({ viewport: { width: i ? 390 : 1440, height: i ? 844 : 900 } });
    await p.goto(origin);
    await p.locator('.closed-office').waitFor();
    return p;
  }),
);
try {
  for (const p of pages)
    await p.screenshot({
      path: `review/round11/rehearsal-${p.viewportSize()!.width}-closed.png`,
      fullPage: true,
    });
  result.checks.push('Chromium desktop and WebKit phone start with the office closed');
  const at = Date.parse(schedule.opensAt);
  while (Date.now() < at) await new Promise((r) => setTimeout(r, Math.min(1000, at - Date.now())));
  await Promise.all(pages.map((p) => p.locator('#answer').waitFor({ timeout: 30000 })));
  result.openedAt = new Date().toISOString();
  result.checks.push('Both open tabs reached zero and opened without reload');
  for (const [i, p] of pages.entries()) {
    await p.locator('#answer').fill(i ? 'Quokka' : 'Okapi');
    const claim = p.waitForResponse((r) => r.url().endsWith('/api/claim'), { timeout: 45000 });
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    const r = await claim;
    assert.equal(r.status(), 201);
    await p.locator('.win-stamp').waitFor();
    await p.screenshot({
      path: `review/round11/rehearsal-${p.viewportSize()!.width}-claimed.png`,
      fullPage: true,
    });
  }
  result.checks.push('Both browsers claimed immediately after opening');
  const monitor = await api('/admin/monitor', {}, undefined, true);
  assert.equal(monitor.response.status, 200);
  result.notificationDelivery = monitor.data;
  const topic = readFileSync('FIXES-R9.md', 'utf8').match(/using topic `([^`]+)`/)![1];
  const r = await fetch(
    'https://ntfy.sh/' + encodeURIComponent(topic) + '/json?poll=1&since=' + Math.floor(at / 1000),
  );
  const events = (await r.text())
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((s) => JSON.parse(s));
  result.alertReceived = events.some(
    (e) => e.message === 'Practice rehearsal — Dibs: Drop is live.',
  );
  assert.ok(result.alertReceived, 'Rehearsal alert not received');
  result.checks.push('Real ntfy Drop is live alert received');
  result.passed = true;
} catch (e) {
  result.error = String(e);
  result.passed = false;
  process.exitCode = 1;
} finally {
  await Promise.all(browsers.map((b) => b.close()));
  writeFileSync('review/round11/timed-rehearsal-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
