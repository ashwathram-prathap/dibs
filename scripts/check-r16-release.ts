import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
assert.ok(
  Date.now() < Date.parse('2026-11-23T15:00:00-05:00'),
  'R16 hard stop: no production release at or after Monday 3 PM ET',
);
const read = (name: string) => JSON.parse(readFileSync('review/round16/' + name, 'utf8'));
assert.equal(read('unit-summary.json').passed, 169);
assert.equal(read('unit-summary.json').failed, 0);
for (const name of ['browser-summary.json', 'firefox-summary.json']) {
  const result = read(name);
  assert.ok(result.expected > 0);
  assert.equal(result.unexpected, 0);
  assert.equal(result.skipped, 0);
  assert.equal(result.flaky, 0);
}
const screens = read('after-metrics.json');
assert.equal(screens.length, 48);
assert.ok(screens.every((r: any) => !r.overflow));
assert.equal(read('practice-first-visit.json').passed, true);
assert.equal(read('practice-restored.json').realVerification, true);
assert.equal(read('practice-restored.json').scheduleRestored, true);
for (const r of read('lighthouse-final-local/summary.json')) {
  assert.ok(r.scores.performance >= (r.strategy === 'mobile' ? 95 : 100));
  for (const category of ['accessibility', 'best-practices', 'seo'])
    assert.equal(r.scores[category], 100);
}
console.log('R16 release checks passed before the deadline. Existing R11 gates are unchanged.');
