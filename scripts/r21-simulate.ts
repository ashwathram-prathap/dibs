// Closed nights only. Private IDs/answers stay in process memory, never in review artifacts.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { selectGolden } from '../worker/specials';
import { goldenCount, POOL_VERSION } from '../shared/flow-rules';
import assert from 'node:assert/strict';
const query = (sql: string) =>
  JSON.parse(
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
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    ),
  )[0];
const categories = query(
  "SELECT id,date,drop_at,source_json FROM categories WHERE date IN ('2026-11-23','2026-11-24') AND status='approved'",
);
const results: any[] = [];
for (const category of categories.results) {
  assert.ok(Date.now() > Date.parse(category.drop_at) + 86400000, 'Never inspect open-day claims');
  const meta = JSON.parse(category.source_json).staticCatalog;
  const pool = JSON.parse(
    readFileSync(`public/catalog/${meta.slug}/${meta.version}/${POOL_VERSION}.json`, 'utf8'),
  );
  const reserved = new Set(meta.house.map((r: any) => r[0]));
  const eligible = pool.membership.flatMap((v: number, i: number) =>
    v === 1 && !reserved.has(i) ? [String(i)] : [],
  );
  const id = category.id;
  assert.match(id, /^[a-zA-Z0-9-]+$/);
  const rows = query(
    `SELECT f.user_id,json_extract(c.value,'$.answer_id') answer,json_extract(c.value,'$.created_at') at FROM r17_files f,json_each(f.data,'$.file.claims') c WHERE f.category_id='${id}' AND COALESCE(json_extract(f.data,'$.user.hidden'),0)=0 AND COALESCE(json_extract(f.data,'$.file.eligible'),1)!=0 AND json_extract(f.data,'$.user.handle') NOT IN ('Withdrawn player','Record withheld') AND COALESCE(json_extract(c.value,'$.voided'),0)=0 ORDER BY at`,
  );
  const players = new Map<string, string[]>(),
    claimed = new Set<string>();
  for (const r of rows.results) {
    if (claimed.has(r.answer)) continue;
    claimed.add(r.answer);
    const a = players.get(r.user_id) || [];
    if (a.length < 3) a.push(r.answer.split(':').at(-1));
    players.set(r.user_id, a);
  }
  const rounds = 1000,
    counts: number[] = [];
  let hits = 0,
    engagedHits = 0;
  const engaged = [...players.values()].filter((a) => a.length === 3);
  for (let i = 0; i < rounds; i++) {
    const draw = new Set(
      await selectGolden(
        eligible,
        `r21-simulation-${category.date}-${i}`,
        goldenCount(eligible.length),
      ),
    );
    let n = 0;
    for (const answers of players.values()) if (answers.some((a) => draw.has(a))) n++;
    engagedHits += engaged.filter((a) => a.some((id) => draw.has(id))).length;
    counts.push(n);
    hits += n;
  }
  counts.sort((a, b) => a - b);
  const rate = players.size ? hits / (rounds * players.size) : null;
  results.push({
    registryDate: category.date,
    slug: meta.slug,
    catalogVersion: meta.version,
    poolVersion: POOL_VERSION,
    referencePoolSize: pool.poolSize,
    eligibleCount: eligible.length,
    goldenCount: goldenCount(eligible.length),
    bonus: 50,
    claimers: players.size,
    acceptedClaims: claimed.size,
    eligibleClaims: [...players.values()].flat().filter((a) => eligible.includes(a)).length,
    draws: rounds,
    seedScheme: 'deterministic distinct simulation seeds; no production seeds or draws read',
    meanPlayersWithGolden: hits / rounds,
    claimersHitRate: rate,
    engagedThreeClaimPlayers: engaged.length,
    engagedHitRate: engaged.length ? engagedHits / (rounds * engaged.length) : null,
    engagedExpectedNights: engagedHits ? (rounds * engaged.length) / engagedHits : null,
    expectedNightsAtSampleRate: rate ? 1 / rate : null,
    drawPlayerHitInterval95: [counts[25], counts[974]],
    queryCost: rows.meta,
    limitations:
      'Closed-night claimers with 1–3 claims; strike-only participants not in this probability denominator. Historical behavior, competition and alias uniqueness preserved via first accepted canonical ID. One/two-night sample is not causal evidence or measured future odds.',
  });
}
mkdirSync('review/r21-flow', { recursive: true });
writeFileSync(
  'review/r21-flow/simulation.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      ownerTarget:
        'roughly one golden every 1–2 weeks for engaged players; a target, not a promise',
      results,
    },
    null,
    2,
  ),
);
console.log(results.map(({ queryCost, ...r }) => r));
