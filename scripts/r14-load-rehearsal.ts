import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';

assert.equal(origin, 'https://practice.dibs-7hz.pages.dev');
const config = 'worker/wrangler.staging.jsonc';
const steps: any[] = [];
function run(name: string, program: string, args: string[], input?: string) {
  console.log(name);
  const result = spawnSync(program, args, { input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  appendFileSync('.tmp/r14/load-rehearsal.log', '\n' + name + '\n' + result.stdout + result.stderr);
  steps.push({ name, passed: result.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round14/load-rehearsal.json', JSON.stringify(steps, null, 2));
  assert.equal(result.status, 0, name + ' failed; see private log');
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);

ts('Check account headroom before practice changes', 'scripts/r14-load.ts', ['--budget-only']);
const budget = JSON.parse(readFileSync('review/round14/account-write-budget.json', 'utf8'));
if (!budget.allowed) process.exit(0);
// The already-open practice schedule remains untouched. No frontend or production deployment.
const before = await api('/today');
assert.ok(before.response.ok && before.data.category?.id === 'practice');
assert.ok(
  Date.now() > Date.parse(before.data.category.drop_at) + 125000,
  'Do not interfere with the opening notification window',
);
const topic = readFileSync('FIXES-R9.md', 'utf8').match(/using topic `([^`]+)`/)?.[1];
assert.ok(topic, 'Original practice notification setting unavailable');
assert.ok(
  readFileSync('.backups/r14-practice-before-load.sql', 'utf8').length > 100,
  'Back up existing practice records before resetting',
);
try {
  ts(
    'Install official practice test verification and suppress alerts',
    'scripts/r14-practice-setup.ts',
    ['test'],
  );
  ts(
    'Refresh account headroom and run 200 players with leaderboard polling',
    'scripts/r14-load.ts',
  );
} finally {
  try {
    const reset = await api('/admin/practice-reset', {}, undefined, true);
    assert.ok(reset.response.ok, 'Practice cleanup failed');
    steps.push({ name: 'Clear practice test players', passed: true, at: new Date().toISOString() });
  } finally {
    try {
      ts(
        'Restore real practice verification using current R15 code',
        'scripts/r14-practice-setup.ts',
        ['real'],
      );
    } finally {
      run(
        'Restore original practice notifications',
        './node_modules/.bin/wrangler',
        ['secret', 'put', 'NTFY_TOPIC', '-c', config],
        topic + '\n',
      );
    }
  }
  const after = await api('/today');
  assert.ok(after.response.ok);
  assert.equal(after.data.turnstileSiteKey, before.data.turnstileSiteKey);
  assert.deepEqual(after.data.category, before.data.category);
  assert.equal(after.data.claimed, 0);
  steps.push({
    name: 'Verify real key, original schedule and empty practice board',
    passed: true,
    at: new Date().toISOString(),
  });
  writeFileSync('review/round14/load-rehearsal.json', JSON.stringify(steps, null, 2));
}
