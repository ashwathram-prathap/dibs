import { it, expect } from 'vitest';
import { resolveLegacyStrikes, struckEvent, type StruckCache } from '../worker/repeat-guess';
import { deploymentBlocked, R19I_CUTOFF } from '../shared/deploy-window';
import { REPEAT_GUESS_EXPLANATION } from '../shared/copy';

// Strikes journaled before R19I carry only the typed text; they resolve once to an answer_id.
const catalog: Record<string, string> = {
  lion: 'a:lion',
  lions: 'a:lion',
  'panthera leo': 'a:lion',
  dog: 'a:dog',
};
const resolve = async (typed: string) => catalog[typed.trim().toLowerCase()] ?? null;

it('R19I resolves pre-R19I strikes (no answerId) and matches any form of the same answer', async () => {
  const cache: StruckCache = new Map();
  const events = [
    { kind: 'strike', at: '2026-11-24T02:00:00.000Z', display: 'LIONS', holder: 'Teal Otter' },
    { kind: 'dibs', at: '2026-11-24T02:01:00.000Z', display: 'Okapi' },
    { kind: 'strike', at: '2026-11-24T02:02:00.000Z', display: 'DOG', house: true },
  ];
  let calls = 0;
  const counted = async (t: string) => (calls++, resolve(t));
  await resolveLegacyStrikes(cache, 'u1', events, counted);
  await resolveLegacyStrikes(cache, 'u1', events, counted);
  expect(calls).toBe(2); // once per legacy strike, never again
  expect(struckEvent(cache, 'u1', events, 'a:lion')?.holder).toBe('Teal Otter');
  expect(struckEvent(cache, 'u1', events, 'a:dog')?.house).toBe(true);
  expect(struckEvent(cache, 'u1', events, 'a:okapi')).toBeUndefined();
  // Another player's cache entries never apply.
  expect(struckEvent(cache, 'u2', events, 'a:lion')).toBeUndefined();
});
it('R19I prefers the stored answerId on new strikes and never matches claims', async () => {
  const cache: StruckCache = new Map();
  const events = [
    { kind: 'strike', at: 't1', answerId: 'a:lion', display: 'KING OF BEASTS' },
    { kind: 'dibs', at: 't2', answerId: 'a:okapi', display: 'Okapi' },
  ];
  await resolveLegacyStrikes(cache, 'u', events, async () => {
    throw Error('no lookup needed');
  });
  expect(struckEvent(cache, 'u', events, 'a:lion')?.at).toBe('t1');
  expect(struckEvent(cache, 'u', events, 'a:okapi')).toBeUndefined();
});
it('R19I production guard: only before Tue Nov 24, 5:00 PM ET and never in the 8:30–10 PM freeze', () => {
  const at = (s: string) => Date.parse(s);
  expect(deploymentBlocked(at('2026-11-24T06:16:00-05:00'), 'r19i')).toBe(true);
  expect(deploymentBlocked(at('2026-11-24T07:00:00-05:00'), 'r19i')).toBe(false);
  expect(deploymentBlocked(at('2026-11-24T16:59:59-05:00'), 'r19i')).toBe(false);
  expect(deploymentBlocked(R19I_CUTOFF, 'r19i')).toBe(true);
  expect(deploymentBlocked(at('2026-11-24T21:00:00-05:00'), 'r19i')).toBe(true);
  expect(deploymentBlocked(at('2026-11-25T10:00:00-05:00'), 'r19i')).toBe(true);
});
it('R19I copy', () => {
  expect(REPEAT_GUESS_EXPLANATION).toBe(
    'Guessing the same taken answer twice never costs a second strike.',
  );
});
