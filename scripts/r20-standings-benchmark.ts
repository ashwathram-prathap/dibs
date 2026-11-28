import { DayStandings } from '../worker/day-standings';
import { orderScores, publicScores } from '../worker/leaderboard';
import { finishedComparisons } from '../worker/finished-scores';
import { writeFileSync } from 'node:fs';
const results = [];
for (const count of [100, 500, 1000, 5000, 10000]) {
  const files = Array.from({ length: count }, (_, i) => ({
    user: { id: 'player-' + i, handle: 'Tan Dove ' + i },
    file: {
      points: (i * 17) % 300,
      dibs: 3,
      closed: true,
      golden: false,
      reachedAt: String(i).padStart(8, '0'),
      events: Array(3).fill({}),
    },
    requests: {},
    streakDates: [],
  }));
  const board = new DayStandings();
  board.reset(files);
  const old: number[] = [],
    updated: number[] = [];
  for (let i = 0; i < 100; i++) {
    const index = (i * 97) % count;
    files[index].file.points = (i * 19) % 300;
    let start = performance.now();
    const scores = orderScores(
      files.map((s) => ({
        user_id: s.user.id,
        handle: s.user.handle,
        founder: false,
        points: s.file.points,
        dibs: s.file.dibs,
        golden: s.file.golden,
        reachedAt: s.file.reachedAt,
        events: s.file.events.length,
      })),
    );
    publicScores(scores, files[index].user.id);
    finishedComparisons(files);
    old.push(performance.now() - start);
    start = performance.now();
    board.update(files[index]);
    board.board(files[index].user.id);
    updated.push(performance.now() - start);
  }
  const stat = (x: number[]) => {
    x.sort((a, b) => a - b);
    return { p50Ms: x[49], p95Ms: x[94], p99Ms: x[98] };
  };
  results.push({
    players: count,
    updates: 100,
    fullReference: stat(old),
    incremental: stat(updated),
  });
}
const report = {
  at: new Date().toISOString(),
  environment: 'local Node CPU microbenchmark; no network, persistence or Worker limits',
  results,
  hostedCapacityProven: false,
};
writeFileSync('review/round20/standings-benchmark.json', JSON.stringify(report, null, 2));
console.log(report);
