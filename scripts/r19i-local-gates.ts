// Summarize real local results without hiding the documented Firefox launch blocker.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const report = JSON.parse(readFileSync('review/round19i/browser-results.json', 'utf8'));
const rows: any[] = [];
function visit(suite: any) {
  for (const spec of suite.specs || [])
    for (const test of spec.tests || []) rows.push({ title: spec.title, ...test });
  for (const child of suite.suites || []) visit(child);
}
visit(report);
assert.deepEqual(report.errors, [], 'Runner-level errors');
const engines = ['chromium', 'webkit', 'firefox'].map((engine) => {
  const tests = rows.filter((r) => r.projectName.startsWith(engine + '-'));
  assert.equal(tests.length, 252, engine + ': complete R19I/R19H matrix');
  const failed = tests.filter((r) => r.status !== 'expected' && r.status !== 'skipped');
  const skipped = tests.filter((r) => r.status === 'skipped');
  assert.ok(
    skipped.every((r) => r.title.includes('with the keyboard open')),
    'Only desktop keyboard checks may skip',
  );
  assert.ok(tests.filter((r) => r.title.startsWith('R19I:')).length === 54);
  const launchBlocked =
    engine === 'firefox' &&
    failed.length > 0 &&
    failed.every((r) =>
      r.results.some((result: any) =>
        result.errors?.some((e: any) => e.message?.includes('Could not find profile folder')),
      ),
    );
  if (engine !== 'firefox') assert.equal(failed.length, 0, engine + ': no failures');
  if (launchBlocked)
    for (const file of ['firefox-launch.log', 'firefox-local-tmp.log', 'firefox-fresh.log'])
      assert.ok(
        readFileSync('.tmp/public-readiness/' + file, 'utf8').includes(
          'Could not find profile folder',
        ),
      );
  return {
    engine,
    passed: failed.length === 0,
    tests: tests.length,
    passedTests: tests.filter((r) => r.status === 'expected').length,
    skipped: skipped.length,
    failed: failed.length,
    blocked: launchBlocked,
    attempts: launchBlocked ? 3 : 1,
  };
});
const firefox = engines.find((r) => r.engine === 'firefox')!;
assert.ok(firefox.passed || firefox.blocked);
const summary = {
  at: new Date().toISOString(),
  source: 'review/round19i/browser-results.json (local Playwright run)',
  chromiumWebkitPassed: engines.filter((r) => r.engine !== 'firefox').every((r) => r.passed),
  firefox,
  engines,
  limitation: firefox.blocked
    ? 'Firefox cannot start on this Mac, including a fresh browser install and a project-local profile. No CI fallback was used.'
    : null,
};
writeFileSync('review/round19i/local-browser-gate.json', JSON.stringify(summary, null, 2) + '\n');
console.log(summary);
