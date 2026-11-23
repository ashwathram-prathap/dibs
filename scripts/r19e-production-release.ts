import './test-traffic';
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const deadline = Date.parse('2026-11-23T21:30:00Z');
const steps: any[] = [];
const time = () => assert.ok(Date.now() < deadline, 'R19E 4:30 PM ET hard stop reached');
function run(name: string, program: string, args: string[]) {
  time();
  console.log(name);
  const result = spawnSync(program, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, DIBS_PUBLIC_ORIGIN: 'https://dibs.here' },
  });
  appendFileSync(
    '.tmp/r19e/production-release.log',
    '\n' + name + '\n' + result.stdout + result.stderr,
  );
  steps.push({ name, passed: result.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round19e/production-release.json', JSON.stringify(steps, null, 2));
  assert.equal(result.status, 0, name + ' failed; see private release log');
  time();
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);
assert.ok(
  Date.now() < Date.parse('2026-11-23T21:15:00Z'),
  'Not enough time to deploy and smoke-test before 4:30 PM',
);
const report = (name: string) => JSON.parse(readFileSync('review/round19e/' + name, 'utf8'));
const unit = report('unit-results.json');
assert.ok(
  unit.success && unit.numFailedTests === 0 && unit.numPassedTests >= 238,
  'Unit/API suite must pass',
);
for (const name of ['browser-results.json', 'firefox-browser-results.json']) {
  const r = report(name);
  assert.ok(
    r.stats.expected > 0 && !r.stats.unexpected && !r.stats.skipped && !r.stats.flaky,
    name + ' must pass',
  );
}
for (const name of [
  'practice-score-assets.json',
  'practice-worker-scores.json',
  'practice-first-visit.json',
  'practice-restored.json',
  'practice-state-after.json',
])
  assert.equal(report(name).passed, true, name + ' must pass');
const lighthouse = report('lighthouse-practice/summary.json').find(
  (r: any) => r.strategy === 'mobile',
);
assert.ok(
  lighthouse.scores.performance >= 90 && lighthouse.scores.accessibility >= 95,
  'Lighthouse mobile gate',
);
assert.match(readFileSync('dist/index.html', 'utf8'), /https:\/\/dibs\.here/);
let changed = false;
try {
  ts('Record production rollback IDs', 'scripts/r19e-deployment-state.ts');
  ts('Verify production state before release', 'scripts/r19e-state.ts', ['production', '--after']);
  ts('Check launch freeze', 'scripts/check-deploy-freeze.ts', ['--production']);
  changed = true;
  run('Publish production assets before Worker', './node_modules/.bin/wrangler', [
    'pages',
    'deploy',
    'dist',
    '--project-name',
    'dibs',
    '--branch',
    'main',
    '--commit-dirty=true',
  ]);
  ts('Verify coherent production scripts', 'scripts/r19e-assets.ts', ['https://dibs.here']);
  ts('Verify every current and rollback scoring asset', 'scripts/r19e-score-assets.ts', [
    'https://dibs.here',
  ]);
  run('Deploy production Worker', './node_modules/.bin/wrangler', [
    'deploy',
    '-c',
    'worker/wrangler.jsonc',
  ]);
  ts('Verify live production scoring reads', 'scripts/r19e-worker-check.ts', ['production']);
  ts('Read-only production desktop/phone smoke', 'scripts/r19e-smoke.ts');
  ts('Verify production data and schedule preservation', 'scripts/r19e-state.ts', [
    'production',
    '--after',
  ]);
  ts('Record released production IDs', 'scripts/r19e-deployment-state.ts', ['released']);
  writeFileSync(
    'review/round19e/completed.json',
    JSON.stringify(
      {
        passed: true,
        at: new Date().toISOString(),
        deadline: new Date(deadline).toISOString(),
        beforeHardStop: Date.now() < deadline,
      },
      null,
      2,
    ),
  );
  console.log('R19E deployed and smoke-tested before 4:30 PM ET.');
} catch (error) {
  let rolledBack = false;
  if (changed) {
    // Emergency rollback is permitted even if the deadline expired during a provider operation.
    const result = spawnSync(
      './node_modules/.bin/tsx',
      ['scripts/r19e-smoke.ts', '--rollback-now'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    appendFileSync('.tmp/r19e/production-release.log', result.stdout + result.stderr);
    rolledBack = result.status === 0;
  }
  writeFileSync(
    'review/round19e/production-failure.json',
    JSON.stringify({ at: new Date().toISOString(), error: String(error), rolledBack }, null, 2),
  );
  throw error;
}
