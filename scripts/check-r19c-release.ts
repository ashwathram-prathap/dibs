import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
assert.ok(
  Date.now() < Date.parse('2026-11-23T20:00:00Z'),
  'R19C 3 PM ET deadline passed; do not deploy',
);
if (!process.argv.includes('--timing-only')) {
  const read = (name: string) => JSON.parse(readFileSync('review/round19c/' + name, 'utf8'));
  const gates = read('release-gates.json');
  assert.equal(gates.passed, true);
  execFileSync('git', [
    'diff',
    '--exit-code',
    gates.sourceCommit,
    '--',
    'src',
    'shared',
    'worker',
    'dev',
    'tests',
    'vite.config.ts',
    'package.json',
    'package-lock.json',
    'scripts/admin.ts',
    'scripts/feedback-archive.ts',
    'scripts/build-scores.ts',
    'scripts/popularity-aliases.ts',
  ]);
  for (const [name, value] of Object.entries(gates.gates))
    assert.equal(value, true, name + ' failed');
  assert.equal(read('practice-first-visit.json').passed, true);
  const restored = read('practice-restored.json');
  assert.ok(
    restored.realVerification && restored.notificationsRestored && restored.scheduleRestored,
  );
  const lighthouse = read('lighthouse-practice/mobile-1.json');
  assert.ok(
    lighthouse.categories.performance.score >= 0.9 &&
      lighthouse.categories.accessibility.score >= 0.95,
  );
  assert.equal(read('archive-practice-dry-run.json').passed, true);
  assert.equal(read('build-verification.json').passed, true);
  assert.equal(read('practice-bots-after.json').evidence.length, 15);
}
console.log('R19C release gates and 3 PM ET deadline passed.');
