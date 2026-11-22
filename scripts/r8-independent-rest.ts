import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { normalize } from '../worker/domain';
const pools = JSON.parse(readFileSync('.category-cache/r8/independent-pools.json', 'utf8'));
const cache = JSON.parse(readFileSync('.category-cache/r8/pageviews.json', 'utf8'));
const metadata = JSON.parse(readFileSync('.category-cache/r8/page-metadata.json', 'utf8'));
for (const [slug, all] of Object.entries(pools) as [string, any[]][]) {
  if (
    ['animals', 'birds', 'cities', 'countries', 'foods', 'fruits-vegetables', 'plants'].includes(
      slug,
    )
  )
    continue;
  const path = 'review/coverage/' + slug + '-independent.json';
  const c = JSON.parse(readFileSync('categories/' + slug + '.json', 'utf8'));
  const keys = new Set(
    c.answers.flatMap((a: any) => [normalize(a.display), ...a.aliases.map(normalize)]),
  );
  if (existsSync(path)) {
    const d = JSON.parse(readFileSync(path, 'utf8'));
    for (const s of d.samples) s.present = keys.has(normalize(s.answer));
    writeFileSync(path, JSON.stringify(d, null, 2) + '\n');
    console.log(
      slug,
      'same original sample',
      d.samples.filter((s: any) => s.present).length + '/50',
    );
    continue;
  }
  const pending = all.filter(
    (r) =>
      !cache[r.title] || ['unavailable', 'measurement unavailable'].includes(cache[r.title].status),
  );
  if (pending.length) {
    console.log(slug, 'waiting for complete independent pool measurements', pending.length);
    continue;
  }
  const excluded: any[] = [];
  const eligible = all.filter((r) => {
    const description = metadata[cache[r.title]?.title]?.description || '';
    let reason = '';
    if (
      slug === 'bands' &&
      !/\bband\b|musical group|music group|vocal group|duo|trio|quartet|quintet|collective/i.test(
        description,
      )
    )
      reason = 'Solo artist or non-group entry from the Hall of Fame list';
    if (slug === 'novels' && !r.source.endsWith('/Hugo_Award_for_Best_Novel'))
      reason = 'Use the specifically novel award list, excluding nonfiction and mixed book forms';
    if (
      slug === 'paintings' &&
      /drawing|etching|engraving|lithograph|sculpture|tapestry|print\b/i.test(description)
    )
      reason = 'Different visual-art medium';
    if (reason) {
      excluded.push({ name: r.name, reason });
      return false;
    }
    return cache[r.title]?.days > 0;
  });
  const unique = [...new Map(eligible.map((r) => [normalize(r.name), r])).values()];
  unique.sort(
    (a, b) =>
      cache[b.title].total / cache[b.title].days - cache[a.title].total / cache[a.title].days ||
      a.name.localeCompare(b.name),
  );
  const middle = unique.slice(Math.floor(unique.length * 0.25), Math.floor(unique.length * 0.75));
  if (middle.length < 50) {
    console.log(slug, 'independent pool needs expansion', unique.length);
    continue;
  }
  let seed = 8153;
  for (const ch of slug) seed = Math.imul(seed, 31) + ch.charCodeAt(0);
  const originalSeed = seed >>> 0;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const samples = [];
  while (samples.length < 50) {
    const r = middle.splice(Math.floor(random() * middle.length), 1)[0];
    samples.push({
      answer: r.name,
      source: r.source,
      wikipediaTitle: r.title,
      pageviews: cache[r.title],
      initiallyPresent: keys.has(normalize(r.name)),
      present: keys.has(normalize(r.name)),
    });
  }
  const result = {
    source:
      'Independent curated Wikipedia lists, extracted by subject column or list label; see source URLs per sample',
    seed: originalSeed,
    method:
      'Uniform draw without replacement from the middle half by measured mean daily readership; frozen first draw, all misses retained',
    poolSize: unique.length,
    excluded,
    answers: samples.map((s) => s.answer),
    samples,
  };
  writeFileSync(path.replace('.json', '-initial.json'), JSON.stringify(result, null, 2) + '\n');
  writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
  console.log(slug, samples.filter((s) => s.present).length + '/50');
}
