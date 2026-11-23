import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const steps: any[] = [];
function run(name: string, program: string, args: string[]) {
  console.log(name);
  const result = spawnSync(program, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  appendFileSync(
    '.tmp/r16/production-release.log',
    '\n' + name + '\n' + result.stdout + result.stderr,
  );
  steps.push({ name, passed: result.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round16/production-release.json', JSON.stringify(steps, null, 2));
  assert.equal(result.status, 0, name + ' failed; see private release log');
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);
const deadline = () =>
  assert.ok(Date.now() < Date.parse('2026-11-23T15:00:00-05:00'), 'R16 production deadline passed');
ts('Verify release gates', 'scripts/check-r16-release.ts');
ts('Refresh rollback point', 'scripts/r16-deployment-state.ts');
ts('Check production freeze', 'scripts/check-deploy-freeze.ts', ['--production']);
ts('Configure unchanged production opening', 'scripts/configure-drop.ts');
ts('Build house words', 'scripts/build-house-words.ts');
deadline();
run('Deploy production Worker', './node_modules/.bin/wrangler', [
  'deploy',
  '-c',
  'worker/wrangler.jsonc',
]);
run('Build production frontend', 'npm', ['run', 'build']);
deadline();
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
ts('Smoke production and roll back immediately on failure', 'scripts/r16-smoke.ts', [
  '--rollback-on-failure',
]);
ts('Record released versions', 'scripts/r16-deployment-state.ts', ['released']);
ts('Verify player rows and schedule preservation', 'scripts/r16-preservation.ts', [
  '--verify-after',
]);
