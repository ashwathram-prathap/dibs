import { it, expect } from 'vitest';
import { r18DeploymentAllowed } from '../shared/r18-release';
it('forbids every R18 production deployment from the exact 3 PM ET cutoff onward', () => {
  expect(r18DeploymentAllowed(Date.parse('2026-11-23T19:59:59.999Z'))).toBe(true);
  expect(r18DeploymentAllowed(Date.parse('2026-11-23T20:00:00Z'))).toBe(false);
  expect(r18DeploymentAllowed(Date.parse('2026-11-24T10:00:00Z'))).toBe(false);
});
