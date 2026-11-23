import './test-traffic';
import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r19-practice-api';
import { verifyPreviews } from './r19c-preview-bots';
import { readCategory } from './category-file';
const clock = await api('/today');
assert.ok(clock.response.ok);
assert.equal(
  clock.data.turnstileSiteKey,
  '1x00000000000000000000AA',
  'Practice must have official test verification for rehearsal',
);
const serverNow = Date.parse(clock.response.headers.get('date') || clock.data.serverTime);
const opensAt = new Date(Math.max(Date.now(), serverNow) + 60000).toISOString();
const scheduled = await api('/admin/practice-schedule', { opensAt }, undefined, true);
writeFileSync(
  'review/round19c/practice-scheduling.json',
  JSON.stringify(
    {
      clientNow: new Date().toISOString(),
      serverNow: new Date(serverNow).toISOString(),
      opensAt,
      status: scheduled.response.status,
      response: scheduled.data,
    },
    null,
    2,
  ),
);
assert.ok(
  scheduled.response.ok,
  JSON.stringify({ status: scheduled.response.status, response: scheduled.data }),
);
const result: any = { opensAt, checks: [] };
const browsers = [];
const pages = [];
const catalog = readCategory('categories/animals.json');
try {
  for (const [i, engine] of [chromium, webkit, chromium, webkit, chromium, webkit].entries()) {
    const b = await engine.launch();
    browsers.push(b);
    const p = await b.newPage({
      viewport: { width: i % 2 ? 390 : 1440, height: i % 2 ? 844 : 900 },
      timezoneId: 'America/Toronto',
    });
    let challenge = false;
    let verified = false;
    let status = 0;
    const failures: string[] = [];
    p.on('requestfailed', (r) =>
      failures.push(r.url().split('?')[0] + ': ' + r.failure()?.errorText),
    );
    p.on('pageerror', (e) => failures.push(e.stack || e.message));
    p.on('console', (m) => {
      if (m.type() === 'error') failures.push(m.text());
    });
    p.on('response', (r) => {
      if (r.url().includes('/assets/') && !r.ok())
        failures.push('Asset ' + r.status() + ' ' + r.url());
    });
    p.on('request', (r) => {
      if (r.url().includes('challenges.cloudflare.com')) challenge = true;
    });
    p.on('response', (r) => {
      if (r.url().endsWith('/api/verify-session') && r.ok()) verified = true;
      if (r.url().endsWith('/api/claim')) status = r.status();
    });
    p.on('websocket', (ws) =>
      ws.on('framereceived', (e) => {
        try {
          const d = JSON.parse(String(e.payload));
          if (d.rpc && d.body?.sessionToken) verified = true;
          if (d.rpc && d.body?.claim) status = d.status;
        } catch {}
      }),
    );
    await p.goto(origin);
    await p.locator('.closed-office').waitFor();
    assert.equal(challenge, false, 'Closed state must not load Turnstile');
    pages.push({
      p,
      i,
      engine: engine.name(),
      state: () => ({ challenge, verified, status, failures }),
    });
  }
  console.log('Six fresh same-network browsers ready; opening ' + opensAt);
  for (const item of pages) {
    const { p, i, engine } = item;
    await p.locator('#answer').waitFor({ timeout: 90000 });
    const answer = catalog.answers[1000 + Math.floor(Math.random() * 10000)].display;
    await p.locator('#answer').fill(answer);
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await expect(p.locator('.win-stamp')).toBeVisible({ timeout: 60000 });
    assert.equal(item.state().status, 201);
    assert.ok(item.state().verified);
    assert.ok(item.state().challenge);
    // A returned code must be readable from Settings and restore the same claims.
    await p.locator('.header-settings > summary').click();
    await p.locator('#file-settings > summary').click();
    const code = (await p.locator('.your-backup-code output').innerText()).trim();
    assert.match(code, /^DIBS-(?:[A-F0-9]{5}-){3}[A-F0-9]{5}$/);
    // One restore verifies the issued code; more same-network restores correctly hit the abuse limit.
    if (i === 0) {
      const restored = await api('/recover', { key: code });
      assert.ok(restored.response.ok, `Restore status ${restored.response.status}`);
      const me = await api(
        '/me',
        undefined,
        restored.response.headers.get('set-cookie')!.split(';')[0],
      );
      assert.equal(me.data.file.dibs, 1);
    }
    // Code is never written to the public report or screenshot.
    await p.locator('.settings-close').click();
    await p.screenshot({
      path: `review/round19c/practice-${i}-${engine}-claim.png`,
      fullPage: true,
    });
    result.checks.push({ browser: engine, fresh: true, claimStatus: 201, turnstile: true });
  }
  // Finish one practice scorecard, then exercise every anonymous preview bot.
  const first = pages[0].p;
  await first.getByRole('button', { name: 'Next claim', exact: true }).click();
  for (const answer of [catalog.answers[22000].display, catalog.answers[22001].display]) {
    await first.locator('#answer').fill(answer);
    await first.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    if (answer === catalog.answers[22000].display)
      await first.getByRole('button', { name: 'Next claim', exact: true }).click();
  }
  await expect(first.locator('.win-stamp')).toBeVisible();
  await first.getByRole('button', { name: 'See my results', exact: true }).click();
  await first.locator('.day-certificate').waitFor();
  const state = await first.evaluate(async () =>
    (await fetch('/api/me', { headers: { 'x-dibs-test': '1' } })).json(),
  );
  const ids = { summary: state.file.summaryId, claim: state.file.claims[0].id };
  writeFileSync('review/round19c/practice-preview-ids.json', JSON.stringify(ids, null, 2));
  await verifyPreviews(origin, ids);
  result.passed = true;
} catch (e) {
  result.error = String(e);
  result.diagnostics = await Promise.all(
    pages.map(async (item) => ({
      browser: item.engine,
      state: item.state(),
      screen: await item.p
        .locator('main')
        .innerText()
        .catch(() => ''),
    })),
  );
  for (const item of pages)
    await item.p
      .screenshot({ path: `review/round19c/practice-failed-${item.i}.png`, fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  for (const b of browsers) await b.close();
  writeFileSync('review/round19c/practice-first-visit.json', JSON.stringify(result, null, 2));
  console.log(result);
}
