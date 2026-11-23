import './test-traffic';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const auth = spawnSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], {
  encoding: 'utf8',
});
assert.equal(auth.status, 0, 'Cloudflare authentication unavailable');
const token = JSON.parse(auth.stdout).token;
async function read(path: string) {
  const response = await fetch(
    'https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/' + path,
    { headers: { authorization: 'Bearer ' + token } },
  );
  const data: any = await response.json();
  assert.ok(response.ok && data.success, 'Deployment metadata read failed');
  return data.result;
}
const [pages, worker] = await Promise.all([
  read('pages/projects/dibs'),
  read('workers/scripts/dibs-api/deployments'),
]);
const latest = worker.deployments[0];
assert.equal(latest.versions.length, 1, 'Expected one production Worker version');
const today: any = await (await fetch('https://dibs.here/api/today')).json();
assert.equal(today.category, null, 'Production must still be closed');
assert.equal(today.nextDrop, '2026-11-24T02:00:00.000Z');
const state = {
  pages: pages.canonical_deployment.id,
  workerVersion: latest.versions[0].version_id,
  workerDeployment: latest.id,
  launch: today.nextDrop,
  recordedAt: new Date().toISOString(),
};
const destination = process.argv[2] === 'released' ? 'deployment.json' : 'rollback.json';
writeFileSync('review/round19f/' + destination, JSON.stringify(state, null, 2));
console.log(state);
