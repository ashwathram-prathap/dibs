import './test-traffic';
import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'review/round19g/';
const read = (name: string) => JSON.parse(readFileSync(dir + name, 'utf8'));
const unit = read('unit-results.json');
assert.ok(unit.success && !unit.numFailedTests);
for (const file of ['browser-results.json']) {
  const r = read(file);
  assert.ok(
    r.stats.expected > 0 && !r.stats.unexpected && !r.stats.flaky && !r.stats.skipped,
    file,
  );
}
const firefox = read('firefox-ci-summary.json');
assert.equal(firefox.conclusion, 'success');
assert.equal(firefox.passed, 24);
assert.ok(read('practice-smoke.json').passed);
const lh = read('lighthouse-practice/mobile.json');
assert.ok(lh.categories.performance.score >= 0.9 && lh.categories.accessibility.score >= 0.95);
assert.match(readFileSync('dist/index.html', 'utf8'), /https:\/\/dibs\.here/);
const steps: any[] = [];
function run(name: string, cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  appendFileSync('.tmp/r19g/production-release.log', '\n' + name + '\n' + r.stdout + r.stderr);
  steps.push({ name, passed: r.status === 0, at: new Date().toISOString() });
  writeFileSync(dir + 'release-steps.json', JSON.stringify(steps, null, 2));
  assert.equal(r.status, 0, name + ' failed; see private release log');
  console.log(name + ': passed');
}
const ts = (name: string, path: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [path, ...args]);
let changed = false;
try {
  ts('Capture current rollback point', 'scripts/r19g-deployment-state.ts');
  run('Production backup', 'sh', ['scripts/backup-production.sh']);
  ts('Check daily deploy freeze', 'scripts/check-deploy-freeze.ts', ['--production', '--round19g']);
  // Publish content first so the unchanged Worker always resolves existing hashed assets.
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
  ts('Verify canonical build integrity', 'scripts/r19g-assets.ts', ['https://dibs.here']);
  ts('Recheck daily deploy freeze', 'scripts/check-deploy-freeze.ts', [
    '--production',
    '--round19g',
  ]);
  run('Deploy production Worker', './node_modules/.bin/wrangler', [
    'deploy',
    '-c',
    'worker/wrangler.jsonc',
  ]);
  ts('Read-only production smoke', 'scripts/r19g-smoke.ts', ['https://dibs.here']);
  ts('Record released IDs', 'scripts/r19g-deployment-state.ts', ['--released']);
} catch (error) {
  if (changed) {
    const ids = read('rollback.json');
    const auth = spawnSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], {
      encoding: 'utf8',
    });
    assert.equal(auth.status, 0, 'Rollback authentication unavailable');
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/pages/projects/dibs/deployments/${ids.pages}/rollback`,
      { method: 'POST', headers: { authorization: 'Bearer ' + JSON.parse(auth.stdout).token } },
    );
    const data: any = await r.json();
    assert.ok(r.ok && data.success, 'Pages rollback needs attention');
    run('Rollback production Worker', './node_modules/.bin/wrangler', [
      'rollback',
      ids.workerVersion,
      '-c',
      'worker/wrangler.jsonc',
      '--yes',
      '--message',
      'R19G release verification failed',
    ]);
    writeFileSync(
      dir + 'rollback-result.json',
      JSON.stringify({ passed: true, at: new Date().toISOString(), error: String(error) }, null, 2),
    );
  }
  throw error;
}
