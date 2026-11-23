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
])
  assert.equal(gates[name], true, `R17 gate missing or failing: ${name}`);
console.log('R17 gates pass before the deadline.');
