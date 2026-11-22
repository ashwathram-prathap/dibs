import { readCategory } from '../scripts/category-file';
import { it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import house from '../worker/house-words.json';
import { summaryText } from '../src/share';
it('holds exactly the ten highest measured daily pageview entries in every approved catalog', () => {
  for (const file of readdirSync('categories').filter((f) => f.endsWith('.json'))) {
    const c = readCategory('categories/' + file);
    const expected = c.answers
      .filter((a: any) => a.pageviews?.days > 0)
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
it('keeps golden status out of public catalog assets and client code', () => {
  if (existsSync('public/catalog'))
    for (const f of readdirSync('public/catalog', { recursive: true }).filter((f) =>
      String(f).endsWith('.json'),
    )) {
      const data = JSON.parse(readFileSync('public/catalog/' + f, 'utf8'));
      if (String(f).endsWith('manifest.json')) {
        expect(
          Object.keys(data)
            .filter((key) => !['indexFormat', 'indexChunks', 'rowChunkSize'].includes(key))
            .sort(),
        ).toEqual(['count', 'house', 'scope', 'slug', 'v', 'version']);
        continue;
      }
      if (String(f).endsWith('/full.json')) {
        expect(
          Object.keys(data)
            .filter((key) => !['indexFormat', 'indexChunks', 'rowChunkSize'].includes(key))
            .sort(),
        ).toEqual(['ids', 'keys', 'rows']);
        expect(Buffer.from(data.ids, 'base64').length).toBe(data.keys.length * 4);
        expect(data.rows.every((r: any) => Array.isArray(r) && r.length === 3)).toBe(true);
        continue;
      }
      if (String(f).includes('/typos-')) {
        expect(
          data.every(
            (row: any) =>
              row.length === 3 &&
              typeof row[0] === 'string' &&
              Number.isInteger(row[1]) &&
              typeof row[2] === 'object',
          ),
        ).toBe(true);
        continue;
      }
      expect(
        (Array.isArray(data) ? data : Object.values(data)).every(
          (row: any) =>
            row.length === 3 &&
            typeof row[0] === 'number' &&
            typeof row[1] === 'string' &&
            (row[2] === null || Number.isInteger(row[2])),
        ),
      ).toBe(true);
    }
  for (const f of readdirSync('src').filter((f) => /\.tsx?$/.test(f)))
    expect(readFileSync('src/' + f, 'utf8')).not.toMatch(/house-words|daily_specials|golden_json/);
});
it('prints a spoiler-free square for each claimed event and numbers Monday as the first drop', () => {
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
  ).toBe('Dibs #1 ■■■□ 3/3 dibs · 1 strike · filed 9:04 PM ET · Next drop: 9 PM ET');
});
