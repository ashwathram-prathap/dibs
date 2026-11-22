import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const folder = '.category-cache/r8/painting-original-titles-v1';
mkdirSync(folder, { recursive: true });
while (true) {
  const definition = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).find(
    (d: any) => d.slug === 'paintings',
  );
  const source = JSON.parse(
    readFileSync('review/round8/wikidata-reference-progress.json', 'utf8'),
  ).paintings;
  const aliases = JSON.parse(
    readFileSync('review/round8/wikidata-alias-progress.json', 'utf8'),
  ).paintings;
  if (
    source?.complete &&
    source.cacheKey === definition.cacheKey &&
    aliases?.complete &&
    aliases.classificationRevision === definition.cacheKey
  )
    break;
  console.log('Waiting for complete painting classifications and English aliases');
  await pause(30000);
}
const path = '.category-cache/r8/other-references/paintings.json';
const rows = JSON.parse(readFileSync(path, 'utf8'));
const ids: string[] = [...new Set<string>(rows.map((r: any) => r.wikidata).filter(Boolean))];
const names = new Map<string, string[]>();
for (let offset = 0; offset < ids.length; offset += 1000) {
  const batch = ids.slice(offset, offset + 1000);
  const cache = folder + '/' + createHash('sha256').update(batch.join(',')).digest('hex') + '.json';
  let data: any;
  if (existsSync(cache)) data = JSON.parse(readFileSync(cache, 'utf8'));
  else {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch('https://query.wikidata.org/sparql', {
          method: 'POST',
          headers: {
            Accept: 'application/sparql-results+json',
            'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
          },
          body: new URLSearchParams({
            format: 'json',
            query: `SELECT ?item ?name WHERE { VALUES ?item { ${batch.map((id) => 'wd:' + id).join(' ')} } OPTIONAL { ?item (rdfs:label|skos:altLabel|wdt:P1476|wdt:P1705) ?name } }`,
          }),
          signal: AbortSignal.timeout(90000),
        });
        if (response.status === 429)
          await pause(Math.max(60000, Number(response.headers.get('retry-after') || 60) * 1000));
        if (!response.ok) throw Error('HTTP ' + response.status);
        data = await response.json();
        const seen = new Set(
          data.results?.bindings?.map((r: any) => r.item.value.split('/').at(-1)),
        );
        if (batch.some((id) => !seen.has(id))) throw Error('Incomplete original-title response');
        writeFileSync(cache, JSON.stringify(data));
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await pause(10000);
      }
    }
    await pause(2000);
  }
  for (const row of data.results.bindings) {
    const id = row.item.value.split('/').at(-1);
    if (!names.has(id)) names.set(id, []);
    if (row.name?.value) names.get(id)!.push(row.name.value);
  }
  console.log('Painting source titles', offset + batch.length, '/', ids.length);
}
// Preserve any English alias updates made while these bounded queries ran.
const current = JSON.parse(readFileSync(path, 'utf8'));
let added = 0;
for (const row of current) {
  if (!names.has(row.wikidata)) continue;
  const merged = [...new Set([...row.aliases, ...names.get(row.wikidata)!])];
  added += merged.length - row.aliases.length;
  row.aliases = merged;
  row.originalTitlesComplete = true;
}
writeFileSync(path + '.titles-next', JSON.stringify(current));
renameSync(path + '.titles-next', path);
writeFileSync(
  'review/round8/painting-original-titles.json',
  JSON.stringify(
    {
      complete: true,
      at: new Date().toISOString(),
      checked: ids.length,
      addedAliases: added,
      method:
        'Every painting reference ID; source labels, aliases, original titles and native names in all languages. English article titles remain canonical. No coverage-fixture lookups or translated guesses.',
      license: 'https://www.wikidata.org/wiki/Wikidata:Licensing',
    },
    null,
    2,
  ) + '\n',
);
