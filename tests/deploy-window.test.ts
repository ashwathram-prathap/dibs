import { it, expect } from 'vitest';
import { deploymentBlocked } from '../shared/deploy-window';
it('enforces separate brand, Part A/B and launch freeze deadlines', () => {
  expect(deploymentBlocked(Date.parse('2026-11-23T17:00:00Z'), 'brand')).toBe(true);
  expect(deploymentBlocked(Date.parse('2026-11-23T17:00:00Z'), 'part-a')).toBe(false);
  expect(deploymentBlocked(Date.parse('2026-11-23T22:00:00Z'), 'part-b')).toBe(true);
  expect(deploymentBlocked(Date.parse('2026-11-24T05:00:00Z'), 'brand')).toBe(false);
});

it('R19F permits its explicit extension only up to 7:30 PM ET', () => {
  expect(deploymentBlocked(Date.parse('2026-11-23T19:29:59-05:00'), 'r19f')).toBe(false);
  expect(deploymentBlocked(Date.parse('2026-11-23T19:30:00-05:00'), 'r19f')).toBe(true);
  expect(deploymentBlocked(Date.parse('2026-11-23T17:00:00-05:00'))).toBe(true);
});

it('R19D uses only the owner extension and never deploys after 7:45 PM ET', () => {
  expect(deploymentBlocked(Date.parse('2026-11-23T19:44:59-05:00'), 'r19d')).toBe(false);
  expect(deploymentBlocked(Date.parse('2026-11-23T19:45:00-05:00'), 'r19d')).toBe(true);
  expect(deploymentBlocked(Date.parse('2026-11-24T02:00:00-05:00'), 'r19d')).toBe(true);
});

it('R19G blocks only 8:30–10 PM Toronto time every day, including DST', () => {
  for (const day of ['2026-11-23', '2026-11-24', '2027-07-01']) {
    const zone = day.includes('07-01') ? '-04:00' : '-05:00';
    for (const [time, blocked] of [
      ['20:29:59', false],
      ['20:30:00', true],
      ['21:59:59', true],
      ['22:00:00', false],
      ['23:31:00', false],
    ] as const)
      expect(deploymentBlocked(Date.parse(`${day}T${time}${zone}`), 'r19g')).toBe(blocked);
  }
});
