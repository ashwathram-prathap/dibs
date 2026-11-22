import { readCategory } from '../scripts/category-file';
import { it, expect } from 'vitest';
import { normalize, normalizeCommonName } from '../worker/domain';
import { fileKey, normalizeFileKey, hmac } from '../worker/identity';
import { shardFor, editDistance } from '../shared/catalog';
import { categoryPlural } from '../shared/category-copy';
import { readFileSync, readdirSync } from 'node:fs';
it('normalizes intended plurals, accents and Saint abbreviations', () => {
  for (const [a, b] of [
    ['wolves', 'wolf'],
    ['mice', 'mouse'],
    ['octopi', 'octopus'],
    ['octopuses', 'octopus'],
    ['St. Louis', 'Saint Louis'],
    ['Montréal', 'Montreal'],
  ])
    expect(normalizeCommonName(a)).toBe(normalizeCommonName(b));
});
it('creates stable high-entropy file keys and stores only a one-way digest', async () => {
  const a = await fileKey('one', 'test-key'),
    b = await fileKey('two', 'test-key');
  expect(a).not.toBe(b);
  expect(a).toMatch(/^DIBS(-[A-F0-9]{5}){4}$/);
  expect(await fileKey('one', 'test-key')).toBe(a);
  expect(await hmac(normalizeFileKey(a), 'test-key')).not.toContain(a);
});
it('bounds static shards and distinguishes near misses from random guesses', () => {
  expect(shardFor('chameleon')).toBeLessThan(256);
  expect(editDistance('chamelon', 'chameleon')).toBe(1);
  expect(editDistance('cat', 'aardvark')).toBeGreaterThan(2);
});
it('uses a proper plural noun for every catalog, including practice Animals', () => {
  for (const f of readdirSync('categories').filter((f) => f.endsWith('.json'))) {
    const c = readCategory('categories/' + f);
    const copy = `Call dibs on up to 3 ${categoryPlural(c)}.`;
    expect(copy).not.toMatch(/3 practice|3 television\.|3 animal\./i);
    expect(categoryPlural(c).length).toBeGreaterThan(2);
  }
  expect(categoryPlural({ name: 'PRACTICE', slug: 'animals' })).toBe('animals');
});

it('accepts explicit plural aliases without conflating proper-name titles', () => {
  const category = JSON.parse(readFileSync('categories/animals.json', 'utf8'));
  const owners = new Map(
    category.answers.flatMap((a: any, i: number) =>
      [a.display, ...a.aliases].map((s: string) => [normalize(s), i]),
    ),
  );
  for (const [singular, plural] of [
    ['Wolf', 'Wolves'],
    ['Mouse', 'Mice'],
    ['Octopus', 'Octopi'],
    ['Octopus', 'Octopuses'],
    ['Kangaroo', 'Kangaroos'],
  ]) {
    expect(owners.has(normalize(singular))).toBe(true);
    expect(owners.get(normalize(singular))).toBe(owners.get(normalize(plural)));
  }
  expect(normalize('Cars')).not.toBe(normalize('Car'));
  expect(normalize('Dreams')).not.toBe(normalize('Dream'));
});
