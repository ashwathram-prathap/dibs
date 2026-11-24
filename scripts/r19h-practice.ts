// R19H practice release: deploy the production-origin build to the practice branch, then a
// fresh-visitor closed→live rehearsal of the three-claim flow with official test verification.
// Existing practice claims, schedule, real verification and notifications are restored after.
import './test-traffic';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit, expect, type Page } from '@playwright/test';
import { readCategory } from './category-file';
import { scoreAssetPath } from '../shared/scoring-assets';
import { api, origin } from './r19-practice-api';
import { artifactDigest } from './r19h-artifact';
mkdirSync('.tmp/r19h', { recursive: true });
mkdirSync('review/round19h/practice-rehearsal', { recursive: true });
const config = 'worker/wrangler.staging.jsonc';
const steps: any[] = [];
const deadline = Date.parse('2026-11-24T16:00:00-05:00');
function run(name: string, args: string[], input?: string) {
  assert.ok(Date.now() < deadline, 'R19H go/no-go passed; practice release stops');
  console.log(name);
  const r = spawnSync('./node_modules/.bin/wrangler', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  appendFileSync('.tmp/r19h/practice-release.log', '\n' + name + '\n' + r.stdout + r.stderr);
  steps.push({ name, passed: r.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round19h/practice-release.json', JSON.stringify(steps, null, 2));
  assert.equal(r.status, 0, name + ' failed; see private log');
}
function ts(script: string, args: string[] = []) {
  const r = spawnSync('./node_modules/.bin/tsx', [script, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  appendFileSync('.tmp/r19h/practice-release.log', r.stdout + r.stderr);
  console.log(r.stdout.trim().slice(-2000));
  assert.equal(r.status, 0, script + ' failed; see private log');
}
const unit = JSON.parse(readFileSync('review/round19h/unit-results.json', 'utf8'));
assert.ok(unit.success && unit.numFailedTests === 0);
const local = JSON.parse(readFileSync('review/round19h/browser-results.json', 'utf8'));
assert.ok(
  local.stats.expected > 0 &&
    !local.stats.unexpected &&
    local.stats.skipped <= 12 && // phone-only keyboard test at 768px and up
    !local.stats.flaky,
);
assert.match(readFileSync('dist/index.html', 'utf8'), /https:\/\/dibs\.here/);
// Record the exact artifact practice proves; production must deploy the same bytes.
const digest = artifactDigest('dist');
writeFileSync(
  'review/round19h/practice-artifact.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      digest,
      entry: readFileSync('dist/index.html', 'utf8').match(
        /src="(\/assets\/index-[^"]+\.js)"/,
      )?.[1],
    },
    null,
    2,
  ),
);
ts('scripts/r19h-practice-state.ts', ['practice']);
const old = JSON.parse(readFileSync('.tmp/r19h/practice-state-before.json', 'utf8'));
const original = old.scheduled.find((r: any) => r.id === 'practice');
assert.ok(original);
for (const c of old.scheduled) {
  assert.match(c.id, /^[a-zA-Z0-9_-]+$/);
  assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(c.drop_at, /^[0-9T:.Z-]+$/);
}
run('Back up existing practice records', [
  'd1',
  'export',
  'dibs-db-staging',
  '--remote',
  '-c',
  config,
  '--output',
  '.backups/r19h-practice-before.sql',
]);
run('Publish practice Pages (same artifact production will use)', [
  'pages',
  'deploy',
  'dist',
  '--project-name',
  'dibs',
  '--branch',
  'practice',
  '--commit-dirty=true',
]);
ts('scripts/r19h-assets.ts', [origin]);
ts('scripts/r19h-smoke.ts', [origin]);
const before = await api('/today');
assert.ok(before.response.ok);
const topic = readFileSync('FIXES-R9.md', 'utf8').match(/using topic `([^`]+)`/)?.[1];
assert.ok(topic, 'Original practice notification destination unavailable');
const secret = readFileSync('.dev.vars.staging', 'utf8')
  .match(/^TURNSTILE_SECRET=(.+)$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
const browsers: any[] = [];
const checks: any[] = [];
let installed = false;
async function readFile(p: Page) {
  return p.evaluate(async () =>
    (await fetch('/api/me', { headers: { 'x-dibs-test': '1' } })).json(),
  );
}
async function blockVisible(p: Page) {
  return p.locator('.next-claim').evaluate((block) => {
    const r = block.getBoundingClientRect();
    const v = window.visualViewport!;
    let bottom = v.offsetTop + v.height;
    const nav = document.querySelector<HTMLElement>('.masthead nav');
    if (nav && getComputedStyle(nav).position === 'fixed') {
      const n = nav.getBoundingClientRect();
      if (n.height && n.top > innerHeight / 2) bottom = Math.min(bottom, n.top);
    }
    const tables = [...document.querySelectorAll('table.leaderboard')].filter((t) => {
      const b = t.getBoundingClientRect();
      return b.height > 0 && b.top < innerHeight;
    }).length;
    return r.top >= -1 && r.bottom <= bottom + 1 && (innerWidth >= 768 || tables === 0);
  });
}
try {
  installed = true;
  run(
    'Suppress practice rehearsal alerts',
    ['secret', 'delete', 'NTFY_TOPIC', '-c', config],
    'y\n',
  );
  run(
    'Install official practice test verification secret',
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
  const opensAt = new Date(Date.now() + 75000).toISOString();
  assert.ok((await api('/admin/practice-schedule', { opensAt }, undefined, true)).response.ok);
  const manifest = JSON.parse(readFileSync('public/catalog/animals/manifest.json', 'utf8'));
  const scores = readFileSync('public' + scoreAssetPath('animals', manifest.version));
  const candidates = readCategory('categories/animals.json')
    .answers.map((a: any, i: number) => ({
      answer: a.display as string,
      percentile: scores.readUInt16LE((i + 1) * 2) / 10000,
    }))
    .filter((a: any) => a.percentile > 0.3 && a.percentile < 0.9 && a.answer.length < 18)
    .sort(() => Math.random() - 0.5);
  const pages: { p: Page; label: string; errors: string[]; width: number }[] = [];
  for (const [engine, width, height, colorScheme] of [
    [chromium, 360, 780, 'light'],
    [webkit, 390, 844, 'dark'],
    [chromium, 1440, 900, 'dark'],
  ] as const) {
    const b = await engine.launch();
    browsers.push(b);
    const p = await b.newPage({
      viewport: { width, height },
      colorScheme,
      timezoneId: 'America/Toronto',
      reducedMotion: 'reduce',
    });
    const label = `${engine.name()}-${width}-${colorScheme}`;
    const errors: string[] = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(origin);
    await p.locator('.closed-office').waitFor();
    await expect(p.locator('.closed-office .game-explanation')).toContainText('3 claims a night.');
    await p.screenshot({
      path: `review/round19h/practice-rehearsal/${label}-closed.png`,
      fullPage: true,
    });
    pages.push({ p, label, errors, width });
  }
  console.log('Fresh practice browsers waiting for ' + opensAt);
  let next = 0;
  for (const { p, label, errors, width } of pages) {
    await p.locator('#answer').waitFor({ timeout: 120000 });
    await expect(p.locator('.slots-heading')).toHaveText('Your 3 claims tonight');
    await expect(p.locator('.claim-slots li.open')).toHaveCount(3);
    if (width < 768) await expect(p.locator('table.leaderboard')).toHaveCount(0);
    await p.screenshot({ path: `review/round19h/practice-rehearsal/${label}-live.png` });
    let accepted = 0,
      strikes = 0;
    const flow: any[] = [];
    while (next < candidates.length && accepted < 3) {
      const sample = candidates[next++];
      const beforeClaim = await readFile(p);
      await p.locator('#answer').fill(sample.answer);
      await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
      let state: any;
      await expect
        .poll(
          async () => {
            state = await readFile(p);
            return (
              (state.file?.dibs || 0) > (beforeClaim.file?.dibs || 0) ||
              (state.file?.strikes || 0) > (beforeClaim.file?.strikes || 0)
            );
          },
          { timeout: 60000, intervals: [250, 500, 1000] },
        )
        .toBe(true);
      if (!state.file.claims.some((c: any) => c.display === sample.answer)) {
        // An existing practice claim already holds it: a real strike, never a slot.
        strikes++;
        assert.ok(strikes < 4, 'Too many collisions with preserved practice claims');
        await expect(p.locator('.strike-count')).toContainText(`Strike ${strikes} of 5`);
        await expect(p.locator('.claim-slots li.filled')).toHaveCount(accepted);
        flow.push({ answer: sample.answer, result: 'strike' });
        continue;
      }
      accepted++;
      const slots = await p.locator('.claim-slots .slot-stamp').allTextContents();
      if (accepted < 3) {
        await expect(p.locator('.compact-payoff .win-stamp')).toContainText(
          sample.answer.toUpperCase(),
        );
        await expect(p.locator('.claim-slots li.filled')).toHaveCount(accepted);
        await expect(p.locator('.next-claim-heading')).toHaveText(
          accepted === 1 ? 'Claim 2 of 3 next' : 'Last claim: make it count',
        );
        await expect(p.locator('.next-claim-shortcut')).toHaveText(
          accepted === 1 ? 'Claim #2 →' : 'Last claim →',
        );
        await expect(p.locator('#answer')).toBeFocused();
        assert.ok(await blockVisible(p), 'Next-claim block must be fully visible');
        // Unfinished claimers keep their existing server rank.
        const own = state.file.rank;
        if (width < 768)
          await expect(p.locator('.board-disclosure summary')).toHaveText(
            own ? `Leaderboard · you're #${own} so far` : 'Leaderboard · live standings',
          );
        await p.screenshot({
          path: `review/round19h/practice-rehearsal/${label}-claim${accepted}.png`,
        });
        if (accepted === 1) {
          // Same-night return: the prompt names the remaining claims and focuses the input.
          await p.reload();
          await expect(p.locator('.next-claim-heading')).toHaveText(
            'You have 2 claims left tonight',
          );
          await expect(p.locator('#answer')).toBeFocused();
          await expect(p.locator('.claim-slots li.filled')).toHaveCount(1);
        }
      } else {
        await expect(p.locator('.final-claim-note')).toHaveText(
          "That's 3 of 3. Your day is filed.",
        );
        await expect(p.getByRole('button', { name: 'See my results', exact: true })).toBeFocused();
        await expect(p.locator('#answer')).toHaveCount(0);
        await p.screenshot({ path: `review/round19h/practice-rehearsal/${label}-final.png` });
        await p.getByRole('button', { name: 'See my results', exact: true }).click();
        await expect(p.locator('.day-certificate')).toBeVisible();
        await p.reload();
        await expect(p.locator('.day-certificate')).toBeVisible();
        await expect(p.locator('.next-claim-heading')).toHaveCount(0);
      }
      flow.push({ answer: sample.answer, result: 'claim', slots });
    }
    assert.equal(accepted, 3, 'Complete the practice file');
    assert.deepEqual(errors, []);
    checks.push({ browser: label, passed: true, strikes, flow: flow.map((f) => f.result), errors });
  }
  writeFileSync(
    'review/round19h/practice-first-visit.json',
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
    ts('scripts/r19h-practice-state.ts', ['practice', '--after']);
    writeFileSync(
      'review/round19h/practice-restored.json',
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: true,
          realVerification: true,
          notificationsRestored: true,
          scheduleRestored: true,
          existingClaimsPreserved: old.claims.length,
          qaFiles: checks.length,
        },
        null,
        2,
      ),
    );
  }
}
console.log('R19H practice release, rehearsal and restoration passed.');
