import { readCategory } from './category-file';
import { resolvePopularity, measured } from './popularity-aliases';
import {
  legacyRankPopularity as rankPopularity,
  legacyRarityPoints as rarityPoints,
} from './legacy-scoring';
import { rarityLabel } from '../shared/rarity';
import { writeFileSync } from 'node:fs';
const c = readCategory('categories/animals.json');
const values = resolvePopularity(c.answers).readings.map((p) =>
  measured(p) ? p!.total! / p!.days : null,
);
const ranks = rankPopularity(values);
const names = [
  'Dog',
  'Cat',
  'Lion',
  'Camel',
  'Deer',
  'Chameleon',
  'Okapi',
  'Axolotl',
  'Quokka',
  'Sarcastic fringehead',
  'Blobfish',
];
const rows = names.map((name) => {
  const i = c.answers.findIndex((a: any) => a.display.toLowerCase() === name.toLowerCase());
  const p = ranks.percentiles[i];
  return {
    name,
    index: i,
    daily: values[i],
    percentile: p,
    points: p == null ? ranks.median : rarityPoints(p),
    label: p == null ? 'unmeasured' : rarityLabel(p, 'animals'),
  };
});
writeFileSync(
  'review/round19e/reproduction.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      catalog: c.answers.length,
      measured: values.filter((v) => v !== null).length,
      rows,
    },
    null,
    2,
  ),
);
console.table(rows);
