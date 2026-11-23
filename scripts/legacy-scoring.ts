// Frozen R14–R19C algorithms: only used to reproduce immutable rollback assets.
// Never update these when changing current scoring.
export function legacyRarityPoints(percentile: number) {
  return Math.round((10 + 100 * Math.max(0, Math.min(1, percentile) - 0.1)) / 5) * 5;
}
export function legacyRankPopularity(values: (number | null)[]) {
  const measured = values.filter((v): v is number => v !== null).sort((a, b) => b - a);
  const ranks = new Map<number, number>();
  for (let i = 0; i < measured.length;) {
    let end = i + 1;
    while (end < measured.length && measured[end] === measured[i]) end++;
    ranks.set(
      measured[i],
      measured.length === 1 ? 0.5 : (i + (end - i - 1) / 2) / (measured.length - 1),
    );
    i = end;
  }
  const scores = measured.map((v) => legacyRarityPoints(ranks.get(v)!)).sort((a, b) => a - b);
  const median = scores.length
    ? Math.round(
        (scores[Math.floor((scores.length - 1) / 2)] + scores[Math.floor(scores.length / 2)]) / 10,
      ) * 5
    : 50;
  return { median, percentiles: values.map((v) => (v === null ? null : ranks.get(v)!)) };
}
