import { it, expect } from 'vitest';
import { funnel } from '../worker/funnel';
const file = (n: number, strikes = 0, extra = {}) => ({
  user: { id: String(n), handle: 'Player', ...extra },
  file: {
    claims: Array.from({ length: n }, (_, i) => ({ created_at: new Date(i * 1000).toISOString() })),
    strikes,
  },
  requests: {},
  streakDates: [],
});
it('separates exact/cumulative buckets, union finishers, strikes and exclusions', () => {
  expect(
    funnel([
      file(1),
      file(2),
      file(3),
      file(0, 5),
      file(3, 5),
      file(3, 0, { hidden: true }),
      file(0),
    ]),
  ).toEqual({
    participants: 5,
    claimers: 4,
    claims: 9,
    exactly1: 1,
    exactly2: 1,
    exactly3: 2,
    reached1: 4,
    reached2: 3,
    reached3: 2,
    struckOut: 2,
    finished: 3,
    finishRate: 0.6,
    excluded: 1,
    medianBetweenClaimsMs: 1000,
    intervalSamples: 5,
  });
  expect(funnel([file(0, 5)]).medianBetweenClaimsMs).toBeNull();
  const f = file(3);
  f.file.claims[2].created_at = new Date(4000).toISOString();
  expect(funnel([f]).medianBetweenClaimsMs).toBe(2000);
});
