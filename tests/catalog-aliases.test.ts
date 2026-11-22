import { it, expect } from 'vitest';
import {
  commonNamePlurals,
  castleNameAliases,
  conjunctionAliases,
  workSubtitleAliases,
  titleArticleAliases,
  personNameAliases,
  shipNameAliases,
} from '../scripts/catalog-aliases';
import { normalize } from '../worker/domain';
it('accepts ship names without descriptive type prefixes or trailing hull qualifiers', () => {
  expect(shipNameAliases('Chinese destroyer Zhuhai (166)')).toContain('Zhuhai (166)');
  expect(shipNameAliases('TCG Ege (F256)')).toContain('TCG Ege');
  expect(shipNameAliases('TCG Ege (F256)')).toContain('Ege');
  expect(shipNameAliases('Queen Mary')).toEqual([]);
});
it('accepts personal names without source honorifics while preserving name boundaries', () => {
  expect(personNameAliases('Professor Sir John Example')).toEqual(['John Example']);
  expect(personNameAliases('Datuk Arumugam Rengasamy')).toEqual(['Arumugam Rengasamy']);
  expect(personNameAliases('Dame Judi Dench')).toEqual(['Judi Dench']);
  expect(personNameAliases('Siri Hustvedt')).toEqual([]);
  expect(personNameAliases('Dame')).toEqual([]);
});
it('accepts optional leading articles while preserving word boundaries and rejecting an article alone', () => {
  expect(titleArticleAliases('The Blue Planet')).toEqual(['Blue Planet']);
  expect(titleArticleAliases('A Clockwork Orange')).toEqual(['Clockwork Orange']);
  expect(titleArticleAliases('The The')).toEqual([]);
  expect(titleArticleAliases('Theatre')).toEqual(['The Theatre']);
  expect(titleArticleAliases('Luncheon of the Boating Party')).toEqual([
    'The Luncheon of the Boating Party',
  ]);
});
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

it('accepts source castle names with ordinary translated type words and name order', () => {
  expect(castleNameAliases('Castelo de Marvão')).toContain('Marvão Castle');
  expect(castleNameAliases('Peyrepertuse Castle')).toContain('Chateau de Peyrepertuse');
  expect(castleNameAliases('Alcázar de Toledo')).toContain('Alcazar of Toledo');
  expect(castleNameAliases('Castleford')).toEqual([]);
});
