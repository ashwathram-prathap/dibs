import { describe, it, expect } from 'vitest';
import { rarityPoints, rankPopularity, scoreFile } from '../worker/scoring';
import {
  orderScores,
  publicScores,
  SCORE_TTL,
  Leaderboard,
  type ScoreRow,
} from '../worker/leaderboard';
import { registryDate, streak, dropAt } from '../worker/domain';
import { canReveal } from '../worker/visibility';

describe('R14 saved scoring', () => {
  it('holds the popular decile at 10, then rises smoothly to 100 in steps of five', () => {
    expect([0, 0.05, 0.1, 0.2, 0.5, 0.94, 1].map(rarityPoints)).toEqual([
      10, 10, 10, 20, 50, 95, 100,
    ]);
    for (let i = 0; i <= 1000; i++) {
      expect(rarityPoints(i / 1000) % 5).toBe(0);
      expect(rarityPoints(i / 1000)).toBeGreaterThanOrEqual(rarityPoints((i - 1) / 1000));
    }
  });
  it('ranks within one category, ties fairly and leaves unknown readings unranked', () => {
    expect(rankPopularity([100, 50, 0, null])).toEqual({
      median: 50,
      percentiles: [0, 0.5, 1, null],
    });
    expect(rankPopularity([4, 4, 4, null])).toEqual({
      median: 50,
      percentiles: [0.5, 0.5, 0.5, null],
    });
    expect(rankPopularity([null, null])).toEqual({ median: 50, percentiles: [null, null] });
    expect(rankPopularity([1, null])).toEqual({ median: 50, percentiles: [0.5, null] });
    expect(rankPopularity([100, 99, 98, 0, 0])).toEqual({
      median: 50,
      percentiles: [0, 0.25, 0.5, 0.875, 0.875],
    });
  });
  it('adds the saved golden bonus and charges every strike, with a zero floor', () => {
    const event = (kind: string, points: number, at: string) => ({ kind, points, at });
    expect(scoreFile([event('strike', 0, 'a'), event('strike', 0, 'b')])).toEqual({
      points: 0,
      reachedAt: 'a',
    });
    expect(
      scoreFile([event('dibs', 160, 'a'), event('strike', 0, 'b'), event('dibs', 50, 'c')]),
    ).toEqual({ points: 200, reachedAt: 'c' });
    expect(
      scoreFile([event('dibs', 50, 'a'), event('strike', 0, 'b'), event('dibs', 10, 'c')]),
    ).toEqual({ points: 50, reachedAt: 'a' });
  });
});
it('ranks score ties by first arrival and returns the top 25 plus an own row without IDs or answers', () => {
  const rows: ScoreRow[] = Array.from({ length: 30 }, (_, i) => ({
    user_id: 'u' + i,
    handle: 'Practice ' + i,
    founder: i === 0,
    points: 50,
    dibs: 1,
    golden: false,
    reachedAt: new Date(1000 + i).toISOString(),
    events: 1,
  }));
  const board = publicScores(orderScores(rows.reverse()), 'u29');
  expect(board.rows).toHaveLength(25);
  expect(board.rows[0]).toMatchObject({ rank: 1, handle: 'Practice 0', founder: true });
  expect(board.own).toMatchObject({ rank: 30, own: true });
  expect(board.total).toBe(30);
  expect(JSON.stringify(board)).not.toMatch(/user_id|reachedAt|answer|display/);
});
it('uses Toronto drop dates across DST, midnight, missed days and future dates', () => {
  expect(registryDate(new Date('2026-11-02T01:59:59Z'))).toBe('2026-10-31');
  expect(registryDate(new Date('2026-11-02T02:00:00Z'))).toBe('2026-11-01');
  expect(registryDate(new Date('2026-03-09T00:59:59Z'))).toBe('2026-03-07');
  expect(registryDate(new Date('2026-03-09T01:00:00Z'))).toBe('2026-03-08');
  expect(registryDate(new Date('2026-11-24T05:00:00Z'))).toBe('2026-11-23');
  expect(streak(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02')).toBe(3);
  expect(streak(['2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-09')).toBe(3);
  expect(streak(['2026-11-20', '2026-11-20'], '2026-11-22')).toBe(0);
  expect(streak(['2026-11-20', '2026-11-22', '2999-01-01'], '2026-11-22')).toBe(1);
  expect(dropAt('2026-11-01')).toBe('2026-11-02T02:00:00.000Z');
});
it('never unlocks other answers merely because the viewer finished', async () => {
  const env = {
    DB: {
      prepare() {
        throw Error('Viewer progress must not bypass the day clock');
      },
    },
    COOKIE_SECRET: 'test',
  } as any;
  expect(await canReveal(new Request('https://dibs.here'), env, { date: '2099-11-23' })).toBe(
    false,
  );
  expect(await canReveal(new Request('https://dibs.here'), env, { date: '2020-11-23' })).toBe(true);
});
it('reads cached leaderboard shards for 25 seconds with no D1 query or write', async () => {
  const data = new Map<string, any>([
    ['scores:day:ready', true],
    ['scores:day:row:0', []],
  ]);
  let scans = 0;
  const storage: any = {
    get: async (k: string) => data.get(k),
    list: async ({ prefix }: any) => {
      scans++;
      return new Map([...data].filter(([k]) => k.startsWith(prefix)));
    },
  };
  const env: any = {
    DB: {
      prepare() {
        throw Error('No D1 reads on leaderboard polls');
      },
    },
  };
  const scores = new Leaderboard(storage, env);
  expect(SCORE_TTL).toBe(25000);
  await scores.rows('day');
  await scores.rows('day');
  await scores.rows('day');
  expect(scans).toBe(1);
});
