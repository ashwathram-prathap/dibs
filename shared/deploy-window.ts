export function deploymentBlocked(
  now: number,
  stage: 'base' | 'part-a' | 'brand' | 'part-b' = 'base',
) {
  const start =
    stage === 'brand'
      ? '2026-11-23T12:00:00-05:00'
      : stage === 'base'
        ? '2026-11-23T17:00:00-05:00'
        : '2026-11-23T17:00:00-05:00';
  return now >= Date.parse(start) && now < Date.parse('2026-11-24T00:00:00-05:00');
}
