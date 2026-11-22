import { it, expect } from 'vitest';
import {
  commonNamePlurals,
  conjunctionAliases,
  workSubtitleAliases,
} from '../scripts/catalog-aliases';
import { normalize } from '../worker/domain';
it('recognizes named franchise subtitles without accepting generic part numbers', () => {
  expect(workSubtitleAliases('Star Wars: Episode III – Revenge of the Sith')).toContain(
    'Revenge of the Sith',
  );
  expect(workSubtitleAliases('Mission: Impossible – Rogue Nation')).toContain('Rogue Nation');
  expect(workSubtitleAliases('A Story: Part II')).toEqual([]);
  expect(workSubtitleAliases('Toy Story 2')).toEqual([]);
});
it('accepts ampersands and written conjunctions in proper titles without truncating names', () => {
  const title = 'Legend – The Best of Bob Marley and The Wailers';
  expect(conjunctionAliases(title).map(normalize)).toContain(
    normalize('Legend: The Best of Bob Marley & The Wailers'),
  );
  expect(conjunctionAliases('Simon & Garfunkel').map(normalize)).toContain(
    normalize('Simon and Garfunkel'),
  );
  expect(conjunctionAliases('Indian sandalwood')).toEqual([]);
});
it('supplies natural plural aliases that simple suffix stripping misses', () => {
  for (const [singular, plural] of [
    ['iris', 'irises'],
    ['cactus', 'cacti'],
    ['cactus', 'cactuses'],
    ['walrus', 'walruses'],
    ['platypus', 'platypuses'],
    ['ox', 'oxen'],
    ['hippopotamus', 'hippopotami'],
    ['rhinoceros', 'rhinoceroses'],
    ['ibis', 'ibises'],
    ['loaf', 'loaves'],
    ['great horned owl', 'great horned owls'],
  ])
    expect(commonNamePlurals(singular)).toContain(plural);
});
