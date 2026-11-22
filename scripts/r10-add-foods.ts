import { readCategory, writeCategory } from './category-file';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalize } from '../worker/domain';
const additions: [string, string, string[]][] = [
  ['Poutine', 'Poutine', ['Poutines']],
  ['Butter tart', 'Butter tart', ['Butter tarts']],
  ['Nanaimo bar', 'Nanaimo bar', ['Nanaimo bars']],
  ['BeaverTails', 'BeaverTails', ['Beaver tail', 'Beaver tails', 'Beavertail']],
  ['Ketchup chips', 'Ketchup chip', ['Ketchup chip', 'Ketchup potato chips']],
  [
    'Montreal smoked meat',
    'Montreal-style smoked meat',
    ['Montréal smoked meat', 'Montreal-style smoked meat'],
  ],
  [
    'Montreal-style bagel',
    'Montreal-style bagel',
    ['Montreal bagel', 'Montreal bagels', 'Montreal-style bagels'],
  ],
  ['Saskatoon berry pie', 'Saskatoon berry pie', ['Saskatoon pie', 'Saskatoon berry pies']],
  ['Rappie pie', 'Rappie pie', ['Rappie pies', 'Râpure']],
  ['Jiggs dinner', 'Jiggs dinner', ['Jiggs’ dinner']],
  ['Pouding chômeur', 'Pouding chômeur', ['Pudding chômeur', 'Poor man’s pudding']],
  ['Date square', 'Date square', ['Date squares', 'Matrimonial cake']],
  ['Figgy duff', 'Figgy duff (pudding)', []],
  ['Donair', 'Donair', ['Donairs', 'Halifax donair']],
  ['Caesar cocktail', 'Caesar (cocktail)', ['Caesar', 'Bloody Caesar']],
  ['Ice wine', 'Ice wine', ['Icewine', 'Ice wines']],
  ['Hawaiian pizza', 'Hawaiian pizza', ['Hawaiian pizzas']],
  ['Ginger beef', 'Ginger beef', []],
  ['All-dressed chips', 'All-dressed', ['All dressed chips', 'All-dressed potato chips']],
  ['Montreal steak seasoning', 'Montreal steak seasoning', ['Montreal steak spice']],
  ['Persian doughnut', 'Persian (roll)', ['Persian donut', 'Persian doughnuts', 'Persian donuts']],
  ['Coffee Crisp', 'Coffee Crisp', ['Coffee Crisps']],
  ['Timbits', 'Timbits', ['Timbit']],
];
const c = readCategory('categories/foods.json'),
  before = c.answers.length;
const keys = new Set(c.answers.flatMap((a: any) => [a.display, ...a.aliases].map(normalize)));
for (const [display, title, aliases] of additions) {
  if (keys.has(normalize(display))) continue;
  const accepted = aliases.filter((a) => !keys.has(normalize(a)));
  c.answers.push({
    display,
    aliases: accepted,
    canonical: normalize(display),
    source: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replaceAll(' ', '_')),
    wikipediaTitle: title,
    pageviews: {
      total: null,
      days: 0,
      title,
      status: 'R10 editorial addition; readership not yet measured',
    },
    obscurity: null,
  });
  for (const k of [display, ...accepted]) keys.add(normalize(k));
}
for (const [display, aliases] of [
  ['Bacon covered with cornmeal', ['Peameal bacon']],
  ['Back bacon', ['Canadian bacon']],
] as [string, string[]][]) {
  const row = c.answers.find((a: any) => a.display === display);
  if (!row) throw Error(display);
  for (const alias of aliases)
    if (!keys.has(normalize(alias))) {
      row.aliases.push(alias);
      keys.add(normalize(alias));
    }
}
c.total_registrable = c.answers.length;
c.provenance.candidateCount = Math.max(c.provenance.candidateCount, 14025);
c.provenance.unmeasured = c.answers.filter((a: any) => !a.pageviews?.days).length;
c.provenance.canadaSupplement = {
  date: '2026-11-22',
  added: c.provenance.canadaSupplement?.added || c.answers.length - before,
  scope:
    'Missing Canadian dishes and exact synonyms; existing rows, ordering and measured rankings preserved',
  sources: 'scripts/r10-add-foods.ts',
};
writeCategory('categories/foods.json', c);
const recipe = JSON.parse(readFileSync('recipes/foods.json', 'utf8'));
recipe.snapshotSha256 = createHash('sha256')
  .update(readFileSync('categories/foods.json'))
  .digest('hex');
writeFileSync('recipes/foods.json', JSON.stringify(recipe, null, 2) + '\n');
console.log({ before, after: c.answers.length, added: c.answers.length - before });
