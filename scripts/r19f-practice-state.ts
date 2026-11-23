import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const auth = spawnSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], {
  encoding: 'utf8',
});
assert.equal(auth.status, 0);
const headers = { authorization: 'Bearer ' + JSON.parse(auth.stdout).token };
async function read(path: string) {
  const r = await fetch(
    'https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/' + path,
    { headers },
  );
  const data: any = await r.json();
  assert.ok(r.ok && data.success);
  return data.result;
}
const [pages, worker] = await Promise.all([
  read('pages/projects/dibs/deployments?env=preview'),
  read('workers/scripts/dibs-api-staging/deployments'),
]);
const active = pages.find((d: any) =>
  d.aliases?.some((a: string) => a.includes('practice.dibs-7hz.pages.dev')),
);
assert.ok(active);
const state = {
  recordedAt: new Date().toISOString(),
  pages: active.id,
  workerVersion: worker.deployments[0].versions[0].version_id,
  workerDeployment: worker.deployments[0].id,
};
writeFileSync('review/round19f/practice-deployment.json', JSON.stringify(state, null, 2));
console.log(state);
