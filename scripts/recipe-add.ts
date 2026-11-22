import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readCategory } from './category-file';
import { normalize } from '../worker/domain';
const input = process.argv[2];
if (!input) throw Error('Usage: npx tsx scripts/recipe-add.ts path/to/recipe.json');
const r = JSON.parse(readFileSync(input, 'utf8'));
if (
  !/^[-a-z0-9]{2,60}$/.test(r.slug) ||
  !r.name ||
  !r.kind ||
  !r.scope ||
  !r.aliases ||
  !r.sources?.length
)
  throw Error('Recipe needs slug, name, kind, scope, alias rules and complete sources.');
for (const path of [r.sourceSnapshot, r.obvious, r.independent])
  if (!path || !resolve(path).startsWith(process.cwd() + '/') || !existsSync(path))
    throw Error('Recipe source and fixture files must exist inside this project.');
if (
  r.sourceSnapshot !== `categories/${r.slug}.json` ||
  r.obvious !== `review/coverage/${r.slug}.txt` ||
  r.independent !== `review/coverage/${r.slug}-independent.json`
)
  throw Error('Use the standard categories/ and review/coverage/ paths for this slug.');
const c = readCategory(r.sourceSnapshot),
  words = readFileSync(r.obvious, 'utf8').trim().split('\n').filter(Boolean),
  independent = JSON.parse(readFileSync(r.independent, 'utf8')).answers;
const keys = new Set(c.answers.flatMap((a: any) => [a.display, ...a.aliases].map(normalize))),
  score = words.filter((w) => keys.has(normalize(w))).length / words.length;
if (
  c.slug !== r.slug ||
  words.length < 150 ||
  score < 0.98 ||
  independent.length < 50 ||
  independent.some((w: string) => !keys.has(normalize(w))) ||
  !c.provenance.completeSources ||
  !c.provenance.rankingComplete
)
  throw Error(
    'Recipe failed the complete-source, ranking, 98% obvious or independent coverage gate.',
  );
r.snapshotSha256 = createHash('sha256').update(readFileSync(r.sourceSnapshot)).digest('hex');
r.answerSha256 = c.answersSha256 || null;
r.version = 1;
r.requestNames ||= [r.name];
r.priority ||= 50;
writeFileSync('recipes/' + r.slug + '.json', JSON.stringify(r, null, 2) + '\n');
console.log(
  'Recipe accepted: ' +
    r.slug +
    '. Commit the recipe, source snapshot and independent fixtures; the next rollout will publish it.',
);
