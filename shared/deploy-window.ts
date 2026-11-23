export function deploymentBlocked(
  now: number,
  stage: 'base' | 'part-a' | 'brand' | 'part-b' | 'r19f' | 'r19d' = 'base',
) {
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
