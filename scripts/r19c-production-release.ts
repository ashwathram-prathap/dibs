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
    '.tmp/r19c/production-release.log',
    '\n' + name + '\n' + result.stdout + result.stderr,
  );
  steps.push({ name, passed: result.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round19c/production-release.json', JSON.stringify(steps, null, 2));
  assert.equal(result.status, 0, name + ' failed; production release halted');
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);
const gate = () => ts('Check exact R19C gates and timing', 'scripts/check-r19c-release.ts');
let workerChanged = false,
  rolledBack = false;
try {
  gate();
  ts('Record original deployment IDs', 'scripts/r19c-deployment-state.ts');
  gate();
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
  run('Build production frontend', 'npm', ['run', 'build']);
  await new Promise((resolve) => setTimeout(resolve, 10000)); // Let the new admin route propagate.
  const response = await fetch('https://dibs.here/api/bootstrap', { cache: 'no-store' });
  const data: any = await response.json();
  writeFileSync(
    'review/round19c/production-read-diagnostic.json',
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
  assert.equal(typeof data.version, 'number');
  assert.equal(data.today.category, null);
  assert.equal(data.me.user, null);
  assert.equal(data.today.nextDrop, '2026-11-24T02:00:00.000Z');
  writeFileSync(
    'review/round19c/production-test-free-read.json',
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
  ts('Verify deployed script artifacts', 'scripts/r19c-assets.ts', ['https://dibs.here']);
  ts('Read-only production smoke', 'scripts/r19c-smoke.ts');
  ts('Record released deployment IDs', 'scripts/r19c-deployment-state.ts', ['released']);
  console.log('R19C released; all read-only production checks passed.');
} catch (error) {
  writeFileSync(
    'review/round19c/production-failure.json',
    JSON.stringify(
      { at: new Date().toISOString(), error: String(error), rolledBack: false },
      null,
      2,
    ),
  );
  if (workerChanged) {
    ts('Roll back failed release immediately', 'scripts/r19c-smoke.ts', ['--rollback-now']);
    rolledBack = true;
  }
  writeFileSync(
    'review/round19c/production-failure.json',
    JSON.stringify({ at: new Date().toISOString(), error: String(error), rolledBack }, null, 2),
  );
  throw error;
}
