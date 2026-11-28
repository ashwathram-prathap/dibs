// Fail closed: old rounds' passed flags cannot authorize this candidate.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { artifactDigest } from './r19h-artifact';
import { assertProductionWindow } from '../shared/release-window';
assertProductionWindow();
const proof = JSON.parse(readFileSync('review/round20/release-evidence.json', 'utf8'));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (
  proof.commit !== head ||
  proof.pagesDigest !== artifactDigest('dist') ||
  proof.workerDigest !== artifactDigest('.tmp/r20/worker') ||
  proof.configDigest !== artifactDigest('worker') ||
  proof.schemaDigest !== artifactDigest('migrations')
)
  throw Error('R20 evidence does not match candidate artifacts/config/schema');
for (const gate of [
  'correctness',
  'privacy',
  'budget',
  'assets',
  'practice',
  'recovery',
  'mixedVersions',
  'browser',
  'devices',
  'lighthouse',
  'backup',
  'serialization',
])
  if (proof.gates?.[gate] !== true) throw Error('R20 required gate missing: ' + gate);
if (
  !proof.rollback?.pages ||
  !proof.rollback?.worker ||
  Date.now() - Date.parse(proof.at) > 3600000
)
  throw Error('Fresh evidence and rollback IDs required');
