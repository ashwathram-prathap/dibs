import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const start = JSON.parse(readFileSync('review/round20/handler-ready.json', 'utf8')).at;
const results: any[] = [];
while (true) {
  const sample: any = { at: new Date().toISOString(), passed: true };
  for (const path of ['/today', '/leaderboard']) {
    try {
      const r = await fetch('https://dibs.here/api' + path, { signal: AbortSignal.timeout(10000) });
      const d: any = await r.json();
      assert.ok(r.ok && !r.headers.get('set-cookie'));
      sample[path] = {
        status: r.status,
        category: d.category?.id,
        total: d.total,
        claimed: d.claimed,
      };
    } catch {
      sample.passed = false;
      sample[path] = { error: 'Public read failed' };
    }
  }
  results.push(sample);
  const complete = Date.now() >= Date.parse(start) + 3600000;
  writeFileSync(
    'review/round20/stability.json',
    JSON.stringify(
      {
        start,
        at: sample.at,
        complete,
        passed: complete && results.every((r) => r.passed),
        samples: results,
      },
      null,
      2,
    ),
  );
  if (!sample.passed) throw Error('R20 stability check failed; investigate before R21');
  if (complete) break;
  await new Promise((r) => setTimeout(r, 60000));
}
console.log('R20 one-hour public-read stability observation complete');
