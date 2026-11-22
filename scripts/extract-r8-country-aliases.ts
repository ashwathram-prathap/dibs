import { writeFileSync } from 'node:fs';
const query =
  'SELECT ?iso ?name ?alias ?article WHERE { ?item wdt:P297 ?iso; rdfs:label ?name FILTER(LANG(?name)="en") OPTIONAL { ?item skos:altLabel ?alias FILTER(LANG(?alias)="en") } OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> } }';
const response = await fetch('https://query.wikidata.org/sparql', {
  method: 'POST',
  body: new URLSearchParams({ query, format: 'json' }),
  headers: {
    'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
    Accept: 'application/sparql-results+json',
  },
  signal: AbortSignal.timeout(90000),
});
if (!response.ok) throw Error('HTTP ' + response.status);
const data: any = await response.json();
if (!Array.isArray(data.results?.bindings)) throw Error('Incomplete ISO alias set');
const aliases: any = {};
for (const r of data.results.bindings) {
  const row = (aliases[r.iso.value] ||= { aliases: [] });
  row.aliases.push(r.name.value);
  if (r.alias) row.aliases.push(r.alias.value);
  if (r.article)
    row.wikipediaTitle = decodeURIComponent(r.article.value.split('/wiki/')[1]).replaceAll(
      '_',
      ' ',
    );
}
for (const r of Object.values(aliases) as any[]) r.aliases = [...new Set(r.aliases)];
writeFileSync('.category-cache/r8/iso-aliases.json', JSON.stringify(aliases));
writeFileSync(
  'review/round8/country-alias-extraction.json',
  JSON.stringify(
    {
      complete: true,
      source: 'Wikidata CC0: all ISO alpha-2 records and all English labels/aliases/article links',
      query,
      codes: Object.keys(aliases).length,
    },
    null,
    2,
  ) + '\n',
);
console.log(Object.keys(aliases).length, 'country/territory code alias sets');
