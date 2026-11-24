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
  const r = await fetch(
    'https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/' + path,
    { headers: { authorization: 'Bearer ' + token } },
  );
  const data: any = await r.json();
  assert.ok(r.ok && data.success, 'Deployment metadata unavailable');
  return data.result;
}
const [pages, worker] = await Promise.all([
  read('pages/projects/dibs'),
  read('workers/scripts/dibs-api/deployments'),
]);
const latest = worker.deployments[0];
assert.equal(latest.versions.length, 1);
const state = {
  pages: pages.canonical_deployment.id,
  workerVersion: latest.versions[0].version_id,
  workerDeployment: latest.id,
  recordedAt: new Date().toISOString(),
};
writeFileSync(
  `review/round19g/${process.argv.includes('--released') ? 'deployment' : 'rollback'}.json`,
  JSON.stringify(state, null, 2),
);
console.log(state);
