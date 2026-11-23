import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const deadline = '2026-11-23T20:00:00.000Z';
assert.ok(
  Date.now() < Date.parse(deadline),
  'R19 cutoff passed: no production deploy after 3 PM ET.',
);
if (!process.argv.includes('--timing-only')) {
  const read = (name: string) => JSON.parse(readFileSync('review/round19/' + name, 'utf8'));
  const evidence = read('release-gates.json');
  assert.equal(evidence.passed, true, 'R19 verification is incomplete');
  for (const gate of [
    'unit',
    'browser',
    'regression',
    'devices',
    'firefox',
    'text',
    'settings',
    'practice',
    'lighthouse',
    'visual',
    'build',
  ])
    assert.equal(evidence.gates[gate], true, gate + ' gate did not pass');
  assert.equal(read('practice-first-visit.json').passed, true);
  const restore = read('practice-restored.json');
  assert.ok(restore.realVerification && restore.notificationsRestored && restore.scheduleRestored);
}
console.log('R19 release gates and 3 PM ET cutoff passed.');
