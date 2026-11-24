export function deploymentBlocked(
  now: number,
  stage: 'base' | 'part-a' | 'brand' | 'part-b' | 'r19f' | 'r19d' | 'r19g' = 'base',
) {
  if (stage === 'r19g') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(now));
    const minutes =
      Number(parts.find((p) => p.type === 'hour')!.value) * 60 +
      Number(parts.find((p) => p.type === 'minute')!.value);
    return minutes >= 20 * 60 + 30 && minutes < 22 * 60;
  }
  if (stage === 'r19d') return now >= Date.parse('2026-11-23T19:45:00-05:00');
  const start =
    stage === 'r19f'
      ? '2026-11-23T19:30:00-05:00'
      : stage === 'brand'
        ? '2026-11-23T12:00:00-05:00'
        : stage === 'base'
          ? '2026-11-23T17:00:00-05:00'
          : '2026-11-23T17:00:00-05:00';
  return now >= Date.parse(start) && now < Date.parse('2026-11-24T00:00:00-05:00');
}
