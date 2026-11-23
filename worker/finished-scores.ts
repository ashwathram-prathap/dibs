import type { JournalFile } from './event-journal';
import type { FinishedComparison } from '../shared/finished-scores';
/** Half credit for ties, including the player's own finished file. No answer data leaves here. */
export function finishedComparison(files: JournalFile[], uid?: string): FinishedComparison {
  const eligible = files.filter(
    (s) => s.file.closed && !s.user.hidden && s.file.eligible !== false,
  );
  const own = eligible.find((s) => s.user.id === uid);
  if (!own) return { finished: eligible.length, percentile: null, rank: null, points: null };
  const points = own.file.points || 0;
  const lower = eligible.filter((s) => (s.file.points || 0) < points).length;
  const equal = eligible.filter((s) => (s.file.points || 0) === points).length;
  return {
    finished: eligible.length,
    percentile: (lower + equal / 2) / eligible.length,
    rank: eligible.filter((s) => (s.file.points || 0) > points).length + 1,
    points,
  };
}

export function finishedComparisons(files: JournalFile[]) {
  const rows = files
    .filter((s) => s.file.closed && !s.user.hidden && s.file.eligible !== false)
    .sort((a, b) => (a.file.points || 0) - (b.file.points || 0));
  const own = new Map<string, FinishedComparison>();
  for (let i = 0; i < rows.length;) {
    let end = i + 1;
    while (end < rows.length && (rows[end].file.points || 0) === (rows[i].file.points || 0)) end++;
    for (let j = i; j < end; j++)
      own.set(rows[j].user.id, {
        finished: rows.length,
        points: rows[j].file.points || 0,
        rank: rows.length - end + 1,
        percentile: (i + (end - i) / 2) / rows.length,
      });
    i = end;
  }
  return {
    own,
    empty: {
      finished: rows.length,
      percentile: null,
      rank: null,
      points: null,
    } as FinishedComparison,
  };
}
