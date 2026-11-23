import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = 'review/round19c/';
const read = (name: string) => JSON.parse(readFileSync(root + name, 'utf8'));
const unit = read('unit-results.json');
const reports = [
  ['matrix-browser-results.json', 1440],
  ['firefox-ci/review/round19c/firefox-browser-results.json', 720],
  ['regression-browser-results.json', 416],
  ['final-visual-browser-results.json', 48],
] as const;
const browser = reports.map(([file, expected]) => {
  const r = read(file);
  const stats = r.stats;
  return {
    file,
    required: expected,
    ...stats,
    passed:
      stats.expected === expected &&
      stats.unexpected === 0 &&
      stats.flaky === 0 &&
      stats.skipped === 0,
  };
});
const ci = read('firefox-ci-run.json');
const lh = read('lighthouse-practice/mobile-1.json');
const restored = read('practice-restored.json');
const sheets = read('matrix/manifest.json');
const gates = {
  unitApi: unit.numTotalTests === 230 && unit.numPassedTests === 230 && unit.numFailedTests === 0,
  chromiumWebkitMatrix: browser[0].passed,
  firefoxMatrix: browser[1].passed && ci.conclusion === 'success',
  browserRegressions: browser[2].passed,
  finalVisualAssertions: browser[3].passed,
  practiceRehearsal: read('practice-first-visit.json').passed === true,
  archivePracticeDryRun: read('archive-practice-dry-run.json').passed === true,
  practiceRestored:
    restored.realVerification && restored.notificationsRestored && restored.scheduleRestored,
  practiceAssets: read('practice-asset-integrity.json').passed === true,
  practiceScoreAssets: read('practice-score-assets.json').passed === true,
  previews: read('practice-bots-after.json').evidence.length === 15,
  lighthouse: lh.categories.performance.score >= 0.9 && lh.categories.accessibility.score >= 0.95,
  productionBuild: read('build-verification.json').passed === true,
  contactSheets: sheets.length >= 28 && sheets.every((s: any) => s.combinations === 360),
  visualReview: read('visual-review.json').passed === true,
};
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
// Evidence may be committed afterwards, but the checked application and tests must match CI.
execFileSync('git', [
  'diff',
  '--exit-code',
  ci.headSha,
  '--',
  'src',
  'shared',
  'worker',
  'dev',
  'tests',
  'vite.config.ts',
  'package.json',
  'package-lock.json',
  'playwright.r19c.config.ts',
]);
const result = {
  at: new Date().toISOString(),
  sourceCommit,
  ciCommit: ci.headSha,
  passed: Object.values(gates).every(Boolean),
  gates,
  unit: { total: unit.numTotalTests, passed: unit.numPassedTests },
  browser,
  firefoxRun: ci.url,
  lighthouse: {
    performance: lh.categories.performance.score,
    accessibility: lh.categories.accessibility.score,
  },
  deadline: '2026-11-23T20:00:00Z',
};
writeFileSync(root + 'release-gates.json', JSON.stringify(result, null, 2));
console.log(result);
assert.ok(result.passed, 'R19C remains blocked by incomplete release gates');
