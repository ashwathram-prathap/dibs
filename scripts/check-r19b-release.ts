import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
assert.ok(
  Date.now() < Date.parse('2026-11-23T20:00:00Z'),
  'R19B 3 PM ET deadline passed; do not deploy',
);
if (!process.argv.includes('--timing-only')) {
  const read = (name: string) => JSON.parse(readFileSync('review/round19b/' + name, 'utf8'));
  const release = read('release-gates.json');
  assert.equal(release.passed, true);
  for (const [name, passed] of Object.entries(release.gates))
    assert.equal(passed, true, name + ' failed');
  assert.equal(read('practice-first-visit.json').passed, true);
  const restore = read('practice-restored.json');
  assert.ok(restore.realVerification && restore.notificationsRestored && restore.scheduleRestored);
  const lh = read('lighthouse-practice-final/mobile.json');
  assert.ok(lh.categories.performance.score >= 0.9 && lh.categories.accessibility.score >= 0.95);
  assert.equal(read('practice-bots-after.json').evidence.length, 15);
  assert.ok(read('final-metrics.json').every((row: any) => !row.overflow));
}
console.log('R19B verification gates and 3 PM ET deadline passed.');
