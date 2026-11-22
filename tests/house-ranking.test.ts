import { it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import house from '../worker/house-words.json';
import { summaryText } from '../src/share';
it('holds exactly the ten highest measured daily pageview entries in every approved catalog', () => {
  for (const file of readdirSync('categories').filter((f) => f.endsWith('.json'))) {
    const c = JSON.parse(readFileSync('categories/' + file, 'utf8'));
    const expected = [...c.answers]
      .sort(
        (a, b) =>
          b.pageviews.total / b.pageviews.days - a.pageviews.total / a.pageviews.days ||
          a.display.localeCompare(b.display),
      )
      .slice(0, 10)
      .map((a) => a.display);
    expect((house as any)[c.slug]).toEqual(expected);
    expect(new Set(expected).size).toBe(10);
  }
});
it('does not ship a public answer catalog or import the house list into client code', () => {
  expect(existsSync('public/catalog')).toBe(false);
  for (const f of readdirSync('src').filter((f) => /\.tsx?$/.test(f)))
    expect(readFileSync('src/' + f, 'utf8')).not.toMatch(/house-words|daily_specials|golden_json/);
});
it('prints a star at the claimed golden event and numbers Monday as the first drop', () => {
  expect(
    summaryText(
      {
        events: [
          { kind: 'dibs' },
          { kind: 'dibs', golden: true },
          { kind: 'dibs' },
          { kind: 'strike' },
        ],
        dibs: 3,
        strikes: 1,
        completedAt: '2026-11-24T02:04:00Z',
      } as any,
      { date: '2026-11-23' } as any,
    ),
  ).toBe('Dibs #1 ■★■□ 3/3 · 1 strike · filed 9:04 PM');
});
