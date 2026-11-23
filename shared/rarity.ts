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

// Acklam's rational approximation; absolute error below 1.2e-9 for ordinary percentiles.
export function inverseNormalCDF(p: number) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472,
    2.50662827745924,
  ];
  const b = [
    -54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373,
    4.37466414146497, 2.93816398269878,
  ];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  if (p < 0.02425 || p > 0.97575) {
    const q = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
    const v =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return p < 0.5 ? v : -v;
  }
  const q = p - 0.5,
    r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}
export const bellSigma = (p: number) => Math.max(-2.6, Math.min(2.6, inverseNormalCDF(p)));
// Extra space outside ±2.6 sigma leaves both the marker and labels inside the graph.
export const bellX = (p: number) => 28 + ((bellSigma(p) + 3) / 6) * 464;
export const bellY = (sigma: number) => 108 - 86 * Math.exp(-0.5 * sigma * sigma);
export const bellPath = () =>
  Array.from({ length: 121 }, (_, i) => {
    const z = -3 + i / 20;
    return `${i ? 'L' : 'M'}${(28 + (i / 120) * 464).toFixed(3)},${bellY(z).toFixed(3)}`;
  }).join(' ');
export const bellArea = () => bellPath() + ' L492,108 L28,108 Z';
export function rarityLabel(percentile: number, category: string) {
  const percent = Math.min(99, Math.max(0, Math.round(percentile * 100)));
  const subject = category.toLowerCase().replaceAll('-', ' ');
  if (percent <= 10) return `One of the most familiar ${subject}`;
  return `Rarer than ${percent}% of ${subject}${percentile >= 0.9 && percentile < 0.99 ? ' · deep cut' : ''}`;
}
