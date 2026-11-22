import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const definitions = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).filter(
  (d: any) => d.property === 'P106',
);
const folder = '.category-cache/r8/occupation-normal-ranks';
mkdirSync(folder, { recursive: true });
const report: Record<string, any> = {};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function query(q: string) {
  let error: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        'https://query.wikidata.org/sparql?' + new URLSearchParams({ query: q, format: 'json' }),
        {
          headers: {
            'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
            Accept: 'application/sparql-results+json',
          },
          signal: AbortSignal.timeout(90000),
        },
      );
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data: any = await response.json();
      if (!data.results?.bindings) throw Error('Incomplete occupation response');
      return data.results.bindings;
    } catch (e) {
      error = e;
      console.log('Occupation query retry', attempt + 1, String(e));
      await sleep(10000);
    }
  }
  throw error;
}
for (const def of definitions) {
  try {
    const typeRows = await query(`SELECT DISTINCT ?type WHERE { ?type wdt:P279* wd:${def.root} }`);
    const types: string[] = typeRows.map((r: any) => r.type.value.split('/').at(-1));
    const entries = new Map<string, any>();
    const counts = [];
    for (let offset = 0; offset < types.length; offset += 25) {
      const batch = types.slice(offset, offset + 25);
      const pattern = `hint:Query hint:optimizer "None" . VALUES ?type { ${batch.map((id) => 'wd:' + id).join(' ')} } ?statement ps:P106 ?type; wikibase:rank wikibase:NormalRank . ?item p:P106 ?statement . FILTER NOT EXISTS { ?item wdt:P106 ?type } ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> .`;
      const path = folder + '/' + createHash('sha256').update(pattern).digest('hex') + '.json';
      let rows: any[];
      if (existsSync(path)) rows = JSON.parse(readFileSync(path, 'utf8'));
      else {
        rows = await query(`SELECT DISTINCT ?item ?article WHERE { ${pattern} }`);
        const count = await query(`SELECT (COUNT(DISTINCT ?item) AS ?count) WHERE { ${pattern} }`);
        if (new Set(rows.map((r) => r.item.value)).size !== Number(count[0].count.value))
          throw Error('Occupation count mismatch');
        writeFileSync(path, JSON.stringify(rows));
        await sleep(1000);
      }
      console.log(def.slug, 'rank group', offset, '/', types.length, 'rows', rows.length);
      counts.push({ types: batch.length, rows: rows.length });
      for (const r of rows) {
        const title = decodeURIComponent(r.article.value.split('/wiki/')[1]).replaceAll('_', ' ');
        const id = r.item.value.split('/').at(-1);
        entries.set(id, {
          display: title.replace(/ \([^)]*\)$/, ''),
          aliases: [],
          wikipediaTitle: title,
          wikidata: id,
          source: r.item.value,
          occupationRank: 'normal, obscured by another preferred occupation',
        });
      }
    }
    // Apply only after every complete class group has been independently counted.
    const path = '.category-cache/r8/other-references/' + def.slug + '.json';
    const current = JSON.parse(readFileSync(path, 'utf8'));
    const present = new Set(current.map((r: any) => r.wikidata));
    const added = [...entries.values()].filter((r) => !present.has(r.wikidata));
    if (added.length) {
      current.push(...added);
      writeFileSync(path + '.ranks-next', JSON.stringify(current));
      renameSync(path + '.ranks-next', path);
    }
    report[def.slug] = {
      complete: true,
      at: new Date().toISOString(),
      classes: types.length,
      normalRankCandidates: entries.size,
      added: added.length,
      groups: counts,
      method:
        'All normal-rank occupation statements hidden by preferred occupations; deprecated statements excluded; every uncapped class group checked against independent COUNT; complete English-article quality filter.',
    };
    console.log(def.slug, report[def.slug]);
  } catch (error) {
    report[def.slug] = { complete: false, error: String(error) };
    console.error(def.slug, String(error));
  }
  writeFileSync(
    'review/round8/occupation-rank-extraction.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
