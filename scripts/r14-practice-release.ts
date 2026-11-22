import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
assert.equal(origin, 'https://practice.dibs-7hz.pages.dev');
assert.ok(Date.now() >= Date.parse('2026-11-23T00:05:00Z'), 'Wait until 7:05 PM ET');
assert.ok(Date.now() < Date.parse('2026-11-23T20:00:00Z'), 'R14 release deadline passed');
const steps: any[] = [];
function run(name: string, program: string, args: string[], env = process.env, input?: string) {
  console.log(name + '…');
  const result = spawnSync(program, args, {
    env,
    input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  appendFileSync(
    '.tmp/r14/practice-release.log',
    '\n' + name + '\n' + result.stdout + result.stderr,
  );
  steps.push({ name, passed: result.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round14/practice-release.json', JSON.stringify(steps, null, 2));
  assert.equal(result.status, 0, name + ' failed; see private release log');
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);
async function reset() {
  assert.ok(
    (await api('/admin/practice-reset', {}, undefined, true)).response.ok,
    'Practice cleanup failed',
  );
}
run(
  'Apply additive practice score migration',
  './node_modules/.bin/wrangler',
  [
    'd1',
    'migrations',
    'apply',
    'dibs-db-staging',
    '--remote',
    '-c',
    'worker/wrangler.staging.jsonc',
  ],
  process.env,
  'y\n',
);
let installed = false;
try {
  installed = true;
  ts('Install practice test verification and suppress alerts', 'scripts/r14-practice-setup.ts', [
    'test',
  ]);
  run('Build practice frontend', 'npm', ['run', 'build'], {
    ...process.env,
    DIBS_PUBLIC_ORIGIN: origin,
  });
  run('Deploy practice frontend', './node_modules/.bin/wrangler', [
    'pages',
    'deploy',
    'dist',
    '--project-name',
    'dibs',
    '--branch',
    'practice',
    '--commit-dirty=true',
  ]);
  ts('Rehearse closed to live without refresh', 'scripts/r14-rehearsal.ts');
  ts('Verify real practice scores and sharing', 'scripts/r14-practice-flow.ts');
  await reset();
  ts('Verify practice in-app browser flows', 'scripts/r14-inapp.ts');
  ts('Refresh account usage and run guarded 200-player load', 'scripts/r14-load.ts');
} finally {
  if (installed) {
    try {
      await reset();
    } finally {
      ts('Restore real practice verification', 'scripts/r14-practice-setup.ts', ['real']);
      ts('Restore practice notification setting', 'scripts/r14-practice-setup.ts', ['alerts']);
    }
  }
}
ts('Measure deployed practice Lighthouse mobile', 'scripts/lighthouse.ts', [
  origin,
  'review/round14/lighthouse-practice',
]);
console.log('Practice release and verification finished. Production has not been changed.');
