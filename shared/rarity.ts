// Gaussian smoothing of the actual percentile ranks used to score this catalog.
// Missing pageview observations are omitted, never fabricated.
export function rarityDensity(percentiles: (number | null)[], bins = 48) {
  const values = percentiles.filter((p): p is number => p !== null && Number.isFinite(p));
  const heights = Array.from({ length: bins }, (_, i) => {
    const x = i / (bins - 1);
    return values.reduce((sum, p) => sum + Math.exp(-0.5 * ((x - p) / 0.045) ** 2), 0);
  });
  const max = Math.max(...heights, 1);
  return {
    basis: 'percentile' as const,
    measured: values.length,
    density: heights.map((h) => Math.round((h / max) * 1000) / 1000),
  };
}
export function rarityPosition(percentile: number) {
  return Math.max(0, Math.min(1, percentile));
}
export function rarityPath(density: number[]) {
  return density
    .map(
      (h, i) =>
        `${i ? 'L' : 'M'}${((i / (density.length - 1)) * 400).toFixed(2)},${(44 - h * 40).toFixed(2)}`,
    )
    .join(' ');
}
