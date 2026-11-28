export const FREE_DAILY = {
  workerRequests: 100000,
  doRequests: 100000,
  d1Reads: 5000000,
  d1Writes: 100000,
  doReads: 5000000,
  doWrites: 100000,
  doGBs: 13000,
  doStorageBytes: 5000000000,
  d1StorageBytes: 5000000000,
};
export type BudgetUnits = Record<keyof typeof FREE_DAILY, number>;
/** Inputs cover the whole account and the same UTC day, including failed attempts. */
export function loadBudget(
  now: number,
  at: number,
  utcDay: string,
  used: BudgetUnits,
  campaign: BudgetUnits,
  forecastAndSafety: BudgetUnits,
  next: BudgetUnits,
) {
  const reasons: string[] = [];
  if (
    !Number.isFinite(at) ||
    now - at > 5 * 60000 ||
    at > now ||
    utcDay !== new Date(now).toISOString().slice(0, 10)
  )
    reasons.push('Missing/stale account usage or wrong UTC quota day');
  for (const k of Object.keys(FREE_DAILY) as (keyof BudgetUnits)[]) {
    const limit = FREE_DAILY[k];
    if (
      [used[k], campaign[k], forecastAndSafety[k], next[k]].some(
        (v) => !Number.isFinite(v) || v < 0,
      )
    ) {
      reasons.push(k + ': unavailable');
      continue;
    }
    const allowance = Math.min(
      0.2 * limit - campaign[k],
      limit - used[k] - Math.max(0.3 * limit, forecastAndSafety[k]),
    );
    if (next[k] > 0.2 * limit || next[k] > allowance)
      reasons.push(k + ': insufficient cumulative headroom');
  }
  return { allowed: reasons.length === 0, reasons };
}
