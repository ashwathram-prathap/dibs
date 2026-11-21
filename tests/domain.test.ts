import { describe, it, expect } from 'vitest';
import { normalize, dropAt, registryDate, nextDrop, streak } from '../worker/domain';
import { hmac, verify } from '../worker/identity';
describe('registry rules', () => {
  it('folds case, accents, punctuation, whitespace and simple plurals', () => {
    expect(normalize('  Café-Axolotls ')).toBe(normalize('cafe axolotl'));
    expect(normalize('Cities')).toBe('city');
    expect(normalize('Mice')).toBe('mouse');
    expect(normalize('Walrus')).toBe('walrus');
  });
  it('opens at 9 PM Toronto across DST', () => {
    expect(dropAt('2026-07-01')).toBe('2026-07-02T01:00:00.000Z');
    expect(dropAt('2026-11-21')).toBe('2026-11-22T02:00:00.000Z');
    expect(registryDate(new Date('2026-11-22T01:59:59Z'))).toBe('2026-11-20');
    expect(registryDate(new Date('2026-11-22T02:00:00Z'))).toBe('2026-11-21');
    expect(nextDrop(new Date('2026-03-08T20:00:00Z'))).toBe('2026-03-09T01:00:00.000Z');
  });
  it('streak survives until the current registry ends', () => {
    expect(streak(['2026-11-19', '2026-11-18'], '2026-11-20')).toBe(2);
    expect(streak(['2026-11-18'], '2026-11-20')).toBe(0);
  });
  it('rejects a changed signed identity', async () => {
    const sig = await hmac('user', 'secret');
    expect(await verify('user', sig, 'secret')).toBe(true);
    expect(await verify('other', sig, 'secret')).toBe(false);
    expect(await verify('user', 'bad', 'secret')).toBe(false);
  });
});
