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
  appendFileSync('.tmp/r19e/practice-release.log', '\n' + name + '\n' + r.stdout + r.stderr);
  steps.push({ name, passed: r.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round19e/practice-release.json', JSON.stringify(steps, null, 2));
  assert.equal(r.status, 0, name + ' failed; see private log');
}
function ts(script: string, args: string[] = []) {
  const r = spawnSync('./node_modules/.bin/tsx', [script, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  appendFileSync('.tmp/r19e/practice-release.log', r.stdout + r.stderr);
  console.log(r.stdout.trim());
  assert.equal(r.status, 0, script + ' failed; see private log');
}
assert.ok(
  Date.now() < Date.parse('2026-11-23T21:15:00Z'),
  'Insufficient time before R19E deadline',
);
const unit = JSON.parse(readFileSync('review/round19e/unit-results.json', 'utf8'));
assert.ok(unit.success && unit.numFailedTests === 0);
const local = JSON.parse(readFileSync('review/round19e/browser-results.json', 'utf8'));
assert.ok(
  local.stats.expected > 0 && !local.stats.unexpected && !local.stats.skipped && !local.stats.flaky,
);
assert.match(readFileSync('dist/index.html', 'utf8'), /practice\.dibs-7hz\.pages\.dev/);
const config = 'worker/wrangler.staging.jsonc';
const old = JSON.parse(readFileSync('.tmp/r19e/practice-state-before.json', 'utf8'));
const original = old.scheduled.find((r: any) => r.id === 'practice');
assert.ok(original);
for (const c of old.scheduled) {
  assert.match(c.id, /^[a-zA-Z0-9_-]+$/);
  assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(c.drop_at, /^[0-9T:.Z-]+$/);
}
ts('scripts/r19e-budget.ts');
run('Back up existing practice records', [
  'd1',
  'export',
  'dibs-db-staging',
  '--remote',
  '-c',
  config,
  '--output',
  '.backups/r19e-practice-before.sql',
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
writeFileSync('.tmp/r19e/practice-today-before.json', JSON.stringify(before.data), { mode: 0o600 });
const topic = readFileSync('FIXES-R9.md', 'utf8').match(/using topic `([^`]+)`/)?.[1];
assert.ok(topic, 'Original practice notification destination unavailable');
const secret = readFileSync('.dev.vars.staging', 'utf8')
  .match(/^TURNSTILE_SECRET=(.+)$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
const browsers: any[] = [];
const checks: any[] = [];
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
  const samples = JSON.parse(readFileSync('review/round19e/samples.json', 'utf8')).find(
    (c: any) => c.category === 'animals',
  ).rows;
  const candidates = samples.filter(
    (r: any) => r.afterPercentile !== null && r.afterPercentile > 0.12 && r.afterPercentile < 1,
  );
  const pages = [];
  for (const [i, engine] of [chromium, webkit].entries()) {
    const b = await engine.launch();
    browsers.push(b);
    const p = await b.newPage({
      viewport: { width: i ? 390 : 1440, height: i ? 844 : 900 },
      colorScheme: i ? 'dark' : 'light',
      timezoneId: 'America/Toronto',
    });
    const errors: string[] = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(origin);
    await p.locator('.closed-office').waitFor();
    await p.screenshot({
      path: `review/round19e/practice-${engine.name()}-closed.png`,
      fullPage: true,
    });
    pages.push({ p, engine: engine.name(), errors });
  }
  console.log('Two fresh practice browsers waiting for ' + opensAt);
  let next = 0;
  for (const { p, engine, errors } of pages) {
    await p.locator('#answer').waitFor({ timeout: 90000 });
    let accepted = false;
    while (next < candidates.length && !accepted) {
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
      await p.screenshot({ path: `review/round19e/practice-${engine}-scored.png`, fullPage: true });
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
      accepted = true;
    }
    assert.ok(accepted, 'No available practice sanity answer');
  }
  writeFileSync(
    'review/round19e/practice-first-visit.json',
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
    ts('scripts/r19e-state.ts', ['practice', '--after']);
    writeFileSync(
      'review/round19e/practice-restored.json',
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
