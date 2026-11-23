// Percentile is 0 at the popular end and 1 at the rare end. The top decile is flat.
export function rarityPoints(percentile: number) {
  return Math.round((10 + (100 / 0.9) * Math.max(0, Math.min(1, percentile) - 0.1)) / 5) * 5;
}
