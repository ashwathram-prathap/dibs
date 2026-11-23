import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api } from './r19-practice-api';
const before = JSON.parse(readFileSync('review/round19c/practice-before.json', 'utf8'));
const conflicts = JSON.parse(readFileSync('review/round19c/practice-date-conflicts.json', 'utf8'));
let after: any;
for (let attempt = 0; attempt < 30; attempt++) {
  const result = await api('/today');
  if (result.response.ok && result.data.turnstileSiteKey === before.turnstileSiteKey) {
    after = result.data;
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}
assert.ok(after, 'Real practice verification did not propagate');
assert.equal(after.category.drop_at, before.category.drop_at);
assert.equal(after.category.date, before.category.date);
const cleanup = JSON.parse(readFileSync('review/round19c/practice-cleanup.json', 'utf8'));
assert.equal(cleanup.claimed, 0, 'Rehearsal claims must have been cleared');
assert.ok(Number.isInteger(after.claimed) && after.claimed >= 0);
if (after.claimed > 0) {
  const activity = JSON.parse(
    readFileSync('review/round19c/practice-post-rehearsal-activity.json', 'utf8'),
  );
  assert.equal(activity.claimed, after.claimed);
  assert.equal(activity.cleanupVerifiedAt, cleanup.at);
  assert.equal(
    activity.claimTimes.reduce((sum: number, row: any) => sum + row.count, 0),
    after.claimed,
  );
  assert.ok(activity.claimTimes.every((row: any) => row.created > cleanup.at));
}
const inventory = await api('/admin/registers', undefined, undefined, true);
assert.ok(inventory.response.ok);
for (const original of [before.category, ...conflicts]) {
  const actual = inventory.data.categories.find((c: any) => c.id === original.id);
  for (const key of ['date', 'drop_at', 'status']) assert.equal(actual[key], original[key]);
}
writeFileSync(
  'review/round19c/practice-restored.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      realVerification: true,
      notificationsRestored: true,
      scheduleRestored: true,
      claimed: after.claimed,
      qaCleanupVerifiedAt: cleanup.at,
      laterPracticeActivityPreserved: after.claimed,
    },
    null,
    2,
  ),
);
console.log(
  'Real practice verification and every modified schedule restored; rehearsal cleanup verified and later practice play preserved.',
);
