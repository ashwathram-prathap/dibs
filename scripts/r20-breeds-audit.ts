import { readCategory } from './category-file';
import { normalize } from '../worker/domain';
import { writeFileSync } from 'node:fs';
const c = readCategory('categories/animals.json');
const probes = [
  'Siamese cat',
  'Siamese',
  'Golden retriever',
  'Clydesdale',
  'Persian cat',
  'Labrador retriever',
  'Holstein',
  'Merino',
  'Boer goat',
  'Berkshire pig',
  'Leghorn chicken',
  'Rex rabbit',
];
const results = probes.map((input) => ({
  input,
  matches: c.answers
    .filter((a: any) =>
      [a.display, ...(a.aliases || [])].some((v: string) => normalize(v) === normalize(input)),
    )
    .map((a: any) => ({
      display: a.display,
      source: a.source || a.sources || a.provenance || null,
    })),
}));
const pattern = c.answers.filter((a: any) =>
  /retriever|siamese|clydesdale|merino|holstein|\bbreed\b/i.test(a.display),
);
writeFileSync(
  'review/round20/breeds-audit.json',
  JSON.stringify(
    {
      catalog: c.slug,
      answers: c.answers.length,
      probes: results,
      relatedNames: pattern.map((a: any) => a.display),
      scope: c.scope,
      source: c.provenance,
    },
    null,
    2,
  ),
);
console.log(results);
console.log(pattern.map((a: any) => a.display).slice(0, 30));
