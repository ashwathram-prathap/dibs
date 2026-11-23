import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = (name: string) => JSON.parse(readFileSync('review/round18/' + name, 'utf8'));
const unit = read('unit-tests.json'),
  browser = read('browser-results.json'),
  regression = read('regression-results.json');
const ff = read('firefox-ci/run.json'),
  fb = read('firefox-ci/browser-results.json'),
  fr = read('firefox-ci/firefox-regression-results.json');
const suite = (r: any) =>
  r.stats.unexpected === 0 &&
  r.stats.flaky === 0 &&
  r.stats.expected > 0 &&
  (!r.errors || r.errors.length === 0);
const practice = read('practice-first-visit.json'),
  restored = read('practice-restored.json'),
  ui = read('practice-ui-final.json');
const lighthouse = read('lighthouse-practice/summary.json');
const mobile = lighthouse.find((r: any) => r.strategy === 'mobile');
const gates = {
  unit: unit.success && unit.numFailedTests === 0,
  browser: suite(browser),
  regression: suite(regression),
  firefox: ff.conclusion === 'success' && suite(fb) && suite(fr),
  practice:
    practice.passed &&
    practice.checks.length === 6 &&
    restored.realVerification &&
    restored.notificationsRestored &&
    restored.scheduleRestored &&
    ui.passed,
  lighthouse: mobile.scores.performance >= 90 && mobile.scores.accessibility >= 95,
  visual: read('visual-review.json').passed,
  build: read('build-verification.json').passed,
};
for (const [name, passed] of Object.entries(gates))
  assert.equal(passed, true, name + ' is incomplete');
const result = {
  passed: true,
  at: new Date().toISOString(),
  gates,
  counts: {
    unit: unit.numPassedTests,
    browser: browser.stats.expected,
    regression: regression.stats.expected,
    firefox: fb.stats.expected + fr.stats.expected,
  },
  firefoxRun: ff.url,
  mobileLighthouse: mobile.scores,
};
writeFileSync('review/round18/release-gates.json', JSON.stringify(result, null, 2));
console.log(result);
