// Fail closed: old rounds' passed flags cannot authorize this candidate.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { artifactDigest } from './r19h-artifact';
import { releaseDigest } from './r20-artifact';
import { assertProductionWindow } from '../shared/release-window';
assertProductionWindow();
const proof = JSON.parse(readFileSync('review/round20/release-evidence.json', 'utf8'));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (
  proof.commit !== head ||
  proof.pagesDigest !== artifactDigest('dist') ||
  proof.workerDigest !== releaseDigest('.tmp/r20/bundle') ||
  proof.configDigest !== releaseDigest('worker') ||
  proof.schemaDigest !== artifactDigest('migrations')
)
  throw Error('R20 evidence does not match candidate artifacts/config/schema');
// Owner amendment: no regression against R19I. Missing inherited safeguards are
// documented follow-ups, never fabricated passes.
for (const gate of [
  'correctness',
  'privacy',
  'goldenSecrecy',
  'budget',
  'assets',
  'practice',
  'backup',
  'workingRollback',
  'noRegression',
])
  if (proof.gates?.[gate] !== true) throw Error('R20 required gate missing: ' + gate);
if (
  !proof.rollback?.pages ||
  !proof.rollback?.worker ||
  Date.now() - Date.parse(proof.at) > 3600000
)
  throw Error('Fresh evidence and rollback IDs required');
