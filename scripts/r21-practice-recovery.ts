import './test-traffic';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const token = JSON.parse(
  execFileSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], { encoding: 'utf8' }),
).token;
const url =
  'https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/workers/scripts/dibs-api-staging/deployments';
const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
const data: any = await r.json();
assert.ok(r.ok && data.success);
const current = data.result.deployments[0].versions[0].version_id;
const previous = data.result.deployments.find((d: any) => d.versions[0].version_id !== current)
  .versions[0].version_id;
const run = (args: string[]) =>
  execFileSync('./node_modules/.bin/wrangler', args, {
    stdio: 'pipe',
    maxBuffer: 32 * 1024 * 1024,
  });
const state = (after = false) =>
  execFileSync(
    './node_modules/.bin/tsx',
    ['scripts/r19i-practice-state.ts', 'practice', ...(after ? ['--after'] : [])],
    { stdio: 'pipe' },
  );
state();
let rolled = false;
try {
  run(['rollback', previous, '-c', 'worker/wrangler.staging.jsonc', '--yes']);
  rolled = true;
  const response = await fetch('https://practice.dibs-7hz.pages.dev/api/leaderboard');
  assert.ok(response.ok);
  state(true);
} finally {
  if (rolled) run(['deploy', '-c', 'worker/wrangler.staging.jsonc']);
}
state(true);
writeFileSync(
  'review/r21-flow/practice-recovery.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      passed: true,
      previousWorker: previous,
      candidateWorker: current,
      scope:
        'Application rollback/redeploy, public board read and existing mirrored claim/score/schedule preservation; no journal-loss restore, no new test claims, no mixed concurrent clients.',
    },
    null,
    2,
  ),
);
console.log('Practice application rollback and forward recovery passed (legacy committed days only; new-policy coexistence remains blocked)');
