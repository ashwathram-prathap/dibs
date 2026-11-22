import { expect, it } from 'vitest';
import { bestReadership } from '../scripts/catalog-ranking';
it('ranks a shared work title by its most-read eligible article, independent of source order', () => {
  const readings = [
    { title: 'Crash (1996 film)', total: 3100, days: 31, status: 'measured' },
    { title: 'Crash (2004 film)', total: 62000, days: 31, status: 'measured' },
    { title: 'Crash (unmeasured work)', total: null, days: 0, status: 'no article' },
  ];
  expect(bestReadership(readings).title).toBe('Crash (2004 film)');
  expect(bestReadership(readings.toReversed()).title).toBe('Crash (2004 film)');
  expect(
    bestReadership([
      { total: 0, days: 31, status: 'measured' },
      { total: null, days: 0, status: 'unavailable' },
    ]).status,
  ).toBe('measured');
});
