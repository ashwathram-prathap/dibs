import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const before = JSON.parse(
  execFileSync('git', ['show', '2712add:review/round20/real-night-baseline.json'], {
    encoding: 'utf8',
  }),
);
const token = readFileSync('.dev.vars', 'utf8')
  .match(/^ADMIN_TOKEN=(.+)$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
const r = await fetch('https://dibs.here/api/admin/r20-funnel', {
  headers: { authorization: 'Bearer ' + token },
});
if (!r.ok) console.log({ status: r.status, error: await r.text() });
assert.ok(r.ok, 'Authoritative funnel unavailable');
const authoritative = await r.json();
const cutoff = before.at;
assert.match(cutoff, /^[0-9TZ:.\-]+$/);
const sql = `WITH f AS (SELECT data FROM r17_files WHERE day='2026-11-27' AND COALESCE(json_extract(data,'$.user.hidden'),0)=0 AND COALESCE(json_extract(data,'$.file.eligible'),1)!=0 AND json_extract(data,'$.user.handle')!='Withdrawn player'), c AS (SELECT json_extract(c.value,'$.created_at') at FROM f,json_each(f.data,'$.file.claims') c) SELECT COUNT(*) totalClaims,SUM(at<='${cutoff}') claimsBeforeFirstCheck,SUM(at>'${cutoff}') claimsAfterFirstCheck,MIN(at) firstClaimAt,MAX(at) latestClaimAt FROM c`;
const mirror = JSON.parse(
  execFileSync(
    './node_modules/.bin/wrangler',
    [
      'd1',
      'execute',
      'dibs-db',
      '--remote',
      '-c',
      'worker/wrangler.jsonc',
      '--json',
      '--command',
      sql,
    ],
    { encoding: 'utf8' },
  ),
)[0];
writeFileSync(
  'review/round20/friday-recheck.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      firstCheckAt: cutoff,
      firstCheck: before.nights.results.find((x: any) => x.day === '2026-11-27'),
      authoritative,
      mirror,
    },
    null,
    2,
  ),
);
console.log({ authoritative, mirror: mirror.results });
