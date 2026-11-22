import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
const players = 200,
  maxGuesses = 8,
  writeEstimate = 20000;
// Upper bound: 1,600 guesses x up to 10 indexed writes + 4,000 identity/metrics writes.
// Use account-wide D1 analytics, including earlier rounds and both databases.
// A practice reset clears application counters but does not reset the daily quota.
const now = new Date();
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
assert.equal(analytics.status, 0, 'Account-wide D1 analytics unavailable; do not load test.');
const accountInsights = JSON.parse(analytics.stdout);
assert.ok(accountInsights.length < 1000, 'Analytics query list truncated; write headroom unknown.');
const accountWrites = accountInsights.reduce(
  (sum: number, row: any) => sum + row.totalRowsWritten,
  0,
);
writeFileSync(
  'review/round11/account-write-budget.json',
  JSON.stringify(
    {
      checkedAt: now.toISOString(),
      lookbackMinutes: minutes,
      queryShapes: accountInsights.length,
      accountWrites,
      writeEstimate,
      freeDailyLimit: 100000,
      safetyCeiling: 90000,
    },
    null,
    2,
  ),
);
if (accountWrites + writeEstimate >= 90000) {
  writeFileSync(
    'review/round11/load-test.json',
    JSON.stringify(
      {
        passed: false,
        blocked: true,
        players,
        writeEstimate,
        accountWrites,
        reason:
          'Account-wide D1 write headroom is insufficient for a safe 200-player load test. No load requests sent.',
      },
      null,
      2,
    ),
  );
  throw Error('Load test blocked by account-wide free-tier write headroom.');
}
const usage = await api('/admin/live', undefined, undefined, true);
assert.ok(usage.response.ok);
assert.ok(usage.data.usage.writes + writeEstimate < 60000, 'Practice write headroom too small');
assert.equal((await api('/bootstrap')).data.today.turnstileSiteKey, '1x00000000000000000000AA');
assert.ok((await api('/bootstrap')).data.today.category, 'Practice has not opened');
const reset = await api('/admin/practice-reset', {}, undefined, true);
assert.ok(reset.response.ok);
const start = Date.now(),
  samples: any[] = [],
  errors: any[] = [],
  ids = new Set<string>();
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
await Promise.all(
  Array.from({ length: players }, async (_, i) => {
    await pause(i * 300); // All arrivals occur within 59.7 seconds.
    try {
      const boot = await api('/bootstrap');
      assert.ok(boot.response.ok);
      const cookie = boot.response.headers.get('set-cookie')!.split(';')[0];
      const count = 3 + (i % 6); // 3–8 guesses per player, including the same contested answer.
      for (let j = 0; j < count; j++) {
        const requestId = crypto.randomUUID();
        const before = performance.now();
        const answer = j === 0 ? 'Aardvark' : j % 2 === 0 ? 'Cat' : 'dibs';
        const r = await api(
          '/claim',
          { answer, requestId, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' },
          cookie,
        );
        samples.push({
          player: i,
          guess: j,
          status: r.response.status,
          ms: performance.now() - before,
          code: r.data.code,
          claimId: r.data.claim?.id,
        });
        if (r.response.status === 201) ids.add(r.data.claim.id);
        if (![201, 409, 422, 403].includes(r.response.status))
          errors.push({ player: i, guess: j, status: r.response.status, message: r.data.message });
      }
    } catch (e) {
      errors.push({ player: i, error: String(e) });
    }
  }),
);
const times = samples.map((s) => s.ms).sort((a, b) => a - b),
  quantile = (q: number) => Math.round(times[Math.ceil(times.length * q) - 1]);
const after = await api('/admin/live', undefined, undefined, true);
const result = {
  origin,
  startedAt: new Date(start).toISOString(),
  durationSeconds: (Date.now() - start) / 1000,
  players,
  guesses: samples.length,
  writeEstimate,
  measuredWritesBefore: usage.data.usage.writes,
  measuredWritesAfter: after.data.usage.writes,
  p50Ms: quantile(0.5),
  p95Ms: quantile(0.95),
  unexpectedErrors: errors,
  errorRate: errors.length / samples.length,
  uniqueWinningClaims: ids.size,
  passed: errors.length === 0 && ids.size === 1,
  samples,
};
writeFileSync('review/round11/load-test.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, samples: undefined }));
assert.ok(result.passed);
