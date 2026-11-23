import './test-traffic';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const deadline = Date.parse('2026-11-24T00:45:00Z');
const steps: any[] = [];
const time = () => assert.ok(Date.now() < deadline, 'R19D 7:45 PM ET hard stop reached');
function run(name: string, program: string, args: string[]) {
  time();
  console.log(name);
  const r = spawnSync(program, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, DIBS_PUBLIC_ORIGIN: 'https://dibs.here' },
  });
  appendFileSync('.tmp/r19d/production-release.log', '\n' + name + '\n' + r.stdout + r.stderr);
  steps.push({ name, passed: r.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round19d/production-release.json', JSON.stringify(steps, null, 2));
  assert.equal(r.status, 0, name + ' failed; see private release log');
  time();
  return r.stdout;
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);
assert.ok(Date.now() < Date.parse('2026-11-24T00:45:00Z'), 'R19D 7:45 PM ET deadline reached');
const report = (name: string) => JSON.parse(readFileSync('review/round19d/' + name, 'utf8'));
const unit = report('unit-results.json');
assert.ok(unit.success && !unit.numFailedTests && unit.numPassedTests >= 250, 'Full unit/API gate');
for (const name of [
  'browser-results.json',
  'visual-browser-results.json',
  'firefox-browser-results.json',
]) {
  const r = report(name);
  assert.ok(
    r.stats.expected > 0 && !r.stats.unexpected && !r.stats.skipped && !r.stats.flaky,
    name + ' must pass',
  );
}
for (const name of [
  'export-proof.json',
  'og-proof.json',
  'practice-first-visit.json',
  'practice-restored.json',
  'practice-state-after.json',
  'printed-links.json',
  'samsung-theme.json',
])
  assert.equal(report(name).passed, true, name + ' must pass');
const lighthouse = report('lighthouse-practice/mobile.json');
assert.ok(
  lighthouse.categories.performance.score >= 0.9 &&
    lighthouse.categories.accessibility.score >= 0.95,
  'Mobile Lighthouse gate',
);
assert.match(readFileSync('dist/index.html', 'utf8'), /https:\/\/dibs\.here/);
let changed = false;
try {
  ts('Record production rollback IDs', 'scripts/r19d-deployment-state.ts');
  ts('Check production data and launch schedule', 'scripts/r19d-state.ts', [
    'production',
    '--after',
  ]);
  run('Back up production before release', 'sh', ['scripts/backup-production.sh']);
  ts('Check explicit R19D deployment window', 'scripts/check-deploy-freeze.ts', [
    '--production',
    '--round19d',
  ]);
  changed = true;
  const output = run('Publish production assets before Worker', './node_modules/.bin/wrangler', [
    'pages',
    'deploy',
    'dist',
    '--project-name',
    'dibs',
    '--branch',
    'main',
    '--commit-dirty=true',
  ]);
  const origin = output.match(/https:\/\/[a-f0-9]+\.dibs-7hz\.pages\.dev/)?.[0];
  assert.ok(origin);
  ts('Preflight immutable deployment scripts', 'scripts/r19d-preflight-assets.ts', [origin]);
  ts('Wait for fresh canonical assets', 'scripts/r19d-assets.ts', [
    'https://dibs.here',
    'dist',
    '--fresh',
  ]);
  ts('Verify coherent production scripts', 'scripts/r19d-assets.ts', ['https://dibs.here']);
  ts('Preserve all current and rollback score assets', 'scripts/r19d-score-assets.ts', [
    'https://dibs.here',
  ]);
  run('Deploy production Worker', './node_modules/.bin/wrangler', [
    'deploy',
    '-c',
    'worker/wrangler.jsonc',
  ]);
  ts('Verify live scoring reads', 'scripts/r19d-worker-check.ts', ['production']);
  ts('Run read-only production browser smoke', 'scripts/r19d-smoke.ts');
  ts('Verify unchanged production data and schedule', 'scripts/r19d-state.ts', [
    'production',
    '--after',
  ]);
  ts('Record released deployment IDs', 'scripts/r19d-deployment-state.ts', ['released']);
  writeFileSync(
    'review/round19d/completed.json',
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
  console.log('R19D deployed and smoke-tested before 7:45 PM ET.');
} catch (error) {
  let rolledBack = false;
  if (changed) {
    const r = spawnSync('./node_modules/.bin/tsx', ['scripts/r19d-smoke.ts', '--rollback-now'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    appendFileSync('.tmp/r19d/rollback.log', r.stdout + r.stderr);
    rolledBack = r.status === 0;
  }
  writeFileSync(
    'review/round19d/production-failure.json',
    JSON.stringify({ at: new Date().toISOString(), error: String(error), rolledBack }, null, 2),
  );
  throw error;
}
