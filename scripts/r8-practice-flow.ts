import { chromium, webkit } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const base = 'https://practice.dibs-7hz.pages.dev';
const officialTestKeys = process.argv.includes('--official-test-keys');
const token = readFileSync('.dev.vars.staging', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
const reset = async () => {
  const r = await fetch(base + '/api/admin/practice-reset', {
    method: 'POST',
    headers: { origin: base, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw Error('Practice reset failed');
};
const results: any[] = [];
const engine = process.argv.includes('--webkit') ? webkit : chromium;
const browser = await engine.launch({ headless: !process.argv.includes('--headed') });
try {
  await reset();
  if (officialTestKeys) {
    const state: any = await (await fetch(base + '/api/bootstrap')).json();
    if (state.today.turnstileSiteKey !== '1x00000000000000000000AA')
      throw Error('Official practice test key is not active');
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base);
  await page.locator('#answer').waitFor();
  const claim = async (answer: string) => {
    await page.locator('#answer').fill(answer);
    const pending = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/claim', {
      timeout: 60000,
    });
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    const r = await pending;
    return { status: r.status(), data: await r.json(), body: r.request().postDataJSON() };
  };
  const first = await claim('Okapi');
  if (first.status !== 201 || !first.data.recoveryKey)
    throw Error('First claim/key failed: ' + JSON.stringify(first.data));
  const firstId = first.data.me.user.id;
  results.push({
    check:
      (officialTestKeys ? 'official testing-key UI' : 'real Turnstile') + ' claim and one-time key',
    passed: true,
  });
  const repeat = await context.request.post(base + '/api/claim', {
    headers: { origin: base },
    data: first.body,
  });
  const repeated: any = await repeat.json();
  results.push({
    check: 'lost-response replay costs no extra dibs',
    passed:
      repeat.status() === 201 &&
      repeated.file.dibs === 1 &&
      repeated.file.strikes === 0 &&
      repeated.claim.id === first.data.claim.id,
  });
  const second = await browser.newContext();
  const restore = await second.request.post(base + '/api/recover', {
    headers: { origin: base },
    data: { key: first.data.recoveryKey },
  });
  const state: any = await (await second.request.get(base + '/api/bootstrap')).json();
  results.push({
    check: 'new browser restores same identity/file',
    passed: restore.ok() && state.me.user.id === firstId && state.me.file.dibs === 1,
  });
  const miss = await claim('Chamelon');
  results.push({
    check: 'typo has no strike and one confirmation',
    passed: miss.status === 422 && miss.data.suggestion === 'Chameleon',
  });
  const missing = await context.request.post(base + '/api/missing', {
    headers: { origin: base },
    data: { answer: 'test missing answer' },
  });
  results.push({ check: 'anonymous clerk submission', passed: missing.ok() });
  const fresh: any = await (await context.request.get(base + '/api/me')).json();
  results.push({
    check: 'typo and missing submission leave strikes unchanged',
    passed: fresh.file.strikes === 0,
  });
  for (let i = 0; i < 6; i++) {
    const r = await second.request.post(base + '/api/recover', {
      headers: { origin: base },
      data: { key: 'DIBS-INVALID' },
    });
    if (i === 5)
      results.push({ check: 'recovery guessing rate limit', passed: r.status() === 429 });
  }
  await page.screenshot({
    path:
      'review/round8/practice-live-flow-' +
      engine.name() +
      (officialTestKeys ? '-testing-key' : '-real-key') +
      '.png',
    fullPage: true,
  });
  await context.close();
  await second.close();
} catch (e) {
  results.push({ check: 'live flow', passed: false, error: String(e) });
} finally {
  await browser.close();
  await reset();
  writeFileSync(
    'review/round8/practice-live-flow-' +
      engine.name() +
      (process.argv.includes('--headed') ? '-headed' : '') +
      (officialTestKeys ? '-testing-key' : '') +
      '.json',
    JSON.stringify(results, null, 2),
  );
}
console.log(results);
if (results.some((r) => !r.passed)) process.exitCode = 1;
