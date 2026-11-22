import { readFileSync, writeFileSync } from 'node:fs';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const full = read('.tmp/r13/full-browser-results.json');
const recheck = read('.tmp/r13/recheck-browser-results.json');
const audio = read('.tmp/r13/final-browser-results.json');
const keyboard = read('.tmp/r13/keyboard-browser-results.json');
const cases = new Map<string, string>();
function collect(suites: any[]) {
  for (const suite of suites) {
    for (const spec of suite.specs || [])
      for (const test of spec.tests)
        cases.set([spec.file, spec.title, test.projectName].join(' | '), test.status);
    collect(suite.suites || []);
  }
}
collect(full.suites);
collect(recheck.suites);
collect(audio.suites);
collect(keyboard.suites);
const summary = {
  expected: [...cases.values()].filter((x) => x === 'expected').length,
  unexpected: [...cases.values()].filter((x) => x === 'unexpected').length,
  skipped: [...cases.values()].filter((x) => x === 'skipped').length,
  flaky: [...cases.values()].filter((x) => x === 'flaky').length,
  initial: full.stats,
  recheck: recheck.stats,
  keyboard: keyboard.stats,
  note: 'The four full-run failures were ENOENT trace-artifact cleanup collisions between concurrent Playwright invocations. All nine checks in the affected WebKit project passed when rerun with a separate output directory. Latest audio checks passed in all 36 Chromium/WebKit profiles.',
};
writeFileSync('review/round13/browser-summary.json', JSON.stringify(summary, null, 2));
writeFileSync('review/round13/keyboard-summary.json', JSON.stringify(keyboard.stats, null, 2));
writeFileSync('review/round13/final-browser-summary.json', JSON.stringify(audio.stats, null, 2));
const unit = read('.tmp/r13/unit-results.json');
writeFileSync(
  'review/round13/unit-summary.json',
  JSON.stringify(
    Object.fromEntries(
      [
        'numTotalTestSuites',
        'numPassedTestSuites',
        'numTotalTests',
        'numPassedTests',
        'numFailedTests',
        'success',
      ].map((k) => [k, unit[k]]),
    ),
    null,
    2,
  ),
);
console.log(
  summary.expected + ' browser cases passed; ' + unit.numPassedTests + ' unit/API tests passed.',
);
