import { readCategory } from './category-file';
import { scoreAssetPath } from '../shared/scoring-assets';
import { rarityPoints } from '../shared/score-points';
import { verifyPreviews } from './r19f-preview-bots';
import './test-traffic';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit, expect } from '@playwright/test';
import { api, origin } from './r19-practice-api';
const steps: any[] = [];
function run(name: string, args: string[], input?: string) {
  console.log(name);
  const r = spawnSync('./node_modules/.bin/wrangler', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  appendFileSync('.tmp/r19f/practice-release.log', '\n' + name + '\n' + r.stdout + r.stderr);
  steps.push({ name, passed: r.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round19f/practice-release.json', JSON.stringify(steps, null, 2));
  assert.equal(r.status, 0, name + ' failed; see private log');
}
function ts(script: string, args: string[] = []) {
  const r = spawnSync('./node_modules/.bin/tsx', [script, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  appendFileSync('.tmp/r19f/practice-release.log', r.stdout + r.stderr);
  console.log(r.stdout.trim());
  assert.equal(r.status, 0, script + ' failed; see private log');
}
assert.ok(
  Date.now() < Date.parse('2026-11-23T23:45:00Z'),
  'Insufficient time before R19F deadline',
);
const unit = JSON.parse(readFileSync('review/round19f/unit-results.json', 'utf8'));
assert.ok(unit.success && unit.numFailedTests === 0);
const local = JSON.parse(readFileSync('review/round19f/browser-results.json', 'utf8'));
assert.ok(
  local.stats.expected > 0 && !local.stats.unexpected && !local.stats.skipped && !local.stats.flaky,
);
assert.match(readFileSync('dist/index.html', 'utf8'), /practice\.dibs-7hz\.pages\.dev/);
const config = 'worker/wrangler.staging.jsonc';
const old = JSON.parse(readFileSync('.tmp/r19f/practice-state-before.json', 'utf8'));
const original = old.scheduled.find((r: any) => r.id === 'practice');
assert.ok(original);
for (const c of old.scheduled) {
  assert.match(c.id, /^[a-zA-Z0-9_-]+$/);
  assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(c.drop_at, /^[0-9T:.Z-]+$/);
}
ts('scripts/r19f-budget.ts');
run('Back up existing practice records', [
  'd1',
  'export',
  'dibs-db-staging',
  '--remote',
  '-c',
  config,
  '--output',
  '.backups/r19f-practice-before.sql',
]);
run('Publish practice assets before Worker', [
  'pages',
  'deploy',
  'dist',
  '--project-name',
  'dibs',
  '--branch',
  'practice',
  '--commit-dirty=true',
]);
ts('scripts/r19e-assets.ts', [origin]);
ts('scripts/r19e-score-assets.ts', [origin]);
run('Deploy practice Worker', ['deploy', '-c', config]);
ts('scripts/r19e-worker-check.ts', ['practice']);
const before = await api('/today');
assert.ok(before.response.ok);
writeFileSync('.tmp/r19f/practice-today-before.json', JSON.stringify(before.data), { mode: 0o600 });
const topic = readFileSync('FIXES-R9.md', 'utf8').match(/using topic `([^`]+)`/)?.[1];
assert.ok(topic, 'Original practice notification destination unavailable');
const secret = readFileSync('.dev.vars.staging', 'utf8')
  .match(/^TURNSTILE_SECRET=(.+)$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
const browsers: any[] = [];
const checks: any[] = [];
const printedLinks: any[] = [];
let installed = false;
try {
  installed = true;
  run(
    'Suppress practice rehearsal alerts',
    ['secret', 'delete', 'NTFY_TOPIC', '-c', config],
    'y\n',
  );
  run(
    'Install official practice verification secret',
    ['secret', 'put', 'TURNSTILE_SECRET', '-c', config],
    '1x0000000000000000000000000000000AA\n',
  );
  run('Deploy practice test verification', [
    'deploy',
    '-c',
    config,
    '--var',
    'TURNSTILE_SITE_KEY:1x00000000000000000000AA',
    '--define',
    'DIBS_PRACTICE_TEST_MODE:true',
  ]);
  for (let i = 0; i < 30; i++) {
    if ((await api('/today')).data.turnstileSiteKey === '1x00000000000000000000AA') break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  assert.equal((await api('/today')).data.turnstileSiteKey, '1x00000000000000000000AA');
  // Temporarily free only the rehearsal date; preserve every existing player and claim.
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const conflicts = old.scheduled.filter((c: any) => c.id !== 'practice' && c.date === date);
  if (conflicts.length)
    run('Free the practice rehearsal date', [
      'd1',
      'execute',
      'dibs-db-staging',
      '--remote',
      '-c',
      config,
      '--command',
      conflicts
        .map((c: any) => `UPDATE categories SET date=NULL WHERE id='${c.id}' AND date='${c.date}';`)
        .join(' '),
    ]);
  const opensAt = new Date(Date.now() + 60000).toISOString();
  assert.ok((await api('/admin/practice-schedule', { opensAt }, undefined, true)).response.ok);
  const manifest = JSON.parse(readFileSync('public/catalog/animals/manifest.json', 'utf8'));
  const scores = readFileSync('public' + scoreAssetPath('animals', manifest.version));
  const candidates = readCategory('categories/animals.json')
    .answers.map((a: any, i: number) => ({
      answer: a.display,
      afterPercentile: scores.readUInt16LE((i + 1) * 2) / 10000,
    }))
    .filter((a: any) => a.afterPercentile > 0.2 && a.afterPercentile < 0.9)
    .map((a: any) => ({ ...a, afterPoints: rarityPoints(a.afterPercentile) }))
    .sort(() => Math.random() - 0.5);
  const pages = [];
  for (const [i, engine] of [chromium, webkit].entries()) {
    const b = await engine.launch();
    browsers.push(b);
    const p = await b.newPage({
      viewport: { width: i ? 390 : 1440, height: i ? 844 : 900 },
      colorScheme: i ? 'dark' : 'light',
      timezoneId: 'America/Toronto',
    });
    await p.addInitScript({ content: 'globalThis.__name = (fn) => fn;' });
    await p.addInitScript(() => {
      (window as any).__printedUrls = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (value, x, y, ...args) {
        if (/^practice\.dibs.*\/(c|summary)\//.test(value))
          (window as any).__printedUrls.push(value);
        return original.call(this, value, x, y, ...args);
      };
    });
    const errors: string[] = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(origin);
    await p.locator('.closed-office').waitFor();
    await p.screenshot({
      path: `review/round19f/practice-${engine.name()}-closed.png`,
      fullPage: true,
    });
    pages.push({ p, engine: engine.name(), errors });
  }
  console.log('Two fresh practice browsers waiting for ' + opensAt);
  let next = 0;
  for (const { p, engine, errors } of pages) {
    await p.locator('#answer').waitFor({ timeout: 90000 });
    let accepted = 0;
    while (next < candidates.length && accepted < 3) {
      const sample = candidates[next++];
      const readFile = () =>
        p.evaluate(async () =>
          (await fetch('/api/me', { headers: { 'x-dibs-test': '1' } })).json(),
        );
      const beforeClaim = await readFile();
      await p.locator('#answer').fill(sample.answer);
      await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
      let state: any;
      await expect
        .poll(
          async () => {
            state = await readFile();
            return (
              (state.file?.dibs || 0) > (beforeClaim.file?.dibs || 0) ||
              (state.file?.strikes || 0) > (beforeClaim.file?.strikes || 0)
            );
          },
          { timeout: 60000, intervals: [250, 500, 1000] },
        )
        .toBe(true);
      // The preserved owner claims may already hold a sample; try another without resetting them.
      const claim = state.file?.claims?.find((c: any) => c.display === sample.answer);
      if (!claim) continue;
      assert.equal(claim.points - (claim.bonus || 0), sample.afterPoints);
      assert.equal(claim.percentile, sample.afterPercentile);
      await expect(p.locator('.claim-payoff')).toContainText('+' + claim.points + ' points');
      await p.screenshot({ path: `review/round19f/practice-${engine}-scored.png`, fullPage: true });
      checks.push({
        engine,
        answer: sample.answer,
        points: claim.points,
        bonus: claim.bonus || 0,
        percentile: claim.percentile,
        passed: true,
        errors,
      });
      assert.deepEqual(errors, []);
      accepted++;
      if (accepted < 3) await p.getByRole('button', { name: 'Next claim', exact: true }).click();
    }
    assert.equal(accepted, 3, 'Complete the practice file');
    await p.getByRole('button', { name: 'See my results', exact: true }).click();
    const state: any = await p.evaluate(async () =>
      (await fetch('/api/me', { headers: { 'x-dibs-test': '1' } })).json(),
    );
    await expect(p.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
    // Record the literal footer strings produced by the image renderer, then type each URL.
    if (await p.getByRole('button', { name: 'More', exact: true }).isVisible())
      await p.getByRole('button', { name: 'More', exact: true }).click();
    const download = p.waitForEvent('download');
    await p.getByRole('button', { name: 'Download image', exact: true }).click();
    await (await download).saveAs(`review/round19f/practice-${engine}-summary.jpg`);
    const captureUrls = await p.evaluate(() => (window as any).__printedUrls || []);
    const summaryPrinted = captureUrls.find((s: string) =>
      s.includes('/summary/' + state.file.summaryId),
    );
    assert.ok(summaryPrinted, 'Summary export must print its full working URL');
    await p.goto('https://' + summaryPrinted);
    await expect(p.locator('.day-certificate')).toContainText(state.file.claims[0].display);
    for (const claim of state.file.claims) {
      await p.goto(origin + '/certificate/' + claim.id);
      const printed = (await p.locator('.certificate .cert-footer').innerText())
        .split('\n')
        .find((s: string) => s.includes('/c/'))!;
      assert.ok(printed.endsWith(claim.id));
      await p.goto('https://' + printed);
      await expect(p.locator('.cert-answer')).toHaveText(claim.display);
      await expect(p.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
      if (await p.getByRole('button', { name: 'More', exact: true }).isVisible())
        await p.getByRole('button', { name: 'More', exact: true }).click();
      const image = p.waitForEvent('download');
      await p.getByRole('button', { name: 'Download image', exact: true }).click();
      await (await image).saveAs(`review/round19f/practice-${engine}-claim-${claim.claim_no}.jpg`);
      const urls = await p.evaluate(() => (window as any).__printedUrls || []);
      assert.ok(urls.includes(printed));
      await p.goto(origin + '/c/' + claim.id.slice(0, 16));
      await expect(p.locator('.cert-answer')).toHaveText(claim.display);
      const publicClaim = await api('/certificate/' + claim.id);
      assert.equal(publicClaim.data.claim.id, claim.id);
      assert.equal(publicClaim.data.claim.display, claim.display);
      // Sharing one claim never publishes other players' or struck answers.
      printedLinks.push({
        engine,
        kind: 'claim',
        printed,
        short: origin + '/c/' + claim.id.slice(0, 16),
        id: claim.id,
        passed: true,
      });
    }
    await verifyPreviews(
      origin,
      { summary: state.file.summaryId, claim: state.file.claims[0].id },
      engine,
    );
    printedLinks.push({
      engine,
      kind: 'summary',
      printed: summaryPrinted,
      id: state.file.summaryId,
      passed: true,
    });
    assert.deepEqual(errors, []);
  }
  writeFileSync(
    'review/round19f/printed-links.json',
    JSON.stringify(
      {
        passed: true,
        production:
          'No production claims exist before launch; the same production-mode handler passed local API tests. Production remains read-only.',
        checks: printedLinks,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    'review/round19f/practice-first-visit.json',
    JSON.stringify({ passed: true, at: new Date().toISOString(), opensAt, checks }, null, 2),
  );
} finally {
  for (const b of browsers) await b.close();
  if (installed) {
    try {
      run('Restore every practice date without resetting claims', [
        'd1',
        'execute',
        'dibs-db-staging',
        '--remote',
        '-c',
        config,
        '--command',
        `UPDATE categories SET date=NULL WHERE id='practice'; ` +
          old.scheduled
            .filter((c: any) => c.id !== 'practice')
            .map((c: any) => `UPDATE categories SET date='${c.date}' WHERE id='${c.id}';`)
            .join(' ') +
          ` UPDATE categories SET date='${original.date}',drop_at='${original.drop_at}' WHERE id='practice';`,
      ]);
    } finally {
      try {
        run(
          'Restore real practice verification secret',
          ['secret', 'put', 'TURNSTILE_SECRET', '-c', config],
          secret + '\n',
        );
        run('Deploy final real-verification practice Worker', ['deploy', '-c', config]);
      } finally {
        run(
          'Restore original practice notification setting',
          ['secret', 'put', 'NTFY_TOPIC', '-c', config],
          topic + '\n',
        );
      }
    }
    let after: any;
    for (let i = 0; i < 30; i++) {
      after = await api('/today');
      if (
        after.data.turnstileSiteKey === before.data.turnstileSiteKey &&
        after.data.category?.date === original.date &&
        after.data.category?.drop_at === original.drop_at
      )
        break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    assert.equal(after.data.turnstileSiteKey, before.data.turnstileSiteKey);
    assert.equal(after.data.category?.date, original.date);
    assert.equal(after.data.category?.drop_at, original.drop_at);
    assert.ok((await api('/admin/r17-flush', {}, undefined, true)).response.ok);
    ts('scripts/r19f-state.ts', ['practice', '--after']);
    writeFileSync(
      'review/round19f/practice-restored.json',
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: true,
          realVerification: true,
          notificationsRestored: true,
          scheduleRestored: true,
          existingClaimsPreserved: old.claims.length,
          qaClaims: checks.length,
        },
        null,
        2,
      ),
    );
  }
}
ts('scripts/r19e-worker-check.ts', ['practice']);
console.log('Practice release and preservation checks passed.');
