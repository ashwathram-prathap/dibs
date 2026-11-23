import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
import { readCategory } from './category-file';
const opensAt = new Date(Date.now() + 45000).toISOString();
assert.ok((await api('/admin/practice-schedule', { opensAt }, undefined, true)).response.ok);
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
    pages.push({ p, i, engine: engine.name(), state: () => ({ challenge, verified, status }) });
  }
  console.log('Six fresh same-network browsers ready; opening ' + opensAt);
  for (const item of pages) {
    const { p, i, engine } = item;
    await p.locator('#answer').waitFor({ timeout: 90000 });
    const answer = catalog.answers[1000 + Math.floor(Math.random() * 10000)].display;
    await p.locator('#answer').fill(answer);
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await expect(p.locator('.win-stamp')).toBeVisible({ timeout: 20000 });
    assert.equal(item.state().status, 201);
    assert.ok(item.state().verified);
    assert.ok(item.state().challenge);
    await p.screenshot({
      path: `review/round16/practice-${i}-${engine}-claim.png`,
      fullPage: true,
    });
    result.checks.push({ browser: engine, fresh: true, claimStatus: 201, turnstile: true });
  }
  result.passed = true;
} catch (e) {
  result.error = String(e);
  process.exitCode = 1;
} finally {
  for (const b of browsers) await b.close();
  writeFileSync('review/round16/practice-first-visit.json', JSON.stringify(result, null, 2));
  console.log(result);
}
