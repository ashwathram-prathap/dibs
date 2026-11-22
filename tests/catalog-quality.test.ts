import { expect, it } from 'vitest';
import { pageMatchesScope, castleTitleDescriptionMatches } from '../scripts/catalog-quality';
import { mergeWikipediaPage } from '../scripts/wiki-pages';
it('preserves article scope and aliases across Wikipedia property continuation', () => {
  const page = mergeWikipediaPage(
    {
      title: 'An Airport',
      description: 'International airport in Canada',
      redirects: [{ title: 'Former airport name' }],
    },
    { title: 'An Airport', redirects: [{ title: 'Short airport name' }] },
  );
  expect(pageMatchesScope('airports', page.description)).toBe(true);
  expect(page.redirects.map((row: any) => row.title)).toEqual([
    'Former airport name',
    'Short airport name',
  ]);
});
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
  expect(pageMatchesScope('airports', 'International airport in Canada')).toBe(true);
  expect(pageMatchesScope('airports', 'United States Air Force facility in Nevada')).toBe(true);
  expect(pageMatchesScope('airports', 'Edible fruit')).toBe(false);
  expect(pageMatchesScope('airports', 'Football stadium in Chicago')).toBe(false);
  expect(pageMatchesScope('airports', 'Main page of Wikipedia')).toBe(false);
  expect(pageMatchesScope('foods', 'French military leader and statesman')).toBe(false);
  expect(pageMatchesScope('foods', 'Constituent country of the Kingdom of the Netherlands')).toBe(
    false,
  );
  expect(pageMatchesScope('foods', 'French puff pastry dessert')).toBe(true);
});

it('does not borrow a painting subject’s biography for aliases or readership', () => {
  expect(pageMatchesScope('paintings', 'President of the United States')).toBe(false);
  expect(pageMatchesScope('paintings', 'Italian Renaissance painter')).toBe(false);
  expect(pageMatchesScope('paintings', '')).toBe(false);
  expect(pageMatchesScope('paintings', 'Mural depicting a politician')).toBe(true);
  expect(pageMatchesScope('paintings', '1889 painting by Vincent van Gogh')).toBe(true);
});

it('distinguishes castle buildings from unrelated subjects at castle locations', () => {
  for (const description of [
    'Castle in the town of Bolsover, England',
    'National Historic Landmark located in California',
    'Canadian historic mansion',
  ])
    expect(castleTitleDescriptionMatches(description)).toBe(true);
  for (const description of [
    'School in Castle Hill, Australia',
    'Battle at Osowiec Fortress',
    'Village with castle in Ireland',
    'Defensive ditch surrounding a fortification',
    'Fictional castle in a fantasy novel',
  ])
    expect(castleTitleDescriptionMatches(description)).toBe(false);
});
