import { it, expect } from 'vitest';
import { commonNamePlurals } from '../scripts/catalog-aliases';
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
