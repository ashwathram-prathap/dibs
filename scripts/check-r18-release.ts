import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { r18DeploymentAllowed, R18_PRODUCTION_DEADLINE } from '../shared/r18-release';
assert.ok(
  r18DeploymentAllowed(),
  'R18 cutoff passed (' + R18_PRODUCTION_DEADLINE + '); ship nothing.',
);
if (!process.argv.includes('--timing-only')) {
  const read = (name: string) => JSON.parse(readFileSync('review/round18/' + name, 'utf8'));
  const evidence = read('release-gates.json');
  assert.equal(evidence.passed, true, 'R18 verification is incomplete');
  for (const name of [
    'unit',
    'browser',
    'regression',
    'firefox',
    'practice',
    'lighthouse',
    'visual',
    'build',
  ])
    assert.equal(evidence.gates[name], true, name + ' gate did not pass');
  assert.equal(read('practice-first-visit.json').passed, true);
  const restore = read('practice-restored.json');
  assert.ok(restore.realVerification && restore.notificationsRestored && restore.scheduleRestored);
}
console.log('R18 release gates and 3 PM ET cutoff passed.');
