import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name: string) => JSON.parse(readFileSync('review/round13/' + name, 'utf8'));
assert.equal(read('unit-summary.json').success, true);
assert.equal(read('unit-summary.json').numFailedTests, 0);
for (const file of ['hero-matrix.json', 'done-matrix.json']) {
  const rows = read(file);
  assert.equal(rows.length, 60, file + ' must include all 15 sizes, two themes and two engines');
  assert.ok(
    rows.every((r: any) => r.failures.length === 0),
    file + ' has failures',
  );
}
assert.equal(read('webviews.json').length, 12);
assert.ok(read('webviews.json').every((r: any) => r.passed));
assert.equal(read('countdown-widths.json').length, 16);
assert.ok(read('countdown-widths.json').every((r: any) => r.passed));
assert.equal(read('type-audit.json').length, 40);
assert.ok(read('type-audit.json').every((r: any) => r.passed));
assert.equal(read('after-metrics.json').length, 40);
assert.ok(read('after-metrics.json').every((r: any) => !r.overflow));
assert.equal(read('decoded-audio.json').length, 2);
assert.ok(read('decoded-audio.json').every((r: any) => r.passed));
for (const file of ['browser-summary.json', 'final-browser-summary.json']) {
  const r = read(file);
  assert.equal(r.unexpected, 0, file);
  assert.equal(r.skipped, 0, file);
  assert.ok(r.expected > 0, file);
}
assert.equal(read('practice-first-visit.json').passed, true);
assert.ok(read('in-app-practice.json').every((r: any) => r.passed));
const firefox = read('firefox-summary.json');
assert.equal(firefox.expected, 60);
assert.equal(firefox.unexpected, 0);
assert.equal(firefox.skipped, 0);
for (const state of ['closed', 'live', 'practice-final']) {
  const r = read(`lighthouse-${state}/mobile.json`);
  assert.ok(r.categories.performance.score >= 0.9);
  assert.ok(r.categories.accessibility.score >= 0.95);
}
console.log(
  'R13 local release gates passed. The accepted R11 infrastructure gates remain unchanged.',
);
