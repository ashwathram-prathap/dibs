import { it, expect } from 'vitest';
import { releaseBlocked, eveningFreeze, R20_OPEN, R20_CUTOFF } from '../shared/release-window';
import { assertAssetBudget } from '../shared/asset-budget';
it('gates each production operation including recovery with Saturday bounds', () => {
  expect(releaseBlocked(R20_OPEN - 1)).toBe(true);
  expect(releaseBlocked(R20_OPEN)).toBe(false);
  expect(releaseBlocked(R20_CUTOFF - 30 * 60000)).toBe(true);
  expect(releaseBlocked(R20_CUTOFF - 30 * 60000 - 1)).toBe(false);
  expect(releaseBlocked(NaN)).toBe(true);
  expect(releaseBlocked(R20_CUTOFF, 0)).toBe(true);
  for (const date of ['2026-11-27', '2026-11-28', '2026-07-01']) {
    const offset = date.includes('07-') ? '-04:00' : '-05:00';
    for (const [time, blocked] of [
      ['17:59:59', false],
      ['18:00:00', true],
      ['22:59:59', true],
      ['23:00:00', false],
    ] as const)
      expect(eveningFreeze(Date.parse(`${date}T${time}${offset}`))).toBe(blocked);
  }
});
it('enforces exact owner asset boundaries and rejects invalid inventories', () => {
  expect(() => assertAssetBudget(20000, 25 * 1024 * 1024)).not.toThrow();
  expect(() => assertAssetBudget(13852, 18386687)).not.toThrow();
  for (const [files, bytes] of [
    [20001, 1],
    [1, 25 * 1024 * 1024 + 1],
    [-1, 0],
    [NaN, 0],
  ])
    expect(() => assertAssetBudget(files, bytes)).toThrow();
});

import { loadBudget, FREE_DAILY, type BudgetUnits } from '../shared/load-budget';
it('fails closed on stale/missing quotas and preserves cumulative UTC accounting and production reserve', () => {
  const now = Date.parse('2026-11-28T05:00:00Z');
  const units = (n: number) =>
    Object.fromEntries(Object.keys(FREE_DAILY).map((k) => [k, n])) as BudgetUnits;
  const z = units(0),
    test = units(1);
  expect(loadBudget(now, now, '2026-11-28', z, z, z, test).allowed).toBe(true);
  expect(loadBudget(now, now - 300001, '2026-11-28', z, z, z, test).allowed).toBe(false);
  expect(loadBudget(now, now, '2026-11-27', z, z, z, test).allowed).toBe(false);
  expect(
    loadBudget(
      now,
      now,
      '2026-11-28',
      { ...z, doGBs: 1548 },
      z,
      { ...z, doGBs: 11059 },
      { ...test, doGBs: 400 },
    ).allowed,
  ).toBe(false);
  expect(loadBudget(now, now, '2026-11-28', z, { ...z, d1Writes: 20000 }, z, test).allowed).toBe(
    false,
  );
  expect(
    loadBudget(now, now, '2026-11-28', { ...z, workerRequests: NaN }, z, z, test).allowed,
  ).toBe(false);
});
