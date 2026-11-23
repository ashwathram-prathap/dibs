import { expect, it } from 'vitest';
import { inverseNormalCDF, bellX, rarityLabel, bellSigma } from '../shared/rarity';
import { cleanHandle, cleanStoredHandles, displayNames, playerNumber } from '../shared/handles';
import { colors, animals } from '../worker/identity';
import { noOrphan } from '../shared/text';
import { finishedComparison } from '../worker/finished-scores';
import { feedbackText, feedbackQuota } from '../worker/feedback';
it('maps honest percentiles onto a standard normal with safe tails', () => {
  expect(inverseNormalCDF(0.05)).toBeCloseTo(-1.644853627, 7);
  expect(inverseNormalCDF(0.5)).toBe(0);
  expect(inverseNormalCDF(0.94)).toBeCloseTo(1.554773595, 7);
  for (const p of [0.05, 0.5, 0.94])
    expect(bellX(p)).toBeCloseTo(28 + ((inverseNormalCDF(p) + 3) / 6) * 464, 6);
  expect(bellSigma(0)).toBe(-2.6);
  expect(bellSigma(1)).toBe(2.6);
  expect(rarityLabel(0, 'animals')).toBe('One of the 300 best-known animals');
  expect(rarityLabel(0.1, 'animals')).toBe('One of the 300 best-known animals');
  expect(rarityLabel(0.55, 'animals')).toBe('Rarer than 55% of the 3,000 best-known animals');
  expect(rarityLabel(0.94, 'animals')).toBe('Rarer than 94% of the 3,000 best-known animals');
  expect(rarityLabel(1, 'animals')).toBe('Rarer than every one of the 3,000 best-known animals');
});
it('removes only the accidental suffix, preserves special names and generates 10000+ pairs', () => {
  expect(cleanHandle('Tan Dove #6a325f64')).toBe('Tan Dove');
  for (const s of ['THE REGISTRAR', 'Withdrawn player', 'Teal Otter #41'])
    expect(cleanHandle(s)).toBe(s);
  expect(colors.length * animals.length).toBeGreaterThanOrEqual(10000);
  const cleaned = cleanStoredHandles({
    user: { handle: 'Tan Dove #6a325f64' },
    file: { events: [{ holder: 'Tan Dove #6a325f64' }] },
  });
  expect(JSON.stringify(cleaned)).not.toMatch(/#[0-9a-f]{5,}/);
  const players = [
    { id: 'a', handle: 'Tan Dove' },
    { id: 'b', handle: 'Tan Dove' },
    { id: 'c', handle: 'Teal Otter' },
  ];
  const names = displayNames(players);
  expect(names.get('a')).toMatch(/^Tan Dove #\d{2,3}$/);
  expect(names.get('b')).not.toBe(names.get('a'));
  expect(names.get('a')).toBe(`Tan Dove #${playerNumber('a')}`);
  expect(names.get('c')).toBe('Teal Otter');
  expect(displayNames(players.reverse())).toEqual(names);
});
it('computes a real finished-player percentile with half credit for ties and visibility rules', () => {
  const file = (id: string, points: number, closed = true, hidden = 0, eligible = true): any => ({
    user: { id, hidden },
    file: { closed, points, eligible },
  });
  const data = [
    file('a', 10),
    file('b', 20),
    file('c', 20),
    file('d', 30),
    file('open', 100, false),
    file('hidden', 100, true, 1),
    file('void', 100, true, 0, false),
  ];
  expect(finishedComparison(data, 'b')).toEqual({
    finished: 4,
    rank: 2,
    points: 20,
    percentile: 0.5,
  });
  expect(finishedComparison(data, 'a').percentile).toBe(0.125);
  expect(finishedComparison(data, 'd').percentile).toBe(0.875);
  expect(finishedComparison(data, 'open').percentile).toBeNull();
  expect(JSON.stringify(finishedComparison(data, 'b'))).not.toMatch(/answer|handle|display/);
});
it('preserves an unbreakable final pair, but leaves oversized pairs breakable', () => {
  expect(noOrphan('Come back tomorrow.')).toBe('Come back\u00a0tomorrow.');
  expect(noOrphan('A supercalifragilistic example.')).toBe('A supercalifragilistic example.');
});
it('cleans feedback and rejects link spam without interpreting HTML', () => {
  expect(feedbackText('Hi\u200b\n\tthere')).toEqual({ ok: true, text: 'Hi there' });
  expect(feedbackText('https://example.com')).toMatchObject({ ok: false });
  expect(feedbackText('See https://a.com https://b.com https://c.com')).toMatchObject({
    ok: false,
  });
  expect(feedbackText('See https://a.com and https://b.com')).toMatchObject({ ok: true });
  expect(feedbackText('<script>alert(1)</script>')).toEqual({
    ok: true,
    text: '<script>alert(1)</script>',
  });
});
it('shares durable hourly, IP and global feedback caps across restarts and dates', async () => {
  const data = new Map<string, any>();
  const storage: any = {
    transaction: async (fn: any) =>
      fn({
        get: async (k: string) => structuredClone(data.get(k)),
        put: async (k: string, v: any) => data.set(k, structuredClone(v)),
      }),
  };
  const now = Date.parse('2026-11-23T23:30:00Z');
  for (let i = 0; i < 3; i++) expect(await feedbackQuota(storage, 'a', 'ip', now)).toBeNull();
  expect(await feedbackQuota({ ...storage }, 'a', 'other', now)).toContain('hour');
  for (let i = 3; i < 20; i++)
    expect(await feedbackQuota(storage, 'user' + i, 'ip', now)).toBeNull();
  expect(await feedbackQuota(storage, 'other', 'ip', now)).toContain('tomorrow');
  for (let i = 20; i < 300; i++)
    expect(await feedbackQuota(storage, 'user' + i, 'ip' + i, now)).toBeNull();
  expect(await feedbackQuota(storage, 'last', 'last', now)).toBe(
    'Feedback is full for today. Try again tomorrow.',
  );
  // Daily reset cannot bypass the still-active hourly limit.
  expect(await feedbackQuota(storage, 'a', 'newday', now + 31 * 60000)).toContain('hour');
  expect(await feedbackQuota(storage, 'fresh', 'newday', now + 31 * 60000)).toBeNull();
  expect(await feedbackQuota(storage, 'a', 'newday', now + 61 * 60000)).toBeNull();
});
