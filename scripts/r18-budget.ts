import './test-traffic';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const auth = spawnSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], {
  encoding: 'utf8',
});
assert.equal(auth.status, 0);
const day = new Date().toISOString().slice(0, 10);
const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + JSON.parse(auth.stdout).token,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    query:
      'query($account:string!,$day:Date!){viewer{accounts(filter:{accountTag:$account}){d1AnalyticsAdaptiveGroups(limit:1,filter:{date:$day}){sum{rowsRead rowsWritten}}}}}',
    variables: { account: '5cf62cff0219727f2121253b3924f886', day },
  }),
});
const data: any = await response.json();
assert.ok(response.ok && !data.errors?.length);
const usage = data.data.viewer.accounts[0].d1AnalyticsAdaptiveGroups[0].sum;
assert.ok(Number.isFinite(usage.rowsWritten));
const result = {
  checkedAt: new Date().toISOString(),
  utcDay: day,
  accountWrites: usage.rowsWritten,
  accountReads: usage.rowsRead,
  writeEstimate: 2000,
  safetyCeiling: 70000,
  allowed: usage.rowsWritten + 2000 < 70000,
};
writeFileSync('review/round18/account-write-budget.json', JSON.stringify(result, null, 2));
console.log(result);
assert.ok(result.allowed, 'Insufficient headroom for the small six-browser rehearsal');
