import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const now = Date.now();
assert.ok(
  now >= Date.parse('2026-11-23T00:00:00-05:00') && now < Date.parse('2026-11-23T14:00:00-05:00'),
  'R17 production window is Monday Nov 23 before 2 PM ET only',
);
const hour = Number(
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now),
);
const minute = Number(
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', minute: '2-digit' }).format(now),
);
assert.ok(
  hour * 60 + minute < 1230 || hour * 60 + minute >= 1320,
  'No deployment between 8:30 and 10 PM ET',
);
execFileSync('git', ['rev-parse', '--verify', 'r16-done'], { stdio: 'ignore' });
const gates = JSON.parse(readFileSync('review/round17/release-gates.json', 'utf8'));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(gates.commit, head, 'Release evidence must match the exact commit');
execFileSync(
  'git',
  ['diff', '--quiet', 'HEAD', '--', 'worker', 'src', 'shared', 'migrations', 'dev', 'public'],
  { stdio: 'ignore' },
);
for (const name of [
  'allTests',
  'restartOneWinner',
  'evictionNoLostClaims',
  'batchedMirrorAtClose',
  'streaksPoints',
  'privacy',
  'noPeek',
  'budget',
  'practice500',
  'deviceMatrix',
  'exportSizes',
  'migrationPreservation',
  'practiceRestored',
  'practiceFirstVisit',
  'visualQA',
  'lighthouse',
])
  assert.equal(gates[name], true, `R17 gate missing or failing: ${name}`);
const read = (name: string) => JSON.parse(readFileSync('review/round17/' + name, 'utf8'));
assert.equal(read('unit-tests.json').numFailedTests, 0);
assert.ok(read('unit-tests.json').numPassedTests >= 179);
for (const name of ['browser-results.json', 'regression-browser-results.json']) {
  const result = read(name).stats;
  assert.equal(result.unexpected, 0);
  assert.equal(result.flaky, 0);
  assert.equal(result.skipped, 0);
  assert.ok(result.expected >= (name.startsWith('regression') ? 576 : 180));
}
assert.equal(read('firefox-final-run.json').conclusion, 'success');
assert.equal(read('load-test.json').passed, true);
assert.equal(read('load-test.json').players, 500);
assert.equal(read('load-test.json').zeroLostClaims, true);
assert.equal(read('load-test.json').zeroDoubleWinners, true);
assert.equal(read('practice-first-visit.json').passed, true);
for (const key of ['realVerification', 'notificationsRestored', 'scheduleRestored'])
  assert.equal(read('practice-restored.json')[key], true);
assert.equal(read('visual-qa.json').passed, true);
const perf = read('lighthouse-practice/summary.json').find((r: any) => r.strategy === 'mobile');
assert.ok(perf.scores.performance >= 90 && perf.scores.accessibility >= 95);
for (const name of ['capacity-after.json', 'capacity-spread.json']) {
  const data = read(name);
  assert.ok(
    data.d1RowsWritten <= 8 &&
      data.doStorageLogicalRows.writes <= 6 &&
      data.d1RowsWritten + data.doStorageLogicalRows.writes <= 12 &&
      data.d1RowsRead < 200,
  );
}
assert.ok(
  read('export-sizes.json')
    .filter((r: any) => r.name.startsWith('after'))
    .every((r: any) => r.bytes < 350000),
);
console.log('R17 gates pass before the deadline.');
