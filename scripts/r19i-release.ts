// R19I guarded production release: Worker and practice-proven Pages artifact.
// Every production mutation (deploy and rollback) is preceded by the date-aware R19I guard.
import './test-traffic';
import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { artifactDigest } from './r19h-artifact';
const dir = 'review/round19i/';
mkdirSync('.tmp/r19i', { recursive: true });
const read = (name: string) => JSON.parse(readFileSync(dir + name, 'utf8'));
const log = (text: string) => appendFileSync('.tmp/r19i/production-release.log', text + '\n');
const steps: any[] = [];
function run(name: string, cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  log('\n' + name + '\n' + r.stdout + r.stderr);
  steps.push({ name, passed: r.status === 0, at: new Date().toISOString() });
  writeFileSync(dir + 'release-steps.json', JSON.stringify(steps, null, 2));
  assert.equal(r.status, 0, name + ' failed; see private release log');
  console.log(name + ': passed');
}
const ts = (name: string, path: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [path, ...args]);
const guard = (name: string) =>
  ts(name, 'scripts/check-deploy-freeze.ts', ['--production', '--round19i']);

// Gates: every required check must already be recorded as passing.
const unit = read('unit-results.json');
assert.ok(unit.success && !unit.numFailedTests, 'Unit/API tests');
const browserGate = JSON.parse(readFileSync('review/round19i/local-browser-gate.json', 'utf8'));
assert.equal(browserGate.chromiumWebkitPassed, true, 'Required Chromium/WebKit browser checks');
assert.ok(
  browserGate.firefox.passed || (browserGate.firefox.blocked && browserGate.firefox.attempts === 3),
  'Firefox must pass or be documented blocked after three local attempts',
);
const devices = JSON.parse(readFileSync('review/round19i/device-results.json', 'utf8'));
assert.ok(
  devices.stats.expected > 0 && !devices.stats.unexpected && !devices.stats.flaky,
  'Local device flows',
);
assert.ok(read('practice-smoke.json').passed, 'Practice smoke');
assert.ok(read('practice-first-visit.json').passed, 'Practice closed→live rehearsal');
assert.ok(read('practice-restored.json').passed, 'Practice restored');
const lh = read('lighthouse-practice/mobile.json');
assert.ok(
  lh.categories.performance.score >= 0.9 && lh.categories.accessibility.score >= 0.95,
  'Lighthouse mobile',
);
assert.match(readFileSync('dist/index.html', 'utf8'), /https:\/\/dibs\.here/);
// Reuse exactly the artifact that practice verified; never rebuild for production.
const proven = read('practice-artifact.json');
assert.equal(artifactDigest('dist'), proven.digest, 'dist differs from the practice-proven build');

// Reserve at least 30 minutes for release, read-only smoke and rollback.
assert.ok(Date.now() < Date.parse('2026-11-24T16:30:00-05:00'), 'Insufficient time before cutoff');
ts('R19I production cutoff', 'scripts/check-deploy-freeze.ts', ['--production', '--round19i']);
ts('Capture current rollback point', 'scripts/r19i-deployment-state.ts');
const rollback = read('rollback.json');
run('Production D1 backup (D1 only; not a DO journal backup)', 'sh', [
  'scripts/backup-production.sh',
]);
let changed = false;
try {
  guard('R19I cutoff check before Worker deploy');
  changed = true;
  run('Deploy production Worker', './node_modules/.bin/wrangler', [
    'deploy',
    '-c',
    'worker/wrangler.jsonc',
  ]);
  guard('R19I cutoff check before Pages deploy');
  run('Deploy production Pages', './node_modules/.bin/wrangler', [
    'pages',
    'deploy',
    'dist',
    '--project-name',
    'dibs',
    '--branch',
    'main',
    '--commit-dirty=true',
  ]);
  ts('Wait for fresh canonical assets (cache-bypassed)', 'scripts/r19i-assets.ts', [
    'https://dibs.here',
    'dist',
    '--fresh',
  ]);
  ts('Verify canonical build integrity', 'scripts/r19i-assets.ts', ['https://dibs.here']);
  ts('Read-only live-state production smoke', 'scripts/r19i-smoke.ts', ['https://dibs.here']);
  ts('Record released IDs', 'scripts/r19i-deployment-state.ts', ['--released']);
  const released = read('deployment.json');
  assert.notEqual(released.workerVersion, rollback.workerVersion, 'Worker must include R19I');
  assert.notEqual(released.pages, rollback.pages, 'A new Pages deployment must be canonical');
  writeFileSync(
    dir + 'release-summary.json',
    JSON.stringify(
      { passed: true, at: new Date().toISOString(), rollback, deployment: released, steps },
      null,
      2,
    ),
  );
} catch (error) {
  if (changed) {
    // Rollback is a production mutation too: the cutoff guard applies.
    guard('R19I cutoff check before rollback');
    run('Roll back production Worker', './node_modules/.bin/wrangler', [
      'rollback',
      rollback.workerVersion,
      '-c',
      'worker/wrangler.jsonc',
      '--yes',
    ]);
    guard('R19I cutoff check before Pages rollback');
    const auth = spawnSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], {
      encoding: 'utf8',
    });
    assert.equal(auth.status, 0, 'Rollback authentication unavailable');
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/pages/projects/dibs/deployments/${rollback.pages}/rollback`,
      { method: 'POST', headers: { authorization: 'Bearer ' + JSON.parse(auth.stdout).token } },
    );
    const data: any = await r.json();
    assert.ok(r.ok && data.success, 'Pages rollback needs attention');
    writeFileSync(
      dir + 'rollback-result.json',
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          pages: rollback.pages,
          workerVersion: rollback.workerVersion,
          error: String(error),
        },
        null,
        2,
      ),
    );
  }
  throw error;
}
