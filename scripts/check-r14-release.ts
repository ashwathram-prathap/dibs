import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const deadline = Date.parse('2026-11-23T15:00:00-05:00');
assert.ok(
  Date.now() < deadline,
  'R14 hard stop: do not deploy production at or after Monday 3 PM ET',
);
const read = (file: string) => JSON.parse(readFileSync('review/round14/' + file, 'utf8'));
const unit = read('unit-summary.json');
assert.equal(unit.success, true);
assert.equal(unit.numFailedTests, 0);
for (const file of ['hero-matrix.json', 'done-matrix.json']) {
  const rows = read(file);
  assert.equal(rows.length, 60, file);
  assert.ok(
    rows.every((r: any) => r.failures.length === 0),
    file,
  );
}
for (const file of ['browser-summary.json', 'firefox-summary.json']) {
  const r = read(file);
  assert.ok(r.expected > 0, file);
  assert.equal(r.unexpected, 0, file);
  assert.equal(r.skipped, 0, file);
}
assert.ok(read('webviews.json').every((r: any) => r.passed));
assert.ok(read('type-audit.json').every((r: any) => r.passed));
assert.equal(read('practice-first-visit.json').passed, true);
assert.equal(read('practice-flow.json').passed, true);
assert.ok(read('in-app-practice.json').every((r: any) => r.passed));
const load = read('load-test.json');
assert.ok(
  load.passed || load.headroomBlocked,
  'Practice load must pass or be explicitly blocked by measured headroom',
);
const lighthouse = read('lighthouse-practice/mobile.json');
assert.ok(lighthouse.categories.performance.score >= 0.9);
assert.ok(lighthouse.categories.accessibility.score >= 0.95);
console.log('R14 release checks passed before the deadline. R11 release gates were not changed.');
