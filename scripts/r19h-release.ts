// R19H guarded production release: Pages only, Worker unchanged, proven practice artifact.
// Every production mutation (deploy and rollback) is preceded by the date-aware R19H guard.
import './test-traffic';
import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { artifactDigest } from './r19h-artifact';
const dir = 'review/round19h/';
mkdirSync('.tmp/r19h', { recursive: true });
const read = (name: string) => JSON.parse(readFileSync(dir + name, 'utf8'));
const log = (text: string) => appendFileSync('.tmp/r19h/production-release.log', text + '\n');
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
  ts(name, 'scripts/check-deploy-freeze.ts', ['--production', '--round19h']);

// Gates: every required check must already be recorded as passing.
const unit = read('unit-results.json');
assert.ok(unit.success && !unit.numFailedTests, 'Unit/API tests');
const browser = read('browser-results.json');
assert.ok(
  browser.stats.expected > 0 &&
    !browser.stats.unexpected &&
    !browser.stats.flaky &&
    !browser.stats.skipped,
  'Chromium/WebKit matrix',
);
const devices = read('device-results.json');
assert.ok(devices.stats.expected > 0 && !devices.stats.unexpected && !devices.stats.flaky);
const firefox = read('firefox-ci-summary.json');
assert.equal(firefox.conclusion, 'success', 'Firefox CI');
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

// Latest go/no-go: no release may start at or after 4:00 PM ET.
ts('Go/no-go (4:00 PM ET)', 'scripts/check-deploy-freeze.ts', [
  '--production',
  '--round19h',
  '--go-no-go',
]);
ts('Capture current rollback point', 'scripts/r19h-deployment-state.ts');
const rollback = read('rollback.json');
run('Production D1 backup (D1 only; not a DO journal backup)', 'sh', [
  'scripts/backup-production.sh',
]);
let changed = false;
try {
  guard('R19H cutoff check before Pages deploy');
  changed = true;
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
  ts('Verify canonical build integrity', 'scripts/r19h-assets.ts', ['https://dibs.here']);
  ts('Read-only live-state production smoke', 'scripts/r19h-smoke.ts', ['https://dibs.here']);
  ts('Record released IDs', 'scripts/r19h-deployment-state.ts', ['--released']);
  const released = read('deployment.json');
  assert.equal(released.workerVersion, rollback.workerVersion, 'Worker must stay unchanged');
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
    guard('R19H cutoff check before rollback');
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
          workerUnchanged: rollback.workerVersion,
          error: String(error),
        },
        null,
        2,
      ),
    );
  }
  throw error;
}
