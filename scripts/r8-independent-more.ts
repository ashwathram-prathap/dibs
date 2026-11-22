import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { normalize } from '../worker/domain';
const pools = JSON.parse(readFileSync('.category-cache/r8/independent-pools.json', 'utf8'));
const cache = JSON.parse(readFileSync('.category-cache/r8/pageviews.json', 'utf8'));
const metadata = JSON.parse(readFileSync('.category-cache/r8/page-metadata.json', 'utf8'));
const gbif = JSON.parse(readFileSync('.category-cache/r8/gbif-extracted.json', 'utf8'));
const scientific = new Set(gbif.plants.map((r: any) => r.aliases.at(-1)));
const genera = new Set(gbif.plants.map((r: any) => r.aliases.at(-1).split(' ')[0]));
let seed = 8153;
const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
for (const slug of ['countries', 'foods', 'fruits-vegetables', 'plants']) {
  const frozenPath = 'review/coverage/' + slug + '-independent.json';
  if (existsSync(frozenPath)) {
    const frozen = JSON.parse(readFileSync(frozenPath, 'utf8'));
    const current = JSON.parse(readFileSync('categories/' + slug + '.json', 'utf8'));
    const keys = new Set(
      current.answers.flatMap((a: any) => [normalize(a.display), ...a.aliases.map(normalize)]),
    );
    for (const sample of frozen.samples) sample.present = keys.has(normalize(sample.answer));
    writeFileSync(frozenPath, JSON.stringify(frozen, null, 2) + '\n');
    console.log(slug, 'frozen sample', frozen.samples.filter((s: any) => s.present).length + '/50');
    continue;
  }

  const all = pools[slug].map((r: any) =>
    typeof r === 'string'
      ? { name: r, title: r, source: 'https://unstats.un.org/unsd/methodology/m49/overview/' }
      : r,
  );
  const excluded: any[] = [];
  const unique = new Map<string, any>();
  for (const r of all) {
    const description = metadata[cache[r.title]?.title]?.description || '';
    if (
      slug === 'fruits-vegetables' &&
      (scientific.has(r.name) || (r.name === r.title && genera.has(r.name.split(' ')[0])))
    ) {
      excluded.push({ name: r.name, reason: 'Scientific name, not a common-name answer' });
      continue;
    }
    if (
      slug === 'foods' &&
      /cooking (method|technique)|cooking technique|cooking method|alcohol|wine|drink|beverage|distilled|liqueur|spirit|beer/i.test(
        description,
      )
    ) {
      excluded.push({
        name: r.name,
        reason: 'Beverage or cooking process outside the selected food scope',
      });
      continue;
    }
    if (slug === 'foods' && r.name === 'Sliced puddle') r.name = 'Dao xiao mian';
    if (!unique.has(normalize(r.name))) unique.set(normalize(r.name), r);
  }
  const ranked = [...unique.values()]
    .filter((r) => cache[r.title]?.days > 0)
    .sort(
      (a, b) =>
        cache[b.title].total / cache[b.title].days - cache[a.title].total / cache[a.title].days,
    );
  const middle = ranked.slice(Math.floor(ranked.length * 0.25), Math.floor(ranked.length * 0.75));
  if (middle.length < 50) throw Error(slug + ' needs a larger independently measured pool');
  const selected: any[] = [];
  while (selected.length < 50)
    selected.push(middle.splice(Math.floor(random() * middle.length), 1)[0]);
  const c = JSON.parse(readFileSync('categories/' + slug + '.json', 'utf8'));
  const keys = new Set(
    c.answers.flatMap((r: any) => [normalize(r.display), ...r.aliases.map(normalize)]),
  );
  const previous = JSON.parse(
    readFileSync('review/coverage/' + slug + '-independent-initial.json', 'utf8'),
  );
  const baseline = new Map(previous.samples.map((r: any) => [normalize(r.answer), r.present]));
  const samples = selected.map((r) => ({
    answer: r.name,
    source: r.source,
    wikipediaTitle: r.title,
    pageviews: cache[r.title],
    initiallyPresent: baseline.has(normalize(r.name)) ? baseline.get(normalize(r.name)) : null,
    present: keys.has(normalize(r.name)),
  }));
  writeFileSync(
    'review/coverage/' + slug + '-independent.json',
    JSON.stringify(
      {
        source:
          slug === 'countries'
            ? 'UN M49 English country/area table'
            : slug === 'foods'
              ? 'Wikipedia lists of Chinese and Greek dishes (independent of WordNet and OFF builders)'
              : slug === 'plants'
                ? 'Wikipedia garden plants: only parenthetical English common names, excluding taxonomy notes'
                : 'Wikipedia List of culinary fruits: English common names (original independent probe preserved before broad source expansion)',
        seed: 8153,
        method:
          'Uniform draw without replacement from the middle half by measured readership; sources selected before matching; all misses retained.',
        poolSize: ranked.length,
        excluded,
        answers: samples.map((r) => r.answer),
        samples,
      },
      null,
      2,
    ),
  );
  console.log(
    slug,
    'pool',
    ranked.length,
    'misses',
    samples.filter((r) => !r.present).map((r) => r.answer),
  );
}
