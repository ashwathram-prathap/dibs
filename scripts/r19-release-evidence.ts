import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = (name: string) => JSON.parse(readFileSync('review/round19/' + name, 'utf8'));
const unit = read('unit-tests.json'),
  browser = read('browser-results.json'),
  regression = read('regression-results.json'),
  devices = read('device-results.json');
const suite = (r: any) =>
  r.stats.unexpected === 0 &&
  r.stats.flaky === 0 &&
  r.stats.expected > 0 &&
  (!r.errors || r.errors.length === 0);
const ff = read('firefox-ci/run.json'),
  fb = read('firefox-ci/browser-results.json'),
  fr = read('firefox-ci/firefox-regression-results.json'),
  fd = read('firefox-ci/firefox-device-results.json');
const text = [...read('text/local.json'), ...read('firefox-ci/text/firefox.json')];
const settings = [
  ...read('settings/after.json'),
  ...read('firefox-ci/settings/firefox-after.json'),
];
const practice = read('practice-first-visit.json'),
  restored = read('practice-restored.json');
const timing = read('claim-timing-after.json');
const mobile = read('lighthouse-practice/summary.json').find((r: any) => r.strategy === 'mobile');
const gates = {
  unit: unit.success && unit.numFailedTests === 0,
  browser: suite(browser),
  regression: suite(regression),
  devices: suite(devices),
  firefox: ff.conclusion === 'success' && suite(fb) && suite(fr) && suite(fd),
  text: text.length === 294 && text.every((r: any) => !r.failures.length && !r.overflow),
  settings:
    settings.length === 120 &&
    settings.every((r: any) => !r.violations.length && !r.documentOverflow),
  practice:
    practice.passed &&
    practice.checks.length === 6 &&
    restored.realVerification &&
    restored.notificationsRestored &&
    restored.scheduleRestored &&
    timing.length === 6 &&
    timing.every((r: any) => r.verificationRequests === 1 && r.proofClaimRequests === 3),
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
    devices: devices.stats.expected,
    firefox: fb.stats.expected + fr.stats.expected + fd.stats.expected,
    textCases: text.length,
    textBlocks: text.reduce((n: any, r: any) => n + r.checked, 0),
    settings: settings.length,
  },
  firefoxRun: ff.url,
  mobileLighthouse: mobile.scores,
};
writeFileSync('review/round19/release-gates.json', JSON.stringify(result, null, 2));
console.log(result);
