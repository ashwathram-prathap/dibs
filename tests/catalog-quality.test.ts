import { expect, it } from 'vitest';
import { pageMatchesScope } from '../scripts/catalog-quality';
it('does not rank biological homonyms using unrelated popular articles', () => {
  expect(pageMatchesScope('actors', 'American actor')).toBe(true);
  expect(pageMatchesScope('films', 'American comedy film')).toBe(true);
  expect(pageMatchesScope('plants', 'Species of bear')).toBe(false);
  expect(pageMatchesScope('plants', 'Arboreal herbivorous marsupial native to Australia')).toBe(
    false,
  );
  expect(pageMatchesScope('animals', 'Team sport played with a bat and ball')).toBe(false);
  expect(pageMatchesScope('animals', 'Small insects of the family Gryllidae')).toBe(true);
  expect(pageMatchesScope('plants', 'Species of flowering plant', true)).toBe(true);
  expect(pageMatchesScope('cities', 'Country in South America')).toBe(false);
  expect(pageMatchesScope('countries', 'Country in South America')).toBe(true);
});
