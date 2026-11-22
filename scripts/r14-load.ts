import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
assert.equal(origin, 'https://practice.dibs-7hz.pages.dev', 'Load testing is practice-only');
const players = 200,
  writeEstimate = 20000;
const now = new Date();
assert.ok(now.getTime() >= Date.parse('2026-11-23T00:05:00Z'), 'Wait until Sunday 7:05 PM ET');
const minutes = Math.max(
  1,
  Math.ceil(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 60000,
  ),
);
const analytics = spawnSync(
  './node_modules/.bin/wrangler',
  [
    'd1',
    'insights',
    '-c',
    'worker/wrangler.staging.jsonc',
    '--time-period',
    minutes + 'm',
    '--sort-by',
    'writes',
    '--limit',
    '1000',
    '--json',
  ],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
);
assert.equal(analytics.status, 0, 'Account-wide D1 usage unavailable; do not run load');
const queries = JSON.parse(analytics.stdout);
assert.ok(queries.length < 1000, 'Usage is truncated; do not run load');
const writes = queries.reduce((n: number, r: any) => n + r.totalRowsWritten, 0);
writeFileSync(
  'review/round14/account-write-budget.json',
  JSON.stringify(
    {
      checkedAt: now.toISOString(),
      lookbackMinutes: minutes,
      queryShapes: queries.length,
      accountWrites: writes,
      writeEstimate,
      safetyCeiling: 70000,
      freeDailyLimit: 100000,
    },
    null,
    2,
  ),
);
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
  errors: any[] = [],
  winners = new Set<string>();
let winnerCookie = '';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
await Promise.all(
  Array.from({ length: players }, async (_, i) => {
    await pause(i * 300);
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
        samples.push({ player: i, guess: j, status: r.response.status, ms: performance.now() - t });
        if (r.response.status === 201) {
          winners.add(r.data.claim.id);
          winnerCookie = cookie;
        }
        if (![201, 409, 422, 403].includes(r.response.status))
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
  players,
  guesses: samples.length,
  leaderboardPolls: polls.length,
  writeEstimate,
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
