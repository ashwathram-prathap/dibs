export type Minute = {
  requests: number;
  errors: number;
  claims: number;
  strikes: number;
  completed: number;
  verifications: number;
  verificationFailures: number;
};
export const emptyMinute = (): Minute => ({
  requests: 0,
  errors: 0,
  claims: 0,
  strikes: 0,
  completed: 0,
  verifications: 0,
  verificationFailures: 0,
});
export const freeLimits = {
  requests: 100000,
  reads: 5000000,
  writes: 100000,
  storageBytes: 500000000,
};
export function alertConditions(minutes: Minute[], usage: Record<string, number>) {
  const alerts: { type: string; message: string }[] = [];
  if (minutes.length === 5 && minutes.every((m) => m.requests > 0 && m.errors / m.requests > 0.02))
    alerts.push({ type: 'errors', message: 'Dibs: error rate above 2% for five minutes.' });
  const checks = minutes.reduce((n, m) => n + m.verifications, 0),
    failures = minutes.reduce((n, m) => n + m.verificationFailures, 0);
  if (checks && failures / checks > 0.1)
    alerts.push({ type: 'turnstile', message: 'Dibs: verification failures above 10%.' });
  for (const [metric, limit] of Object.entries(freeLimits))
    for (const threshold of [0.7, 0.9])
      if ((usage[metric] || 0) >= limit * threshold)
        alerts.push({
          type: `${metric}-${threshold}`,
          message: `Dibs: measured ${metric} reached ${threshold * 100}% of the free limit.`,
        });
  return alerts;
}
