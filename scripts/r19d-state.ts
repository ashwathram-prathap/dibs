import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const stage = process.argv[2];
assert.ok(stage === 'practice' || stage === 'production');
const after = process.argv.includes('--after');
const origin = stage === 'practice' ? 'https://practice.dibs-7hz.pages.dev' : 'https://dibs.here';
const vars = readFileSync(stage === 'practice' ? '.dev.vars.staging' : '.dev.vars', 'utf8');
const token = vars
  .match(/^ADMIN_TOKEN=(.+)$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
const response = await fetch(origin + '/api/admin/registers', {
  headers: { authorization: 'Bearer ' + token },
});
assert.ok(response.ok, 'Read-only register inventory failed');
const registers = ((await response.json()) as any).categories;
const scheduled = registers
  .filter((r: any) => r.date)
  .map((r: any) => ({
    id: r.id,
    slug: JSON.parse(r.source_json || '{}').staticCatalog?.slug || r.id,
    date: r.date,
    status: r.status,
    drop_at: r.drop_at,
    staticCatalog: JSON.parse(r.source_json || '{}').staticCatalog,
  }))
  .sort((a: any, b: any) => a.id.localeCompare(b.id));
const coverage = JSON.parse(readFileSync('review/round19e/popularity-coverage.json', 'utf8'));
for (const row of scheduled) {
  assert.ok(
    coverage.some((c: any) => c.category === row.slug),
    'Scheduled category lacks rebuilt scores: ' + row.slug,
  );
  if (row.staticCatalog)
    assert.ok(
      coverage.some(
        (c: any) =>
          c.category === row.staticCatalog.slug && c.catalogVersion === row.staticCatalog.version,
      ),
      'Scheduled catalog version missing: ' + row.id,
    );
}
if (stage === 'production') {
  const tonight = scheduled.find((r: any) => r.date === '2026-11-23');
  assert.equal(tonight.slug, 'animals');
  assert.equal(tonight.drop_at, '2026-11-24T02:00:00.000Z');
}
const result = spawnSync(
  './node_modules/.bin/wrangler',
  [
    'd1',
    'execute',
    stage === 'practice' ? 'dibs-db-staging' : 'dibs-db',
    '--remote',
    '-c',
    stage === 'practice' ? 'worker/wrangler.staging.jsonc' : 'worker/wrangler.jsonc',
    '--json',
    '--command',
    `SELECT id,category_id,points,percentile,bonus FROM claims
       UNION ALL SELECT json_extract(c.value,'$.id') id,f.category_id,json_extract(c.value,'$.points') points,json_extract(c.value,'$.percentile') percentile,json_extract(c.value,'$.bonus') bonus
       FROM r17_files f,json_each(f.data,'$.file.claims') c ORDER BY id;`,
  ],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);
assert.equal(result.status, 0, 'Claim preservation read failed');
const claims = JSON.parse(result.stdout)[0].results;
if (stage === 'production') assert.equal(claims.length, 0, 'Production must still have no claims');
const snapshot = { scheduled, claims };
const beforePath = `.tmp/r19d/${stage}-state-before.json`;
if (after) {
  const before = JSON.parse(readFileSync(beforePath, 'utf8'));
  assert.deepEqual(scheduled, before.scheduled, 'Scheduled categories/times changed');
  for (const old of before.claims)
    assert.deepEqual(
      claims.find((c: any) => c.id === old.id),
      old,
      'A saved claim score changed',
    );
} else writeFileSync(beforePath, JSON.stringify(snapshot), { mode: 0o600 });
const report = {
  at: new Date().toISOString(),
  stage,
  passed: true,
  phase: after ? 'after' : 'before',
  scheduledDates: scheduled.length,
  categories: [...new Set(scheduled.map((r: any) => r.slug))],
  claims: claims.length,
  savedClaimsSha256: createHash('sha256').update(JSON.stringify(claims)).digest('hex'),
  tonight: stage === 'production' ? scheduled.find((r: any) => r.date === '2026-11-23') : undefined,
};
writeFileSync(
  `review/round19d/${stage}-state-${after ? 'after' : 'before'}.json`,
  JSON.stringify(report, null, 2),
);
console.log(report);
