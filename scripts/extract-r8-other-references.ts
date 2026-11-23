import './test-traffic';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
// No LIMIT, OFFSET cutoff, publication-year subset or query-order truncation.
// Partial HTTP-200 responses are rejected by JSON parsing and never certified complete.
const defs = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).filter(
  (r: any) => !['animals', 'plants', 'birds', 'cities', 'arthropods'].includes(r.slug),
);
defs.sort((a: any, b: any) => Number(b.slug === 'actors') - Number(a.slug === 'actors'));
const dir = '.category-cache/r8/other-references';
mkdirSync(dir, { recursive: true });
const auditFile = 'review/round8/other-reference-extraction.json';
const audit: any[] = existsSync(auditFile) ? JSON.parse(readFileSync(auditFile, 'utf8')) : [];
for (const def of defs) {
  const path = dir + '/' + def.slug + '.json';
  if (existsSync(path)) continue;
  const relation = def.property === 'P106' ? 'wdt:P106/wdt:P279*' : 'wdt:P31/wdt:P279*';
  const pattern = `?item ${relation} wd:${def.root}`;
  const queries = [
    `SELECT DISTINCT ?item ?name WHERE { ${pattern} . ?item rdfs:label ?name . FILTER(LANG(?name)="en") }`,
    `SELECT ?item ?name WHERE { { SELECT DISTINCT ?item WHERE { ${pattern} } } ?item rdfs:label ?name . FILTER(LANG(?name)="en") }`,
    `SELECT ?item ?name WHERE { { SELECT DISTINCT ?item WHERE { ${pattern} } } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". ?item rdfs:label ?name. } FILTER(!REGEX(?name,"^Q[0-9]+$")) }`,
  ];
  const attempts: any[] = [];
  for (const [i, query] of queries.entries()) {
    const started = Date.now();
    try {
      const response = await fetch(
        'https://query.wikidata.org/sparql?' + new URLSearchParams({ query, format: 'json' }),
        {
          headers: {
            'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
            Accept: 'application/sparql-results+json',
          },
          signal: AbortSignal.timeout(90000),
        },
      );
      if (response.status === 429) {
        await new Promise((r) =>
          setTimeout(r, Math.max(60000, Number(response.headers.get('retry-after') || 60) * 1000)),
        );
        throw Error('HTTP 429; Retry-After observed');
      }
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data: any = await response.json();
      if (!Array.isArray(data.results?.bindings) || !data.results.bindings.length)
        throw Error('No complete binding set');
      const rows = data.results.bindings.map((r: any) => ({
        display: r.name.value,
        aliases: [],
        source: r.item.value,
        wikidata: r.item.value.split('/').at(-1),
      }));
      writeFileSync(path, JSON.stringify(rows));
      attempts.push({ query, passed: true, rows: rows.length, ms: Date.now() - started });
      console.log(def.slug, 'complete', rows.length);
      break;
    } catch (e) {
      attempts.push({ query, passed: false, error: String(e), ms: Date.now() - started });
      console.log(def.slug, 'attempt', i + 1, String(e));
    }
    await new Promise((r) => setTimeout(r, 60000));
  }
  audit.push({
    slug: def.slug,
    source: 'Wikidata CC0 full English-labelled classification set',
    license: 'https://www.wikidata.org/wiki/Wikidata:Data_access',
    complete: existsSync(path),
    attempts,
  });
  writeFileSync(auditFile, JSON.stringify(audit, null, 2));
  await new Promise((r) => setTimeout(r, 3000));
}
