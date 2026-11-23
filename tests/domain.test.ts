import { describe, it, expect } from 'vitest';
import {
  normalize,
  normalizeCommonName,
  dropAt,
  registryDate,
  nextDrop,
  streak,
  validDate,
} from '../worker/domain';
import { hmac, verify } from '../worker/identity';
describe('registry rules', () => {
  it('folds case, accents, punctuation and whitespace while preserving proper names', () => {
    expect(normalize('  Café-Axolotls ')).toBe(normalize('cafe axolotls'));
    expect(normalize('Cities')).toBe('cities');
    expect(normalize('Cars')).not.toBe(normalize('Car'));
    expect(normalize('Dallas')).not.toBe(normalize('Dalla'));
    expect(normalizeCommonName('Mice')).toBe('mouse');
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

import { fitText } from '../shared/typography';
it('fits long unbroken names without escaping the printed area', () => {
  const measure = (text: string, size: number) => text.length * size;
  const layout = fitText('W'.repeat(120), measure, 910, {
    startSize: 145,
    minSize: 20,
    maxLines: 3,
    maxHeight: 270,
    lineHeight: 0.9,
  });
  expect(layout.lines.join('')).toBe('W'.repeat(120));
  expect(layout.lines.every((line) => measure(line, layout.size) <= 910)).toBe(true);
  expect(layout.lines.length * layout.size * 0.9).toBeLessThanOrEqual(270);
});

it('rejects impossible schedule dates', () => {
  expect(validDate('2026-02-29')).toBe(false);
  expect(validDate('2028-02-29')).toBe(true);
  expect(validDate('2026-13-01')).toBe(false);
  expect(validDate('2026-11-21')).toBe(true);
});

it('keeps whole words on a certificate before resorting to letter wrapping', () => {
  const fitted = fitText('CHEZICHED BINY', (text, size) => text.length * size, 910, {
    startSize: 145,
    minSize: 20,
    maxLines: 3,
    maxHeight: 270,
    lineHeight: 0.9,
  });
  expect(fitted.lines).toEqual(['CHEZICHED\u00a0BINY']);
  expect(fitted.lines[0].length * fitted.size).toBeLessThanOrEqual(910);
});
