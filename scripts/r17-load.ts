import './test-traffic';
import { createRequire } from 'node:module';
const WebSocket = createRequire(import.meta.url)('ws');
const sockets: any[] = [];
let broadcasts = 0;
const socketMode = process.argv.includes('--sockets');
import { writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readCategory } from './category-file';
import { api, origin } from './r11-practice';
assert.equal(origin, 'https://practice.dibs-7hz.pages.dev', 'Load testing is practice-only');
const players = 500,
  writeEstimate = 15000;
const now = new Date();
assert.ok(now.getTime() >= Date.parse('2026-11-23T00:05:00Z'), 'Wait until Sunday 7:05 PM ET');
let budget: any;
if (process.env.R17_APPROVED_BUDGET === '1') {
  assert.equal(
    process.env.GITHUB_ACTIONS,
    'true',
    'Approved budgets are only consumed by the private CI runner',
  );
  budget = JSON.parse(readFileSync('review/round17/account-write-budget.json', 'utf8'));
  assert.ok(
    Date.now() - Date.parse(budget.checkedAt) < 600000,
    'The account-wide headroom check must be less than ten minutes old',
  );
  assert.equal(budget.utcDay, now.toISOString().slice(0, 10));
  assert.equal(budget.writeEstimate, writeEstimate);
  assert.equal(budget.allowed, true);
  assert.ok(budget.accountWrites + writeEstimate <= 70000);
} else {
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
  budget = {
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
}
writeFileSync('review/round17/account-write-budget.json', JSON.stringify(budget, null, 2));
console.log(JSON.stringify(budget));
if (!budget.allowed) {
  writeFileSync(
    'review/round17/load-test.json',
    JSON.stringify(
      {
        passed: false,
        blocked: true,
        headroomBlocked: true,
        reason:
          'Account-wide writes plus the conservative test estimate would leave less than 30% of the daily quota. No load requests sent.',
        accountWrites: budget.accountWrites,
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
const boot = await api('/bootstrap');
assert.equal(boot.data.today.turnstileSiteKey, '1x00000000000000000000AA');
assert.ok(boot.data.today.category);
const reset = await api('/admin/practice-reset', {}, undefined, true);
assert.ok(reset.response.ok);
const catalog = readCategory('categories/animals.json');
const start = Date.now(),
  arrivals: number[] = [],
  samples: any[] = [],
  errors: any[] = [],
  winners = new Set<string>(),
  allClaims = new Set<string>();
let completed = 0;
await Promise.all(
  Array.from({ length: players }, async (_, i) => {
    await new Promise((r) => setTimeout(r, i * 240));
    arrivals.push(Date.now() - start);
    try {
      const load = await api('/bootstrap');
      assert.ok(load.response.ok);
      const cookie = load.response.headers.get('set-cookie')!.split(';')[0];
      let perform = api;
      if (socketMode) {
        const ws = new WebSocket(origin.replace('https:', 'wss:') + '/api/live', {
          headers: { origin, cookie },
        });
        sockets.push(ws);
        await new Promise<void>((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });
        const pending = new Map<string, any>();
        ws.on('message', (raw: any) => {
          const message = JSON.parse(String(raw));
          if (message.rpc) {
            const p = pending.get(message.rpc);
            if (p) {
              clearTimeout(p.timer);
              pending.delete(message.rpc);
              p.resolve({
                response: { status: message.status, ok: message.status < 400 },
                data: message.body,
              });
            }
          } else if (message.today) {
            broadcasts++;
            if (/"(?:display|answer_id|guess|user_id)":/.test(JSON.stringify(message)))
              errors.push({ player: i, error: 'Private data in broadcast' });
          }
        });
        ws.on('close', () => {
          for (const p of pending.values()) {
            clearTimeout(p.timer);
            p.reject(Error('Socket closed'));
          }
          pending.clear();
        });
        perform = async (path: string, body?: any) =>
          new Promise<any>((resolve, reject) => {
            const rpc = crypto.randomUUID();
            const timer = setTimeout(() => {
              pending.delete(rpc);
              reject(Error('RPC timeout'));
            }, 20000);
            pending.set(rpc, { resolve, reject, timer });
            ws.send(JSON.stringify({ rpc, path, body }));
          });
      }
      const verification = await perform(
        '/verify-session',
        { turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' },
        cookie,
      );
      assert.ok(verification.response.ok);
      const guesses = [
        'Aardvark',
        'Dog',
        catalog.answers[200 + i * 3].display,
        'Cat',
        catalog.answers[201 + i * 3].display,
        catalog.answers[202 + i * 3].display,
      ];
      const ownClaims: string[] = [];
      for (const [j, answer] of guesses.entries()) {
        const t = performance.now();
        const r = await perform(
          '/claim',
          { answer, sessionToken: verification.data.sessionToken, requestId: crypto.randomUUID() },
          cookie,
        );
        samples.push({ player: i, guess: j, status: r.response.status, ms: performance.now() - t });
        if (r.response.status === 201) {
          allClaims.add(r.data.claim.id);
          ownClaims.push(r.data.claim.id);
          if (j === 0) winners.add(r.data.claim.id);
        }
        const expected =
          j === 0
            ? [201, 409].includes(r.response.status)
            : j === 1 || j === 3
              ? r.response.status === 409 && r.data.house
              : r.response.status === 201;
        if (!expected)
          errors.push({ player: i, guess: j, status: r.response.status, message: r.data.message });
        if (r.data.file?.closed) break;
      }
      const board = await api('/leaderboard', undefined, cookie);
      assert.ok(board.response.ok);
      assert.equal(board.data.own.claims, 3);
      assert.ok(!JSON.stringify(board.data).match(/"(?:display|answer_id|guess|user_id)":/));
      const returned = await api('/bootstrap', undefined, cookie);
      assert.ok(returned.response.ok);
      assert.deepEqual(returned.data.me.file.claims.map((c: any) => c.id).sort(), ownClaims.sort());
      assert.equal(returned.data.me.file.dibs, 3);
      completed++;
    } catch (e) {
      errors.push({ player: i, error: String(e), cause: String((e as any)?.cause || '') });
    }
  }),
);
for (const ws of sockets) ws.close();
const flushed = await api('/admin/r17-flush', {}, undefined, true);
assert.ok(flushed.response.ok);
const finalDay = await api('/today');
const latency = samples.map((s) => s.ms).sort((a, b) => a - b);
const result = {
  at: new Date().toISOString(),
  origin,
  players,
  transport: socketMode ? '500 concurrent WebSockets' : 'HTTP',
  broadcasts,
  completed,
  actualArrivalWindowSeconds: Math.max(...arrivals) / 1000,
  durationSeconds: (Date.now() - start) / 1000,
  p50Ms: latency[Math.ceil(latency.length * 0.5) - 1],
  p95Ms: latency[Math.ceil(latency.length * 0.95) - 1],
  requests: samples.length,
  unexpectedErrors: errors,
  uniqueWinningClaims: winners.size,
  acknowledgedClaims: allClaims.size,
  retainedClaims: finalDay.data.claimed,
  zeroLostClaims: completed === players && finalDay.data.claimed === allClaims.size,
  zeroDoubleWinners: winners.size === 1,
  budget,
  passed:
    errors.length === 0 &&
    completed === players &&
    winners.size === 1 &&
    finalDay.data.claimed === allClaims.size,
  samples,
};
writeFileSync('review/round17/load-test.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, samples: undefined }, null, 2));
assert.ok(result.passed, 'R17 practice load failed');
