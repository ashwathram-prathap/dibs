import './test-traffic';
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const steps: any[] = [];
function run(name: string, bin: string, args: string[]) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, DIBS_PUBLIC_ORIGIN: 'https://dibs.here' },
  });
  appendFileSync(
    '.tmp/r17/production-release.log',
    '\n' + name + '\n' + result.stdout + result.stderr,
  );
  steps.push({ name, passed: result.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round17/production-release.json', JSON.stringify(steps, null, 2));
  assert.equal(result.status, 0, name + ' failed; production release halted');
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);
const gate = () => ts('Check exact R17 gates and timing', 'scripts/check-r17-release.ts');
let workerChanged = false,
  rolledBack = false;
try {
  gate();
  ts('Record original deployment IDs', 'scripts/r17-deployment-state.ts');
  run('Back up production before migration', 'sh', ['scripts/backup-production.sh']);
  ts('Capture all legacy rows and schedule', 'scripts/r17-preservation.ts');
  gate();
  run('Apply additive migrations', './node_modules/.bin/wrangler', [
    'd1',
    'migrations',
    'apply',
    'dibs-db',
    '--remote',
    '-c',
    'worker/wrangler.jsonc',
  ]);
  ts('Verify exact rows after migration', 'scripts/r17-preservation.ts', ['--verify-after']);
  ts('Verify standard deployment freeze', 'scripts/check-deploy-freeze.ts', ['--production']);
  ts('Configure drop', 'scripts/configure-drop.ts');
  ts('Build house words', 'scripts/build-house-words.ts');
  gate();
  workerChanged = true;
  run('Deploy production Worker', './node_modules/.bin/wrangler', [
    'deploy',
    '-c',
    'worker/wrangler.jsonc',
  ]);
  await new Promise((resolve) => setTimeout(resolve, 10000)); // Allow deployed routes to propagate before smoke.
  const response = await fetch('https://dibs.here/api/bootstrap', { cache: 'no-store' });
  const data: any = await response.json();
  writeFileSync(
    'review/round17/production-read-diagnostic.json',
    JSON.stringify(
      {
        at: new Date().toISOString(),
        status: response.status,
        version: data.version,
        category: data.today?.category?.id || null,
        userPresent: !!data.me?.user,
        nextDrop: data.today?.nextDrop,
      },
      null,
      2,
    ),
  );
  assert.ok(response.ok);
  assert.equal(data.version, 17);
  assert.equal(data.today.category, null);
  assert.equal(data.me.user, null);
  assert.equal(data.today.nextDrop, '2026-11-24T02:00:00.000Z');
  writeFileSync(
    'review/round17/production-test-free-read.json',
    JSON.stringify(
      {
        at: new Date().toISOString(),
        passed: true,
        status: response.status,
        category: data.today.category,
        user: data.me.user,
        nextDrop: data.today.nextDrop,
      },
      null,
      2,
    ),
  );
  run('Build production frontend', 'npm', ['run', 'build']);
  gate();
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
  ts('Read-only production smoke', 'scripts/r17-smoke.ts');
  ts('Verify exact rows after smoke', 'scripts/r17-preservation.ts', ['--verify-after']);
  ts('Record released deployment IDs', 'scripts/r17-deployment-state.ts', ['released']);
  console.log('R17 released; all read-only production and preservation checks passed.');
} catch (error) {
  writeFileSync(
    'review/round17/production-failure.json',
    JSON.stringify(
      { at: new Date().toISOString(), error: String(error), rolledBack: false },
      null,
      2,
    ),
  );
  if (workerChanged) {
    ts('Roll back failed release immediately', 'scripts/r17-smoke.ts', ['--rollback-now']);
    rolledBack = true;
  }
  writeFileSync(
    'review/round17/production-failure.json',
    JSON.stringify({ at: new Date().toISOString(), error: String(error), rolledBack }, null, 2),
  );
  throw error;
}
