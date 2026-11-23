import { expect, it } from 'vitest';
import { fitLine } from '../shared/typography';
import { claimScore } from '../shared/claim-copy';
import { summaryText, certificateText } from '../src/share';
it('fits long footer URLs without going below the minimum or losing both identifying ends', () => {
  const measure = (text: string, size: number) => [...text].length * size;
  for (const width of [100, 920, 1080]) {
    const value = 'practice.dibs-7hz.pages.dev/summary/' + 'x'.repeat(400) + '123456';
    const fitted = fitLine(value, measure, width, 24, 14);
    expect(fitted.size).toBe(14);
    expect(measure(fitted.text, fitted.size)).toBeLessThanOrEqual(width);
    expect(fitted.text).toContain('…');
    expect(fitted.text.startsWith('pra')).toBe(true);
    expect(fitted.text.endsWith('456')).toBe(true);
  }
  expect(fitLine('dibs.here', measure, 920, 24)).toEqual({ text: 'dibs.here', size: 24 });
});
it('uses the stored golden total without adding or losing the bonus in copied results', () => {
  for (const base of [10, 55, 60, 100]) {
    const claim: any = {
      display: 'Quokka',
      golden: true,
      bonus: 100,
      points: base + 100,
      percentile: 0.94,
      category_name: 'Animals',
      category_date: '2026-11-23',
    };
    const file: any = { claims: [claim], points: claim.points - 10, rank: 3, players: 27 };
    const category: any = { name: 'Animals', date: claim.category_date };
    for (const text of [claimScore(claim), certificateText(claim), summaryText(file, category)]) {
      expect(text).toContain(`${claim.points} points`);
      expect(text).toContain(`${base} + 100 golden bonus`);
    }
    expect(summaryText(file, category)).toContain(`${file.points} pts`);
  }
});

import { filingTime } from '../shared/time';
it('files the date and time in the selected named zone on either side of midnight', () => {
  expect(filingTime('2026-11-23T02:52:00Z', 'America/Toronto')).toBe(
    'Nov 22, 9:52 PM Toronto time',
  );
  expect(filingTime('2026-11-23T02:52:00Z', 'Asia/Tokyo')).toBe('Nov 23, 11:52 AM Japan time');
  expect(filingTime('2026-11-23T02:52:00Z', 'Australia/Sydney')).not.toContain('GMT');
});
