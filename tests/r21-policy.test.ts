import { it, expect, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { ensureSpecials, commitmentText, sha256, selectGolden } from '../worker/specials';
import { savedPolicy } from '../worker/day-rules';
import { scoreAnswer } from '../worker/scoring';
import { catalogMeta, answerId } from '../worker/catalog';
import { POOL_VERSION, goldenCount } from '../shared/flow-rules';
import { scoreAssetPath } from '../shared/scoring-assets';
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const db = new DatabaseSync(':memory:');
  let writes = 0;
  db.exec(
    'CREATE TABLE daily_specials(category_id TEXT PRIMARY KEY,seed TEXT,golden_json TEXT,commitment TEXT,committed_at TEXT);CREATE TABLE day_rules(category_id TEXT PRIMARY KEY,policy_json TEXT,policy_digest TEXT,pool_json TEXT,created_at TEXT);CREATE TABLE house_words(category_id TEXT,answer_id TEXT,PRIMARY KEY(category_id,answer_id));CREATE TABLE answers(id TEXT PRIMARY KEY,category_id TEXT,canonical TEXT,display TEXT,aliases_json TEXT,obscurity INTEGER);',
  );
  function prepare(sql: string) {
    return {
      bind: (...args: any[]) => ({
        run: async () => {
          writes++;
          db.prepare(sql).run(...args);
          return { success: true };
        },
        first: async () => db.prepare(sql).get(...args) || null,
        all: async () => ({ results: db.prepare(sql).all(...args) }),
      }),
    };
  }
  const env: any = {
    DB: {
      prepare,
      batch: async (statements: any[]) => {
        db.exec('BEGIN');
        try {
          const r = await Promise.all(statements.map((s) => s.run()));
          db.exec('COMMIT');
          return r;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      },
    },
  };
  vi.stubGlobal(
    'fetch',
    async (input: any) => new Response(readFileSync('public' + new URL(String(input)).pathname)),
  );
  return { db, env, writes: () => writes };
}
it('pins count/bonus/pool digest before first commitment, retains exact v1 hash and scores independently of bonus magnitude', async () => {
  const f = fixture();
  try {
    const meta = JSON.parse(readFileSync('public/catalog/animals/manifest.json', 'utf8'));
    const c = {
      id: 'policy-fixture',
      slug: 'animals',
      date: '2099-12-05',
      drop_at: '2099-12-06T02:00:00Z',
      source_json: JSON.stringify({ staticCatalog: meta, goldenPolicy: 'r21-3pct-v1' }),
    };
    const saved = await ensureSpecials(f.env, c),
      policy = savedPolicy(saved)!;
    const ids = JSON.parse(saved.golden_json);
    expect(ids.length).toBe(goldenCount(policy.eligibleCount));
    expect(new Set(ids).size).toBe(ids.length);
    const pool = JSON.parse(
      readFileSync(`public/catalog/animals/${meta.version}/${POOL_VERSION}.json`, 'utf8'),
    );
    for (const id of ids) {
      const ordinal = Number(id.split(':').at(-1));
      expect(pool.membership[ordinal]).toBe(1);
      expect(meta.house.some((r: any) => r[0] === ordinal)).toBe(false);
    }
    expect(saved.commitment).toBe(await sha256(commitmentText(c.id, saved.seed, ids)));
    expect(saved.policy_digest).toBe(await sha256(saved.policy_json));
    expect(policy.eligibleDigest).toBe(await sha256(saved.pool_json));
    expect(Date.parse(saved.committed_at)).toBeLessThan(Date.parse(c.drop_at));
    expect(await ensureSpecials(f.env, c)).toEqual(saved);
    const before = f.writes(),
      ordinal = Number(ids[0].split(':').at(-1));
    const current = await scoreAnswer(f.env, c, ordinal, ids[0], true, policy.bonus);
    const legacy = await scoreAnswer(f.env, c, ordinal, ids[0], true, 100);
    expect(current.bonus).toBe(50);
    expect(current.golden).toBe(true);
    expect(legacy.points - current.points).toBe(50);
    expect((await scoreAnswer(f.env, c, ordinal, ids[0])).bonus).toBe(50);
    expect(f.writes()).toBe(before);
    // A precommitted day is never redrawn when a new source-policy flag appears.
    f.db
      .prepare('INSERT INTO daily_specials VALUES(?,?,?,?,?)')
      .run('legacy', 'legacy-seed', '["a"]', 'legacy-commit', '2026-11-01T00:00:00Z');
    const old = await ensureSpecials(f.env, { ...c, id: 'legacy' });
    expect(old.commitment).toBe('legacy-commit');
    expect(savedPolicy(old)).toBeNull();
  } finally {
    f.db.close();
  }
});
it('fails closed for late new policies and malformed persisted rules', async () => {
  const f = fixture();
  try {
    const meta = JSON.parse(readFileSync('public/catalog/animals/manifest.json', 'utf8'));
    await expect(
      ensureSpecials(f.env, {
        id: 'late',
        date: '2020-01-01',
        drop_at: '2020-01-01T00:00:00Z',
        source_json: JSON.stringify({ staticCatalog: meta, goldenPolicy: 'r21-3pct-v1' }),
      }),
    ).rejects.toThrow('pre-opening');
    expect(() =>
      savedPolicy({ policy_json: JSON.stringify({ version: 'unknown', bonus: 50 }) }),
    ).toThrow();
  } finally {
    f.db.close();
  }
});
it('keeps seeded selection deterministic, unique and bounded for empty and tiny pools', async () => {
  expect(await selectGolden([], 'seed', 100)).toEqual([]);
  expect(await selectGolden(['a', 'b'], 'seed', 100)).toEqual(['a', 'b']);
  const ids = Array.from({ length: 80 }, (_, i) => String(i));
  expect(await selectGolden(ids, 'seed', 50)).toEqual(await selectGolden(ids, 'seed', 50));
  const counts = new Map<string, number>();
  for (let i = 0; i < 160; i++)
    for (const id of await selectGolden(ids, 'sample-' + i, 1))
      counts.set(id, (counts.get(id) || 0) + 1);
  expect(counts.size).toBeGreaterThan(50); // gross modulo/constant-selection regression, not a statistical proof
});
