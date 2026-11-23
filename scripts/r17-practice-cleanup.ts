import { api } from './r11-practice';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const before = JSON.parse(readFileSync('review/round17/practice-before.json', 'utf8'));
assert.ok((await api('/admin/practice-reset', {}, undefined, true)).response.ok);
execFileSync('./node_modules/.bin/tsx', ['scripts/r17-practice-setup.ts', 'real'], {
  stdio: 'inherit',
});
execFileSync('./node_modules/.bin/tsx', ['scripts/r17-practice-setup.ts', 'alerts'], {
  stdio: 'inherit',
});
const after = await api('/today');
assert.ok(after.response.ok);
assert.equal(after.data.turnstileSiteKey, before.turnstileSiteKey);
assert.equal(after.data.claimed, 0);
assert.equal(after.data.category.date, before.category.date);
assert.equal(after.data.category.drop_at, before.category.drop_at);
writeFileSync(
  'review/round17/practice-restored.json',
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
console.log('Practice restored: real verification, original schedule and zero test claims.');
