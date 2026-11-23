import { it, expect, vi, afterEach } from 'vitest';
import { dropTime, viewerZone, countdown } from '../shared/time';
import { goldenPerDay } from '../shared/config';
import { selectGolden, sha256, commitmentText } from '../worker/specials';
import { syncClock, serverNow } from '../src/clock';
import { summaryText } from '../src/share';
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('converts the fixed Toronto drop, including local day and DST', () => {
  const at = '2026-11-24T02:00:00Z';
  for (const [zone, expected] of [
    ['America/Toronto', '9:00 PM ET'],
    ['America/Vancouver', '7:00 PM PT'],
    ['Europe/London', 'Tue 2:00 AM GMT'],
    ['Asia/Kolkata', 'Tue 7:30 AM GMT+5:30'],
    ['Australia/Sydney', 'Tue 1:00 PM GMT+11'],
  ])
    expect(dropTime(at, zone).full).toBe(expected);
  expect(dropTime('2027-07-02T01:00:00Z', 'America/Vancouver').full).toBe('6:00 PM PT');
});
it.each(['', 'not/a-zone'])('falls back without asking permission for timezone %s', (zone) => {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    timeZone: zone,
  } as any);
  expect(viewerZone()).toBe('America/Toronto');
});
it.each([-600000, 600000])('corrects %i ms clock skew and clamps rollover', (skew) => {
  vi.useFakeTimers({ toFake: ['Date', 'performance'] });
  const server = Date.parse('2026-11-24T01:59:55Z');
  vi.setSystemTime(server + skew);
  syncClock(new Date(server).toISOString());
  expect(countdown('2026-11-24T02:00:00Z', serverNow())).toBe('00:00:05');
  vi.advanceTimersByTime(5000);
  expect(countdown('2026-11-24T02:00:00Z', serverNow())).toBe('00:00:00');
  vi.advanceTimersByTime(60000);
  expect(countdown('2026-11-24T02:00:00Z', serverNow())).toBe('00:00:00');
});
it('selects ten unique committed beta tickets, then three', async () => {
  expect(goldenPerDay('2026-11-22')).toBe(3);
  for (let day = 23; day <= 29; day++) expect(goldenPerDay(`2026-11-${day}`)).toBe(10);
  expect(goldenPerDay('2026-11-30')).toBe(3);
  const ids = Array.from({ length: 100 }, (_, i) => String(i));
  const chosen = await selectGolden(ids, 'seed', goldenPerDay('2026-11-23'));
  expect(new Set(chosen).size).toBe(10);
  expect(await selectGolden(ids.reverse(), 'seed', 10)).toEqual(chosen);
  expect(await sha256(commitmentText('beta', 'seed', chosen))).toMatch(/^[0-9a-f]{64}$/);
});
it('share text contains scores, rank and streak, never answers or holders', () => {
  const result = summaryText(
    {
      dibs: 1,
      strikes: 1,
      points: 140,
      rank: 3,
      players: 27,
      streak: 3,
      completedAt: '2026-11-24T02:06:00Z',
      events: [
        { kind: 'dibs', display: 'Axolotl', golden: true },
        { kind: 'strike', display: 'DOG', holder: 'Secret Holder' },
      ],
    } as any,
    { date: '2026-11-23', name: 'Animals' } as any,
  );
  expect(result).toBe("Dibs #1 · Nov 23 · Animals · 140 pts · #3 of 27 players today. dibs.here");
  expect(result).not.toMatch(/Axolotl|DOG|Secret Holder/);
});
