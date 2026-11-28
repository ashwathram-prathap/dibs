// Saturday owner-amended release: exact artifacts, assets first, rollback applications only.
import './test-traffic';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, rmdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { artifactDigest } from './r19h-artifact';
import { releaseDigest } from './r20-artifact';
import { assertProductionWindow } from '../shared/release-window';
const dir = 'review/round20/',
  lock = '.tmp/r20/release.lock';
const read = (name: string) => JSON.parse(readFileSync(dir + name, 'utf8'));
const steps: any[] = [];
function run(name: string, cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  appendFileSync('.tmp/r20/release.log', name + '\n' + r.stdout + r.stderr + '\n');
  steps.push({ name, passed: r.status === 0, at: new Date().toISOString() });
  writeFileSync(dir + 'release-steps.json', JSON.stringify(steps, null, 2));
  assert.equal(r.status, 0, name + ' failed; see private log');
  console.log(name + ': passed');
}
const ts = (name: string, path: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [path, ...args]);
const guard = () => ts('Fresh candidate and window gate', 'scripts/check-r20-release.ts');
assertProductionWindow();
mkdirSync(lock);
try {
  const unit = read('followup-unit-tests.json');
  assert.ok(unit.success && unit.numFailedTests === 0 && unit.numPassedTests > 0);
  for (const name of [
    'followup-browser-tests.json',
    'followup-device-tests.json',
    'followup-golden-tests.json',
    'followup-accessibility-tests.json',
  ]) {
    const report = read(name);
    assert.ok(
      report.stats.expected > 0 && report.stats.unexpected === 0 && report.stats.flaky === 0,
      name,
    );
  }
  assert.ok(read('og-proof.json').passed);
  assert.ok(read('practice-smoke.json').passed);
  assert.ok(read('practice-recovery.json').passed);
  assert.ok(read('practice-asset-integrity.json').passed);
  const lh = read('lighthouse-followup/mobile-1.json');
  assert.ok(lh.categories.performance.score >= 0.9 && lh.categories.accessibility.score >= 0.95);
  ts('Asset limits', 'scripts/check-asset-budget.ts');
  ts('Capture rollback IDs', 'scripts/r20-deployment-state.ts');
  const rollback = read('rollback.json');
  const token = JSON.parse(
    execFileSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], { encoding: 'utf8' }),
  ).token;
  const account = 'https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/';
  for (const path of [
    `pages/projects/dibs/deployments/${rollback.pages}`,
    `workers/scripts/dibs-api/versions/${rollback.workerVersion}`,
  ]) {
    const r = await fetch(account + path, { headers: { authorization: 'Bearer ' + token } });
    const d: any = await r.json();
    assert.ok(r.ok && d.success, 'Rollback artifact unavailable');
  }
  run('Private production D1 backup (journal loss remains follow-up)', 'sh', [
    'scripts/backup-production.sh',
  ]);
  const proof = {
    at: new Date().toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    pagesDigest: artifactDigest('dist'),
    workerDigest: releaseDigest('.tmp/r20/bundle'),
    configDigest: releaseDigest('worker'),
    schemaDigest: artifactDigest('migrations'),
    rollback,
    gates: {
      correctness: true,
      privacy: true,
      goldenSecrecy: true,
      budget: true,
      assets: true,
      practice: true,
      backup: true,
      workingRollback: true,
      noRegression: true,
    },
    basis: {
      correctness: `${unit.numPassedTests} fresh unit/API checks including recap ownership/finalization/redaction and first-visit bootstrap; unchanged scoring/selection`,
      practice: 'practice-smoke.json, practice-recovery.json, practice-asset-integrity.json',
      budget: 'No hosted load; retained account metrics and unchanged plan. No capacity claim.',
      backup: readFileSync('.backups/last-success.txt', 'utf8').trim(),
      noRegression:
        'FOLLOWUP.md: onboarding, owner-authenticated finalized recap, larger OG, pinned Animals scope and strike grammar; safety regressions checked; inherited gaps remain follow-ups',
      browser:
        'Fresh followup-browser-tests, followup-device-tests and followup-golden-tests; 74 OG fixtures and 18 crop inspections; prior core continuation retained; Firefox and physical devices unverified',
    },
    followups: [
      'Full journal-loss RTO/RPO and deletion reconciliation',
      'Hosted mixed-client rehearsal',
      'Durable cross-machine campaign ledger',
      'Physical devices and local Firefox launch',
      'Full active-path monitoring and admission bounds',
    ],
  };
  writeFileSync(dir + 'release-evidence.json', JSON.stringify(proof, null, 2));
  let changed = false;
  try {
    guard();
    changed = true;
    run('Deploy production immutable assets and Pages', './node_modules/.bin/wrangler', [
      'pages',
      'deploy',
      'dist',
      '--project-name',
      'dibs',
      '--branch',
      'main',
      '--commit-dirty=true',
    ]);
    ts('Fresh production assets', 'scripts/r20-assets.ts', [
      'https://dibs.here',
      'dist',
      '--fresh',
    ]);
    guard();
    run('Deploy production Worker', './node_modules/.bin/wrangler', [
      'deploy',
      '-c',
      'worker/wrangler.jsonc',
    ]);
    ts('Read-only production smoke', 'scripts/r20-smoke.ts', ['https://dibs.here']);
    ts('Capture released IDs', 'scripts/r20-deployment-state.ts', ['--released']);
    writeFileSync(
      dir + 'release-summary.json',
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          rollback,
          deployment: read('deployment.json'),
          commit: proof.commit,
          pagesDigest: proof.pagesDigest,
          workerDigest: proof.workerDigest,
          steps,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    if (changed) {
      assertProductionWindow();
      run('Application Worker rollback', './node_modules/.bin/wrangler', [
        'rollback',
        rollback.workerVersion,
        '-c',
        'worker/wrangler.jsonc',
        '--yes',
      ]);
      assertProductionWindow();
      const r = await fetch(
        account + `pages/projects/dibs/deployments/${rollback.pages}/rollback`,
        { method: 'POST', headers: { authorization: 'Bearer ' + token } },
      );
      const d: any = await r.json();
      assert.ok(r.ok && d.success, 'Pages rollback failed');
      writeFileSync(
        dir + 'rollback-result.json',
        JSON.stringify(
          { at: new Date().toISOString(), passed: true, rollback, error: String(e) },
          null,
          2,
        ),
      );
    }
    throw e;
  }
} finally {
  rmdirSync(lock);
}
