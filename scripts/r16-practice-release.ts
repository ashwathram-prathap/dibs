import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
assert.equal(origin, 'https://practice.dibs-7hz.pages.dev');
const steps: any[] = [];
function run(name: string, program: string, args: string[], env = process.env, input?: string) {
  console.log(name);
  const result = spawnSync(program, args, {
    env,
    input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  appendFileSync(
    '.tmp/r16/practice-release.log',
    '\n' + name + '\n' + result.stdout + result.stderr,
  );
  steps.push({ name, passed: result.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round16/practice-release.json', JSON.stringify(steps, null, 2));
  assert.equal(result.status, 0, name + ' failed; see private release log');
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);
const before = await api('/today');
assert.ok(before.response.ok && before.data.category?.id === 'practice');
const category = before.data.category;
assert.match(category.drop_at, /^[0-9T:.Z-]+$/);
assert.match(category.date, /^\d{4}-\d{2}-\d{2}$/);
writeFileSync('review/round16/practice-before.json', JSON.stringify(before.data, null, 2));
run('Back up practice before rehearsal', './node_modules/.bin/wrangler', [
  'd1',
  'export',
  'dibs-db-staging',
  '--remote',
  '-c',
  'worker/wrangler.staging.jsonc',
  '--output',
  '.backups/r16-practice-before.sql',
]);
let installed = false;
try {
  installed = true;
  ts('Install practice test verification and suppress alerts', 'scripts/r16-practice-setup.ts', [
    'test',
  ]);
  run('Build practice frontend', './node_modules/.bin/vite', ['build'], {
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
  assert.ok((await api('/admin/practice-reset', {}, undefined, true)).response.ok);
  ts('Rehearse six fresh browsers from closed to verified claim', 'scripts/r16-rehearsal.ts');
} finally {
  if (installed) {
    try {
      assert.ok(
        (await api('/admin/practice-reset', {}, undefined, true)).response.ok,
        'Practice cleanup failed',
      );
      run('Restore original practice schedule', './node_modules/.bin/wrangler', [
        'd1',
        'execute',
        'dibs-db-staging',
        '--remote',
        '-c',
        'worker/wrangler.staging.jsonc',
        '--command',
        `UPDATE categories SET drop_at='${category.drop_at}',date='${category.date}' WHERE id='practice';`,
      ]);
    } finally {
      try {
        ts('Restore real practice verification', 'scripts/r16-practice-setup.ts', ['real']);
      } finally {
        // The original opening is past its notification window before alerts return.
        ts('Restore practice notifications', 'scripts/r16-practice-setup.ts', ['alerts']);
      }
    }
    const after = await api('/today');
    assert.ok(after.response.ok);
    assert.equal(after.data.turnstileSiteKey, before.data.turnstileSiteKey);
    assert.equal(after.data.category.drop_at, category.drop_at);
    assert.equal(after.data.category.date, category.date);
    assert.equal(after.data.claimed, 0);
    writeFileSync(
      'review/round16/practice-restored.json',
      JSON.stringify(
        {
          at: new Date().toISOString(),
          realVerification: true,
          notificationsRestored: true,
          scheduleRestored: true,
          claimed: 0,
        },
        null,
        2,
      ),
    );
  }
}
