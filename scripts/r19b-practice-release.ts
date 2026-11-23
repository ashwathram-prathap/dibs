import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r19-practice-api';
assert.equal(origin, 'https://practice.dibs-7hz.pages.dev');
const budget = JSON.parse(readFileSync('review/round19b/account-write-budget.json', 'utf8'));
assert.ok(
  budget.allowed && Date.now() - Date.parse(budget.checkedAt) < 600000,
  'Refresh account headroom first',
);
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
    '.tmp/r19b/practice-release.log',
    '\n' + name + '\n' + result.stdout + result.stderr,
  );
  steps.push({ name, passed: result.status === 0, at: new Date().toISOString() });
  writeFileSync('review/round19b/practice-release.json', JSON.stringify(steps, null, 2));
  assert.equal(result.status, 0, name + ' failed; see private release log');
}
const ts = (name: string, script: string, args: string[] = []) =>
  run(name, './node_modules/.bin/tsx', [script, ...args]);
writeFileSync(
  'review/round19b/practice-restored.json',
  JSON.stringify({
    realVerification: false,
    notificationsRestored: false,
    scheduleRestored: false,
  }),
);
const before = await api('/today');
assert.ok(before.response.ok && before.data.category?.id === 'practice');
const category = before.data.category;
assert.match(category.drop_at, /^[0-9T:.Z-]+$/);
assert.match(category.date, /^\d{4}-\d{2}-\d{2}$/);
writeFileSync('review/round19b/practice-before.json', JSON.stringify(before.data, null, 2));
const inventory = await api('/admin/registers', undefined, undefined, true);
assert.ok(inventory.response.ok);
const rehearsalDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(Date.now() + 120000));
const conflicts = inventory.data.categories.filter(
  (c: any) => c.id !== 'practice' && c.date === rehearsalDate,
);
for (const c of conflicts) {
  assert.match(c.id, /^[a-zA-Z0-9_-]+$/);
  assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
}
writeFileSync(
  'review/round19b/practice-date-conflicts.json',
  JSON.stringify(
    conflicts.map((c: any) => ({ id: c.id, date: c.date, drop_at: c.drop_at, status: c.status })),
    null,
    2,
  ),
);

run('Back up practice before rehearsal', './node_modules/.bin/wrangler', [
  'd1',
  'export',
  'dibs-db-staging',
  '--remote',
  '-c',
  'worker/wrangler.staging.jsonc',
  '--output',
  '.backups/r19b-practice-rehearsal-before.sql',
]);
let installed = false;
try {
  installed = true;
  ts('Install practice test verification without notifications', 'scripts/r19b-practice-setup.ts', [
    'test',
  ]);
  run(
    'Deploy final practice Worker with already-installed test verification',
    './node_modules/.bin/wrangler',
    [
      'deploy',
      '-c',
      'worker/wrangler.staging.jsonc',
      '--var',
      'TURNSTILE_SITE_KEY:1x00000000000000000000AA',
      '--define',
      'DIBS_PRACTICE_TEST_MODE:true',
    ],
  );
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
  if (conflicts.length)
    run('Temporarily free the rehearsal date in practice only', './node_modules/.bin/wrangler', [
      'd1',
      'execute',
      'dibs-db-staging',
      '--remote',
      '-c',
      'worker/wrangler.staging.jsonc',
      '--command',
      conflicts
        .map((c: any) => `UPDATE categories SET date=NULL WHERE id='${c.id}' AND date='${c.date}';`)
        .join(' '),
    ]);
  assert.ok((await api('/admin/practice-reset', {}, undefined, true)).response.ok);
  ts('Rehearse six fresh browsers from closed to verified claim', 'scripts/r19b-rehearsal.ts');
} finally {
  if (installed) {
    try {
      try {
        assert.ok(
          (await api('/admin/practice-reset', {}, undefined, true)).response.ok,
          'Practice cleanup failed',
        );
      } finally {
        run('Restore original practice schedule', './node_modules/.bin/wrangler', [
          'd1',
          'execute',
          'dibs-db-staging',
          '--remote',
          '-c',
          'worker/wrangler.staging.jsonc',
          '--command',
          `UPDATE categories SET drop_at='${category.drop_at}',date='${category.date}' WHERE id='practice'; ` +
            conflicts
              .map((c: any) => `UPDATE categories SET date='${c.date}' WHERE id='${c.id}';`)
              .join(' '),
        ]);
      }
    } finally {
      try {
        ts('Restore real practice verification', 'scripts/r19b-practice-setup.ts', ['real']);
      } finally {
        // The original opening is past its notification window before alerts return.
        ts('Restore practice notifications', 'scripts/r19b-practice-setup.ts', ['alerts']);
      }
    }
    const after = await api('/today');
    assert.ok(after.response.ok);
    assert.equal(after.data.turnstileSiteKey, before.data.turnstileSiteKey);
    assert.equal(after.data.category.drop_at, category.drop_at);
    assert.equal(after.data.category.date, category.date);
    assert.equal(after.data.claimed, 0);
    const restoredInventory = await api('/admin/registers', undefined, undefined, true);
    assert.ok(restoredInventory.response.ok);
    const schedule = (rows: any[]) =>
      rows
        .map(({ id, date, drop_at, status }) => ({ id, date, drop_at, status }))
        .sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(
      schedule(restoredInventory.data.categories),
      schedule(inventory.data.categories),
      'All practice dates and statuses must be restored',
    );

    writeFileSync(
      'review/round19b/practice-restored.json',
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
