import { it, expect } from 'vitest';
import { alertConditions, emptyMinute } from '../worker/monitoring';
it('requires five sustained error minutes and independently raises 70/90 percent alerts', () => {
  const minute = {
    ...emptyMinute(),
    requests: 100,
    errors: 3,
    verifications: 10,
    verificationFailures: 2,
  };
  expect(alertConditions([minute], { reads: 3500000 }).map((a) => a.type)).toEqual([
    'turnstile',
    'reads-0.7',
  ]);
  expect(alertConditions(Array(5).fill(minute), { writes: 90000 }).map((a) => a.type)).toEqual([
    'errors',
    'turnstile',
    'writes-0.7',
    'writes-0.9',
  ]);
  expect(
    alertConditions([...Array(4).fill(minute), emptyMinute()], {}).some((a) => a.type === 'errors'),
  ).toBe(false);
});
