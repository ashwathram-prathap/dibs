import './test-traffic';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
assert.equal(origin, 'https://practice.dibs-7hz.pages.dev', 'Load testing is practice-only');
const players = 200,
  writeEstimate = 20000;
const now = new Date();
assert.ok(now.getTime() >= Date.parse('2026-11-23T00:05:00Z'), 'Wait until Sunday 7:05 PM ET');
// Use the daily aggregate for every database, without query-shape truncation or
// a rounded rolling window. Keep the interactive credential in memory only.
const auth = spawnSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], {
  encoding: 'utf8',
});
assert.equal(auth.status, 0, 'Account-wide D1 usage unavailable; do not run load');
const day = now.toISOString().slice(0, 10);
const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + JSON.parse(auth.stdout).token,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    query: `query($account:string!,$day:Date!){viewer{accounts(filter:{accountTag:$account}){
      d1AnalyticsAdaptiveGroups(limit:1,filter:{date:$day}){sum{rowsRead rowsWritten}}
      durableObjectsPeriodicGroups(limit:1,filter:{date:$day}){sum{rowsRead rowsWritten duration}}
    }}}`,
    variables: { account: '5cf62cff0219727f2121253b3924f886', day },
  }),
});
const analytics: any = await response.json();
assert.ok(
  response.ok && !analytics.errors?.length,
  'Account-wide analytics failed; do not run load',
);
const account = analytics.data?.viewer?.accounts?.[0];
const usageRows = account?.d1AnalyticsAdaptiveGroups?.[0]?.sum;
const writes = usageRows?.rowsWritten;
assert.ok(Number.isFinite(writes) && writes >= 0, 'Missing D1 write total; do not run load');
const budget = {
  checkedAt: now.toISOString(),
  utcDay: day,
  source: 'Cloudflare account-wide daily D1 aggregate; no database filter',
  accountWrites: writes,
  accountReads: usageRows.rowsRead,
  durableObjectUsage: account?.durableObjectsPeriodicGroups?.[0]?.sum,
  writeEstimate,
  safetyCeiling: 70000,
  freeDailyLimit: 100000,
  estimatedRemainingWrites: 100000 - writes - writeEstimate,
  allowed: writes + writeEstimate <= 70000,
};
writeFileSync('review/round14/account-write-budget.json', JSON.stringify(budget, null, 2));
console.log(JSON.stringify(budget));
if (writes + writeEstimate > 70000) {
  writeFileSync(
    'review/round14/load-test.json',
    JSON.stringify(
      {
        passed: false,
        blocked: true,
        headroomBlocked: true,
        reason:
          'Account-wide writes plus the conservative test estimate would leave less than 30% of the daily quota. No load requests sent.',
        accountWrites: writes,
        writeEstimate,
        players,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (process.argv.includes('--budget-only')) process.exit(0);
const before = await api('/bootstrap');
assert.equal(before.data.today.turnstileSiteKey, '1x00000000000000000000AA');
assert.ok(before.data.today.category);
const reset = await api('/admin/practice-reset', {}, undefined, true);
assert.ok(reset.response.ok);
const usage = await api('/admin/live', undefined, undefined, true);
assert.ok(usage.response.ok);
const start = Date.now(),
  samples: any[] = [],
  polls: any[] = [],
  arrivals: number[] = [],
  errors: any[] = [],
  winners = new Set<string>();
let winnerCookie = '';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
await Promise.all(
  Array.from({ length: players }, async (_, i) => {
    await pause(i * 300);
    arrivals.push(Date.now() - start);
    try {
      const boot = await api('/bootstrap');
      assert.ok(boot.response.ok);
      const cookie = boot.response.headers.get('set-cookie')!.split(';')[0];
      const poll = async () => {
        const t = performance.now();
        const r = await api('/leaderboard', undefined, cookie);
        polls.push({ player: i, status: r.response.status, ms: performance.now() - t });
        if (
          !r.response.ok ||
          JSON.stringify(r.data).match(/"(?:display|answer_id|guess|user_id)":/)
        )
          errors.push({ player: i, phase: 'leaderboard', status: r.response.status });
      };
      await poll();
      const count = 3 + (i % 6);
      for (let j = 0; j < count; j++) {
        const t = performance.now();
        const answer = j === 0 ? 'Aardvark' : j % 2 === 0 ? 'Cat' : 'dibs';
        const r = await api(
          '/claim',
          { answer, requestId: crypto.randomUUID(), turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' },
          cookie,
        );
        samples.push({
          player: i,
          guess: j,
          status: r.response.status,
          ms: performance.now() - t,
          code: r.data.code,
        });
        if (r.response.status === 201) {
          winners.add(r.data.claim.id);
          winnerCookie = cookie;
        }
        const expected =
          j === 0
            ? r.response.status === 201 || (r.response.status === 409 && r.data.house === false)
            : j % 2 === 0
              ? r.response.status === 409 && r.data.house === true
              : r.response.status === 422;
        if (!expected)
          errors.push({ player: i, guess: j, status: r.response.status, message: r.data.message });
      }
      await poll();
      // Established visitors poll the board again at 25 seconds while arrivals continue.
      if (Date.now() - start < 35000) {
        await pause(Math.max(0, start + i * 300 + 25000 - Date.now()));
        await poll();
      }
    } catch (e) {
      errors.push({ player: i, error: String(e) });
    }
  }),
);
const quantiles = (rows: any[]) => {
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  return {
    p50Ms: Math.round(ms[Math.ceil(ms.length * 0.5) - 1]),
    p95Ms: Math.round(ms[Math.ceil(ms.length * 0.95) - 1]),
  };
};
const after = await api('/admin/live', undefined, undefined, true);
const finalDay = await api('/today');
const winner = await api('/leaderboard', undefined, winnerCookie);
const winnerHeld = finalDay.data.claimed === 1 && winner.data.own?.claims === 1;
const result = {
  origin,
  startedAt: new Date(start).toISOString(),
  durationSeconds: (Date.now() - start) / 1000,
  arrivalWindowSeconds: 59.7,
  actualArrivalWindowSeconds: Math.max(...arrivals) / 1000,
  players,
  guesses: samples.length,
  leaderboardPolls: polls.length,
  writeEstimate,
  budget,
  measuredWritesBefore: usage.data.usage.writes,
  measuredWritesAfter: after.data.usage.writes,
  ...quantiles(samples),
  leaderboard: quantiles(polls),
  unexpectedErrors: errors,
  errorRate: errors.length / (samples.length + polls.length),
  uniqueWinningClaims: winners.size,
  winnerHeld,
  passed: errors.length === 0 && winners.size === 1 && winnerHeld,
  samples,
  polls,
};
writeFileSync('review/round14/load-test.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, samples: undefined, polls: undefined }));
assert.ok(result.passed, 'Practice load test failed');
