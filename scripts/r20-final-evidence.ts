import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { artifactDigest } from './r19h-artifact';
const token = JSON.parse(
  execFileSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], { encoding: 'utf8' }),
).token;
const before = JSON.parse(readFileSync('review/round20/starting-deployment.json', 'utf8'));
async function read(path: string) {
  const r = await fetch(
    'https://api.cloudflare.com/client/v4/accounts/' + before.account + '/' + path,
    { headers: { authorization: 'Bearer ' + token } },
  );
  const d: any = await r.json();
  assert.ok(r.ok && d.success, 'Read-only deployment metadata unavailable');
  return d.result;
}
const [p, w] = await Promise.all([
  read('pages/projects/dibs'),
  read('workers/scripts/dibs-api/deployments'),
]);
const after = {
  at: new Date().toISOString(),
  pages: p.canonical_deployment.id,
  workerDeployment: w.deployments[0].id,
  workerVersion: w.deployments[0].versions[0].version_id,
};
assert.equal(after.pages, before.pages);
assert.equal(after.workerDeployment, before.worker.id);
assert.equal(after.workerVersion, before.worker.versions[0].version_id);
writeFileSync('review/round20/ending-deployment.json', JSON.stringify(after, null, 2));
const report = {
  at: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  pagesDigest: artifactDigest('dist'),
  workerDigest: artifactDigest('.tmp/r20/worker'),
  workerSourceConfigDigest: artifactDigest('worker'),
  schemaDigest: artifactDigest('migrations'),
  browserDigest: artifactDigest('.tmp/r20/browser-dist'),
  productionUnchanged: true,
  releaseAllowed: false,
  reason:
    'Required retained assets exceed 10 MB. Hosted practice/recovery and remaining correctness/budget gates incomplete. This is NOT release-evidence.json.',
};
writeFileSync('review/round20/candidate-evidence.json', JSON.stringify(report, null, 2));
console.log({ commit: report.commit, productionUnchanged: true, releaseAllowed: false, after });
