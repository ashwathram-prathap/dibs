import { chromium, expect } from '@playwright/test';
import { api, origin } from './r11-practice';
import { writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const checks: string[] = [];
const reset = async () =>
  assert.ok((await api('/admin/practice-reset', {}, undefined, true)).response.ok);
const account = async () => {
  const r = await api('/bootstrap');
  return r.response.headers.get('set-cookie')!.split(';')[0];
};
const claim = (cookie: string, answer: string, requestId = crypto.randomUUID()) =>
  api('/claim', { answer, requestId, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }, cookie);
try {
  await reset();
  const [a, b] = await Promise.all([account(), account()]);
  const race = await Promise.all([claim(a, 'Okapi'), claim(b, 'Okapi')]);
  assert.deepEqual(race.map((r) => r.response.status).sort(), [201, 409]);
  const winner = race.find((r) => r.response.status === 201)!.data.claim;
  assert.equal(race.find((r) => r.response.status === 409)!.data.takenBy, winner.handle);
  checks.push('Two simultaneous players: exactly one winner, loser names that winner');
  const c = await account(),
    id = crypto.randomUUID();
  const double = await Promise.all([claim(c, 'Quokka', id), claim(c, 'Quokka', id)]);
  assert.ok(double.every((r) => r.response.status === 201));
  assert.equal(double[0].data.claim.id, double[1].data.claim.id);
  assert.equal(double[1].data.file.dibs, 1);
  checks.push('Double-tap idempotency returns one claim');
  const key = crypto.randomUUID();
  const first = await claim(c, 'Cat', key),
    again = await claim(c, 'Cat', key);
  assert.equal(first.response.status, 409);
  assert.equal(again.data.file.strikes, 1);
  checks.push('Retrying a taken request adds no second strike');
  assert.equal((await claim(c, 'Pangolin', key)).response.status, 422);
  checks.push('Replaying an ID with a different answer is rejected');
  const lurker = await account();
  const ledger = await api('/ledger?category=practice', undefined, lurker);
  assert.deepEqual(ledger.data.rows, []);
  const cert = await api('/certificate/' + winner.id, undefined, lurker);
  assert.ok(!JSON.stringify(cert.data).includes('Okapi'));
  const html = await (await fetch(origin + '/certificate/' + winner.id)).text();
  assert.ok(!html.includes('Okapi'));
  checks.push('Before closure: no claimed answers in ledger API, certificate API or HTML');
  for (let i = 0; i < 5; i++) assert.equal((await claim(lurker, 'Cat')).response.status, 409);
  assert.equal((await claim(lurker, 'Pangolin')).response.status, 403);
  assert.ok((await api('/ledger?category=practice', undefined, lurker)).data.rows.length >= 2);
  checks.push('Five RESERVED strikes close the file and reveal the ledger');
  await reset();
  await api('/bootstrap');
  const g = spawnSync(
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
      "SELECT a.display FROM daily_specials d,json_each(d.golden_json) j JOIN answers a ON a.id=j.value WHERE d.category_id='practice' LIMIT 1",
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(g.status, 0);
  const name = JSON.parse(g.stdout)[0].results[0].display;
  const golden = await claim(await account(), name);
  assert.equal(golden.response.status, 201);
  assert.equal(golden.data.claim.golden, 1);
  checks.push('Known golden answer from private practice draw earns gold');
  const accentedName = name === 'Okapi' ? 'Quokka' : 'Okapi';
  const accented = await claim(await account(), accentedName === 'Okapi' ? 'Ókápi' : 'Qúókká');
  assert.equal(accented.response.status, 201);
  assert.equal(accented.data.claim.display, accentedName);
  checks.push('Accented input resolves to the canonical animal');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
      p = await context.newPage();
    let verify = p.waitForResponse((r) => r.url().endsWith('/api/verify-session') && r.ok());
    await p.goto(origin);
    await verify;
    await p.locator('#answer').fill('Pangolin');
    await context.setOffline(true);
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await expect(p.locator('.result-panel')).toContainText('The clerk didn’t get that');
    await context.setOffline(false);
    const r = p.waitForResponse((r) => r.url().endsWith('/api/claim'));
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    assert.equal((await r).status(), 201);
    checks.push('Offline claim preserves input; retry wins once');
    await p.getByRole('button', { name: 'Next dibs' }).click();
    await reset();
    await p.locator('#answer').fill('Okapi');
    const retry = p.waitForResponse((r) => r.url().endsWith('/api/claim') && r.status() === 201);
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    assert.equal((await (await retry).json()).file.strikes, 0);
    await expect(p.locator('.session-notice')).toContainText('Practice was reset');
    checks.push('Stale session after practice reset renews without a strike');
    await p.getByRole('button', { name: 'Next dibs' }).click();
    await p.locator('#answer').fill('pangoln');
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await p.getByRole('button', { name: 'Did you mean PANGOLIN?' }).click();
    await expect(p.locator('.win-stamp')).toContainText('PANGOLIN');
    checks.push('Confirming the spelling suggestion makes the intended claim');
    const socket = await p.evaluate(
      async () =>
        new Promise<any>((resolve, reject) => {
          const w = new WebSocket(location.origin.replace('https', 'wss') + '/api/live');
          w.onopen = () => w.send(JSON.stringify({ category: 'practice', since: 0, version: 0 }));
          w.onmessage = (e) => {
            resolve(JSON.parse(e.data));
            w.close();
          };
          w.onerror = reject;
          setTimeout(() => reject(Error('socket timeout')), 15000);
        }),
    );
    assert.deepEqual(socket.rows, []);
    checks.push('No-peek socket sends no rows to an open file');
    await p.getByRole('button', { name: 'Next dibs' }).click();
    await context.route('**/api/claim', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await p.locator('#answer').fill('Quokka');
    const slow = p.waitForResponse((r) => r.url().endsWith('/api/claim'));
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await expect(p.getByRole('button', { name: 'Filing…', exact: true })).toBeDisabled();
    assert.equal((await slow).status(), 201);
    checks.push('Slow claim disables duplicate submission');
    await context.close();
    const blocked = await browser.newContext();
    await blocked.route('**/api/**', async (route) => {
      const headers = { ...route.request().headers() };
      delete headers.cookie;
      await route.continue({ headers });
    });
    const bp = await blocked.newPage();
    await bp.goto(origin);
    await bp.locator('#answer').fill('Quokka');
    await bp.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await expect(bp.locator('.result-panel')).toContainText('Cookies are required', {
      timeout: 45000,
    });
    checks.push('Blocked cookies receive actionable clerk guidance');
    await blocked.close();
  } finally {
    await browser.close();
  }
  writeFileSync(
    'review/round11/practice-edge.json',
    JSON.stringify({ passed: true, checks }, null, 2),
  );
  console.log(checks);
} catch (e) {
  writeFileSync(
    'review/round11/practice-edge.json',
    JSON.stringify({ passed: false, checks, error: String(e) }, null, 2),
  );
  throw e;
}
