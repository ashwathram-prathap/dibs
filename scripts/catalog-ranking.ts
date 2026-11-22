export type Readership = {
  total: number | null;
  days: number;
  title?: string;
  status: string;
  [key: string]: unknown;
};
export function bestReadership(readings: Readership[]): Readership {
  if (!readings.length) return { total: null, days: 0, status: 'unavailable' };
  return [...readings].sort(
    (a, b) =>
      (b.days ? Number(b.total) / b.days : -1) - (a.days ? Number(a.total) / a.days : -1) ||
      (a.title || '').localeCompare(b.title || ''),
  )[0];
}
