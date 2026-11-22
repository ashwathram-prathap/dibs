import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  chooseTopic,
  dayAfter,
  leadTime,
  pruneCatalogs,
  type CalendarDay,
} from '../shared/calendar';
import { discoverRecipe } from '../scripts/recipe-discovery';
it('enforces 24/72-hour boundaries', () => {
  const now = Date.parse('2026-11-22T00:00:00Z');
  expect(() => leadTime('2026-11-23T00:00:00Z', now)).not.toThrow();
  expect(() => leadTime('2026-11-22T23:59:59Z', now)).toThrow('24');
  expect(() => leadTime('2026-11-24T23:59:59Z', now, true)).toThrow('72');
  expect(() => leadTime('2026-11-25T00:00:00Z', now, true)).not.toThrow();
});
it('seeds the preserved first plan through December without repeats or adjacent similar types', () => {
  const coverage = JSON.parse(readFileSync('review/coverage/results.json', 'utf8'));
  const topics = coverage
    .filter((c: any) => c.ready)
    .map((c: any) => ({
      ...JSON.parse(readFileSync('recipes/' + c.slug + '.json', 'utf8')),
      ready: true,
    }));
  const days: CalendarDay[] = ['animals', 'plants', 'birds', 'cities', 'actors'].map((slug, i) => ({
    date: dayAfter('2026-11-23', i),
    slug,
    status: 'ready',
    revision: 1,
  }));
  for (let date = '2026-11-28'; date <= '2026-12-31'; date = dayAfter(date)) {
    const { topic } = chooseTopic(date, days, topics);
    expect(
      days.filter((d) => d.date >= dayAfter(date, -21)).some((d) => d.slug === topic.slug),
    ).toBe(false);
    expect(topics.find((t: any) => t.slug === days.at(-1)?.slug).kind).not.toBe(topic.kind);
    days.push({ date, slug: topic.slug, status: 'requested', revision: 1 });
  }
  expect(days).toHaveLength(39);
});
it('keeps live/upcoming and recent versions, including shared versions, during cleanup', () => {
  const now = Date.parse('2026-12-10T00:00:00Z');
  const kept = pruneCatalogs(
    [
      { slug: 'a', version: '1', date: '2026-11-20', closeAt: '2026-11-21T00:00:00Z' },
      { slug: 'b', version: '1', date: '2026-12-07', closeAt: '2026-12-08T00:00:00Z' },
      { slug: 'a', version: '1', date: '2026-12-12', closeAt: '2026-12-13T00:00:00Z' },
      { slug: 'c', version: '2', date: null },
      { slug: 'a', version: 'old', date: '2026-11-20', closeAt: '2026-11-21T00:00:00Z' },
    ],
    now,
  );
  expect([...kept].sort()).toEqual(['a/1', 'b/1']);
});
it('matches only audited request names and refuses failed or fabricated recipes', () => {
  const r = [{ slug: 'films', name: 'Films', requestNames: ['Movies'] }];
  expect(discoverRecipe('Movies', r, [{ slug: 'films', ready: true }]).slug).toBe('films');
  expect(discoverRecipe('Movies', r, [{ slug: 'films', ready: false }]).slug).toBeUndefined();
  expect(discoverRecipe('Car brands', r, []).reason).toContain('Needs recipe');
});
