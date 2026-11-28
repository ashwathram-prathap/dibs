import { it, expect } from 'vitest';
import {
  fileTitle,
  goldenCount,
  poolMembership,
  rarityTier,
  POOL_VERSION,
  momentum,
  takenAge,
  type PoolEvidence,
} from '../shared/flow-rules';
import { visibleClaim, publicSummary } from '../worker/visibility';
const pool = (membership: PoolEvidence['membership'] = 'in'): PoolEvidence => ({
  version: POOL_VERSION,
  catalogVersion: 'fixture',
  scoringVersion: 'r19e-pool-v1',
  poolSize: 3100,
  membership,
});
it('uses explicit quantized membership including cutoff ties, never percentile 1 as off-pool', () => {
  expect(poolMembership([10, 8, 8, 8, 1, null, NaN], 2)).toMatchObject({
    poolSize: 4,
    membership: [1, 1, 1, 1, 2, 0, 0],
  });
  expect(poolMembership([1, null], 3000).poolSize).toBe(1);
  expect(poolMembership([null], 3000).poolSize).toBe(0);
  for (const [p, t] of [
    [0, 'Common'],
    [0.3999, 'Common'],
    [0.4, 'Uncommon'],
    [0.7499, 'Uncommon'],
    [0.75, 'Rare'],
    [0.9499, 'Rare'],
    [0.95, 'Deep cut'],
    [1, 'Deep cut'],
  ] as const)
    expect(rarityTier(p, pool())).toBe(t);
  expect(rarityTier(1, pool('out'))).toBe('Off the register');
  for (const p of [null, NaN, -1, 1.1]) expect(rarityTier(p, pool('out'))).toBe('Standard score');
  expect(rarityTier(1)).toBeUndefined();
});
it('clamps owner golden policy without fabricating candidates', () => {
  for (const [eligible, count] of [
    [0, 0],
    [7, 7],
    [100, 50],
    [1667, 50],
    [2990, 90],
    [3334, 100],
    [100000, 100],
  ])
    expect(goldenCount(eligible)).toBe(count);
  expect(() => goldenCount(NaN)).toThrow();
});
it('awards only real completed-file titles, final-board ties and minimum board size', () => {
  expect(fileTitle({ dibs: 0, closed: true })).toBeNull();
  expect(fileTitle({ dibs: 2, closed: false })).toBeNull();
  expect(fileTitle({ dibs: 3, closed: true })?.name).toBe('Owner');
  expect(fileTitle({ dibs: 1, closed: true })?.provisional).toBe(true);
  const f = { dibs: 3, closed: true },
    b = { final: true, tieRank: 1, total: 100, finished: 20 };
  expect(fileTitle(f, b)?.name).toBe('Dibillionaire');
  expect(fileTitle(f, { ...b, tieRank: 10 })?.name).toBe('Baron');
  expect(fileTitle({ ...f, golden: true }, { ...b, tieRank: 10 })?.name).toBe('Dibillionaire');
  expect(fileTitle(f, { ...b, tieRank: 50 })?.name).toBe('Landlord');
  expect(fileTitle(f, { ...b, finished: 19 })?.name).toBe('Owner');
  expect(fileTitle(f, { ...b, final: false })?.name).toBe('Owner');
});
it('momentum excludes unknown readings and golden-only changes; taken ages clamp safely', () => {
  const c = (p: number) => ({ percentile: p, pool: pool() });
  expect(momentum([c(0.2), c(0.8)], 0, false)).toEqual(['Rarer than your last.']);
  expect(momentum([{ percentile: null, pool: pool() }, c(1)], 0, false)).toEqual([]);
  expect(momentum([c(0.8), c(0.95), c(1)], 0, true)).toEqual([
    'Clean sheet: three rare claims.',
    'No strikes tonight.',
  ]);
  expect(momentum([], 0, true)).toEqual([]);
  expect(takenAge('bad', 1000)).toBe('');
  expect(takenAge('2026-01-01', 0)).toBe('0s');
});
it('conceals tier evidence and ordinal from unshared public claims and restores only permitted details', () => {
  const c = {
    id: 'c',
    display: 'Fixture',
    points: 160,
    bonus: 100,
    golden: true,
    percentile: 1,
    pool: pool('out'),
    offRegisterOrdinal: 4,
  };
  expect(visibleClaim(c)).not.toHaveProperty('pool');
  expect(visibleClaim(c)).not.toHaveProperty('offRegisterOrdinal');
  expect(visibleClaim(c, false, false, true).pool).toEqual(c.pool);
  expect(visibleClaim(c, false, false, true)).not.toHaveProperty('offRegisterOrdinal');
  expect(visibleClaim(c, false, true).offRegisterOrdinal).toBe(4);
  const publicFile = publicSummary({ file: { claims: [c], events: [] }, category: null }).file;
  expect(publicFile.claims[0]).not.toHaveProperty('pool');
});
