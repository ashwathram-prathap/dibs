import { it, expect } from 'vitest';
import { DayStandings } from '../worker/day-standings';
import { orderScores, publicScores } from '../worker/leaderboard';
import { finishedComparisons } from '../worker/finished-scores';
import type { JournalFile } from '../worker/event-journal';
function reference(files: JournalFile[], uid: string) {
  const rows = orderScores(
    files
      .filter((s) => !s.user.hidden && s.file.eligible !== false && s.file.dibs > 0)
      .map((s) => ({
        user_id: s.user.id,
        handle: s.user.handle,
        founder: !!s.user.founder,
        points: s.file.points,
        dibs: s.file.dibs,
        golden: !!s.file.golden,
        reachedAt: s.file.reachedAt,
        events: s.file.events.length,
      })),
  );
  const comparisons = finishedComparisons(files);
  return {
    ...publicScores(rows, uid, 25, true),
    comparison: comparisons.own.get(uid) || comparisons.empty,
  };
}
it('matches full reference after accepted events, ties, moderation, withdrawal and restart', () => {
  const board = new DayStandings(),
    files = new Map<string, JournalFile>();
  let seed = 17;
  const rand = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let step = 0; step < 1200; step++) {
    const id = 'player-' + rand(150),
      dibs = rand(4),
      strikes = rand(6);
    const file: JournalFile = {
      user: {
        id,
        handle: rand(9) ? 'Tan Dove' : 'Withdrawn player',
        hidden: rand(10) === 0,
        founder: rand(15) === 0,
      },
      file: {
        points: rand(8) * 10,
        dibs,
        strikes,
        closed: dibs === 3 || strikes === 5,
        eligible: rand(15) !== 0,
        reachedAt: '2026-11-28T02:00:0' + rand(10) + 'Z',
        golden: rand(8) === 0,
        events: Array(dibs + strikes).fill({}),
      },
      requests: {},
      streakDates: [],
    };
    files.set(id, file);
    board.update(file);
    if (step % 100 === 0) board.reset(files.values());
    for (const uid of [id, 'player-0', 'unknown'])
      expect(board.board(uid)).toEqual(reference([...files.values()], uid));
  }
});
it('keeps incomplete claimers separate from strike-only finishers and supports negative fixture totals', () => {
  const files: JournalFile[] = Array.from({ length: 30 }, (_, i) => ({
    user: { id: String(i), handle: 'Player' },
    file: {
      points: i % 3 === 0 ? -10 : 0,
      dibs: i % 2,
      strikes: i % 2 ? 0 : 5,
      closed: i % 2 === 0,
      reachedAt: String(i),
      events: [],
    },
    requests: {},
    streakDates: [],
  }));
  const b = new DayStandings();
  b.reset(files);
  for (const s of files) expect(b.board(s.user.id)).toEqual(reference(files, s.user.id));
});
