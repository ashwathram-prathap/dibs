import { hmac } from './identity';
import { isLocal } from '../shared/security';
export type Gate = {
  start: number;
  count: number;
  failures: number;
  lockedUntil: number;
  expires: number;
};
// Return a new state so Durable Object transactions can retry without side effects.
export function gate(previous: Gate | undefined, now: number, valid: boolean, admin: boolean) {
  let state: Gate =
    previous && previous.expires > now
      ? { ...previous }
      : { start: now, count: 0, failures: 0, lockedUntil: 0, expires: now + 900000 };
  if (state.lockedUntil > now) return { state, status: 404 };
  if (state.lockedUntil)
    state = { start: now, count: 0, failures: 0, lockedUntil: 0, expires: now + 900000 };
  if (now - state.start >= 60000) {
    state.start = now;
    state.count = 0;
  }
  state.count++;
  if (admin && !valid) {
    state.failures++;
    if (state.failures >= 10) state.lockedUntil = now + 900000;
    state.expires = now + 900000;
    return { state, status: 404 };
  }
  if (admin) state.failures = 0;
  state.expires = now + 900000;
  return { state, status: state.count > (admin ? 60 : 30) ? 429 : 200 };
}
// Only the platform header (or explicit local-test header) identifies a network.
// Missing IPs must never become one worldwide bucket.
export function clientIp(req: Request, local?: string): string | null {
  const value =
    (isLocal(req, local) ? req.headers.get('x-test-ip') : null) ||
    req.headers.get('CF-Connecting-IP');
  return value && value !== 'unknown' ? value : null;
}
export async function securityKey(req: Request, secret: string, local?: string) {
  const ip = clientIp(req, local);
  return ip ? hmac(ip, await hmac('security-rate-limit', secret)) : null;
}
export const NETWORK_BUSY =
  'Too many new players from this network right now. Try again in a few minutes, or switch to mobile data.';
