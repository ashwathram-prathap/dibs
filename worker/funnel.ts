import type { JournalFile } from './event-journal';
/** One category only. Mirror/legacy callers must deduplicate by identity first. */
export function funnel(files: Iterable<JournalFile>) {
  let participants = 0,
    claimers = 0,
    claims = 0,
    finished = 0,
    struckOut = 0,
    excluded = 0;
  const exact = [0, 0, 0, 0],
    reached = [0, 0, 0, 0],
    intervals: number[] = [];
  for (const s of files) {
    if (
      s.user.hidden ||
      s.user.test ||
      s.file.eligible === false ||
      ['Withdrawn player', 'Record withheld'].includes(s.user.handle)
    ) {
      excluded++;
      continue;
    }
    const count = s.file.claims.filter((c: any) => !c.voided).length,
      strikes = s.file.strikes || 0;
    if (!count && !strikes) continue;
    participants++;
    claims += count;
    if (count) claimers++;
    if (count <= 3) exact[count]++;
    for (let i = 1; i <= 3; i++) if (count >= i) reached[i]++;
    if (strikes >= 5) struckOut++;
    if (count >= 3 || strikes >= 5) finished++;
    const times = s.file.claims
      .filter((c: any) => !c.voided)
      .map((c: any) => Date.parse(c.created_at));
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (Number.isFinite(gap) && gap >= 0) intervals.push(gap);
    }
  }
  intervals.sort((a, b) => a - b);
  const n = intervals.length;
  return {
    participants,
    claimers,
    claims,
    exactly1: exact[1],
    exactly2: exact[2],
    exactly3: exact[3],
    reached1: reached[1],
    reached2: reached[2],
    reached3: reached[3],
    struckOut,
    finished,
    finishRate: participants ? finished / participants : null,
    excluded,
    medianBetweenClaimsMs: n ? (intervals[(n - 1) >> 1] + intervals[n >> 1]) / 2 : null,
    intervalSamples: n,
  };
}
