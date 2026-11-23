import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { rankPopularity, rarityPoints, scoreAnswer } from '../worker/scoring';
import { legacyRankPopularity, legacyRarityPoints } from '../scripts/legacy-scoring';
import { scoreAssetPath, rarityAssetPath, SCORING_VERSION } from '../shared/scoring-assets';
import { bellX, rarityLabel, rarityDensity } from '../shared/rarity';
import { readCategory } from '../scripts/category-file';
import { measured, resolvePopularity } from '../scripts/popularity-aliases';
afterEach(() => vi.unstubAllGlobals());

describe('R19E nameable reference pool', () => {
  it('ranks the top, pool edge and outside tail, preserving unknown readings', () => {
    expect(rankPopularity([100, 80, 60, 40, 20, 0, null], 3)).toEqual({
      median: 55,
      percentiles: [0, 0.5, 1, 1, 1, 1, null],
    });
    expect(rankPopularity([100, 50, 0, null], 3000)).toEqual({
      median: 55,
      percentiles: [0, 0.5, 1, null],
    });
    expect(rankPopularity([null, null])).toEqual({ median: 50, percentiles: [null, null] });
    expect(rankPopularity([10, null], 1)).toEqual({ median: 55, percentiles: [0.5, null] });
    expect(rankPopularity([100, 80, 60, 40, NaN, Infinity], 3).percentiles).toEqual([
      0,
      0.5,
      1,
      1,
      null,
      null,
    ]);
    for (const size of [0, -1, 1.5, Infinity]) expect(() => rankPopularity([1], size)).toThrow();
  });
  it('keeps equal readings equal, including ties across the cutoff', () => {
    expect(rankPopularity([10, 8, 8, 1], 4).percentiles).toEqual([0, 0.5, 0.5, 1]);
    expect(rankPopularity([10, 8, 8, 8, 1], 3).percentiles).toEqual([0, 1, 1, 1, 1]);
    expect(rankPopularity([4, 4, 4], 3).percentiles).toEqual([0.5, 0.5, 0.5]);
  });
  it('does not let an obscure tail turn a missing reading into a rarest score', () => {
    const a = rankPopularity([100, 80, 60, null], 3);
    const b = rankPopularity([100, 80, 60, ...Array(5000).fill(0), null], 3);
    expect(b.median).toBe(a.median);
    expect(b.percentiles.at(-1)).toBeNull();
    expect(b.percentiles.slice(0, 3)).toEqual(a.percentiles.slice(0, 3));
  });
  it('matches the R19 label and bell position at endpoints, with 10–110 points', () => {
    expect([0, 0.1, 0.5, 0.94, 1].map(rarityPoints)).toEqual([10, 10, 55, 105, 110]);
    expect(rarityLabel(0, 'animals')).toBe('One of the most familiar animals');
    expect(rarityLabel(1, 'animals')).toBe('Rarer than 99% of animals');
    expect(bellX(0)).toBeLessThan(bellX(0.5));
    expect(bellX(0.5)).toBeLessThan(bellX(1));
    expect(rarityPoints(-1)).toBe(10);
    expect(rarityPoints(2)).toBe(110);
  });
});
it('reproduces the incident and checks measured ordering for Animals (tonight)', () => {
  const c = readCategory('categories/animals.json');
  const values = resolvePopularity(c.answers).readings.map((p) =>
    measured(p) ? p!.total! / p!.days : null,
  );
  const old = legacyRankPopularity(values),
    current = rankPopularity(values);
  const rank = (name: string) => {
    const i = c.answers.findIndex((a: any) => a.display.toLowerCase() === name.toLowerCase());
    expect(i).toBeGreaterThanOrEqual(0);
    expect(old.percentiles[i]).not.toBeNull();
    expect(legacyRarityPoints(old.percentiles[i]!)).toBe(10);
    return current.percentiles[i]!;
  };
  expect(rank('Cat')).toBeLessThan(rank('Dog'));
  expect(rank('Dog')).toBeLessThan(rank('Lion'));
  expect(rank('Lion')).toBeLessThan(0.02);
  expect(rank('Deer')).toBeLessThan(rank('Camel'));
  expect(rank('Camel')).toBeLessThan(rank('Chameleon'));
  expect(rank('Chameleon')).toBeLessThan(rank('Blobfish'));
  expect(rank('Blobfish')).toBeLessThan(rank('Sarcastic fringehead'));
  expect(rank('Sarcastic fringehead')).toBeGreaterThan(0.6);
  // Axolotl is a genuine high-view meme animal; never force it to a desired band.
  expect(rank('Axolotl')).toBeLessThan(0.02);
});
it('the Worker reads the new immutable asset and uses its median only for missing data', async () => {
  const bytes = new Uint16Array([55, 0, 5000, 10000, 65535]);
  const fetcher = vi.fn(async () => new Response(bytes));
  vi.stubGlobal('fetch', fetcher);
  const category = {
    id: 'test',
    source_json: JSON.stringify({ staticCatalog: { slug: 'test', version: '123', count: 4 } }),
  };
  const env = {
    DB: {
      prepare() {
        throw Error('No DB access with known bonus');
      },
    },
  } as any;
  expect(await scoreAnswer(env, category, 0, 'top', false)).toEqual({
    points: 10,
    percentile: 0,
    bonus: 0,
  });
  expect(await scoreAnswer(env, category, 1, 'mid', false)).toEqual({
    points: 55,
    percentile: 0.5,
    bonus: 0,
  });
  expect(await scoreAnswer(env, category, 2, 'tail', true)).toEqual({
    points: 210,
    percentile: 1,
    bonus: 100,
  });
  expect(await scoreAnswer(env, category, 3, 'unknown', false)).toEqual({
    points: 55,
    percentile: null,
    bonus: 0,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('https://dibs.here' + scoreAssetPath('test', '123'));
  expect(scoreAssetPath('test', '123')).toContain('/' + SCORING_VERSION + '/scores-v2.bin');
});
it('every configured catalog has aligned versioned scores/curves and retained old assets', () => {
  const plan = JSON.parse(readFileSync('scripts/category-plan.json', 'utf8'));
  const coverage = JSON.parse(readFileSync('review/round19e/popularity-coverage.json', 'utf8'));
  expect(Object.keys(plan.rarityPoolSizes)).toHaveLength(33);
  expect(coverage).toHaveLength(34);
  expect(new Set(coverage.map((c: any) => c.category)).size).toBe(33);
  for (const c of coverage) {
    expect(c.poolSize).toBe(Math.min(c.measured, plan.rarityPoolSizes[c.category]));
    const base = `public/catalog/${c.category}/${c.catalogVersion}`;
    const bytes = readFileSync('public' + scoreAssetPath(c.category, c.catalogVersion));
    expect(bytes.length).toBe((c.total + 1) * 2);
    expect(bytes.readUInt16LE(0)).toBe(c.median);
    for (const version of ['v1', 'v2'])
      expect(readFileSync(`${base}/scores-${version}.bin`).length).toBe(bytes.length);
    const percentiles = Array.from({ length: c.total }, (_, i) => {
      const value = bytes.readUInt16LE((i + 1) * 2);
      expect(value === 65535 || value <= 10000).toBe(true);
      return value === 65535 ? null : value / 10000;
    });
    const curve = JSON.parse(
      readFileSync('public' + rarityAssetPath(c.category, c.catalogVersion), 'utf8'),
    );
    expect(curve).toEqual(rarityDensity(percentiles));
  }
}, 120000);

it('the live scoring diagnostic is authenticated, read-only and never queries bonuses', async () => {
  const { scoringCheck } = await import('../worker/scoring-check');
  const meta = JSON.parse(readFileSync('public/catalog/animals/manifest.json', 'utf8'));
  const category = { id: 'animals', source_json: JSON.stringify({ staticCatalog: meta }) };
  const queries: string[] = [];
  const env = {
    ADMIN_TOKEN: 'secret-test',
    DB: {
      prepare(sql: string) {
        queries.push(sql);
        return { bind: () => ({ first: async () => category }) };
      },
    },
  } as any;
  const bytes = readFileSync('public' + scoreAssetPath('animals', meta.version));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(bytes)),
  );
  const request = (query: string, token = 'secret-test', method = 'GET') =>
    new Request('https://dibs.here/api/admin/scoring' + query, {
      method,
      headers: { authorization: 'Bearer ' + token },
    });
  expect((await scoringCheck(request('?id=animals&q=Cat', 'wrong'), env)).status).toBe(404);
  expect(
    (await scoringCheck(request('?id=animals&q=Cat', 'secret-test', 'POST'), env)).status,
  ).toBe(405);
  expect((await scoringCheck(request('?id=animals'), env)).status).toBe(422);
  expect(queries).toEqual([]);
  const response = await scoringCheck(request('?id=animals&q=Cat'), env);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    scoringVersion: SCORING_VERSION,
    rows: [{ answer: 'Cat', found: true, basePoints: 10, percentile: 0 }],
  });
  expect(queries).toEqual(['SELECT * FROM categories WHERE id=?']);
});
