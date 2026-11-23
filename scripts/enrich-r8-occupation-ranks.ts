import './test-traffic';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { completeIdsByClass } from './wikidata-complete-ids';
const definitions = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).filter(
  (d: any) => d.property === 'P106',
);
const reportPath = 'review/round8/occupation-rank-extraction.json';
const report: Record<string, any> = existsSync(reportPath)
  ? JSON.parse(readFileSync(reportPath, 'utf8'))
  : {};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function query(q: string, format = 'json'): Promise<string> {
  let error: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST',
        body: new URLSearchParams({ query: q, format: 'json' }),
        headers: {
          'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
          Accept: 'application/sparql-results+json',
        },
        signal: AbortSignal.timeout(90000),
      });
      if (response.status === 429)
        await sleep(Math.max(60000, Number(response.headers.get('retry-after') || 60) * 1000));
      if (!response.ok) throw Error('HTTP ' + response.status);
      const body = await response.text();
      const data = JSON.parse(body);
      if (!data.results?.bindings) throw Error('Incomplete occupation response');
      return format === 'json'
        ? body
        : '?item\n' + data.results.bindings.map((r: any) => '<' + r.item.value + '>').join('\n');
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
    const folder = '.category-cache/r8/occupation-all-ranks-v1/' + def.slug;
    mkdirSync(folder, { recursive: true });
    const idsPath = folder + '/ids.json';
    const ids: string[] = existsSync(idsPath)
      ? JSON.parse(readFileSync(idsPath, 'utf8'))
      : await completeIdsByClass(
          { ...def, allStatementRanks: true, englishOnlyCandidates: false },
          folder,
          query,
        );
    writeFileSync(idsPath, JSON.stringify(ids));
    // Retrieve complete statement IDs first, avoiding a costly global anti-join.
    // Then validate only the difference from the original complete truthy IDs.
    const original = new Set<string>(
      JSON.parse(
        readFileSync('.category-cache/r8/wikidata-chunks/' + def.slug + '/ids.json', 'utf8'),
      ),
    );
    const additional = ids.filter((id) => !original.has(id));
    const entries: any[] = [];
    for (let offset = 0; offset < additional.length; offset += 1000) {
      const path = folder + '/additional-' + offset + '.json';
      let rows: any[];
      if (existsSync(path)) rows = JSON.parse(readFileSync(path, 'utf8'));
      else {
        const body = JSON.parse(
          await query(
            `SELECT DISTINCT ?item ?article WHERE { VALUES ?item { ${additional
              .slice(offset, offset + 1000)
              .map((id) => 'wd:' + id)
              .join(
                ' ',
              )} } ?item p:P106 ?statement . ?statement ps:P106 ?type; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank) ?type wdt:P279* wd:${def.root} . ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> . }`,
          ),
        );
        rows = body.results.bindings.map((r: any) => {
          const title = decodeURIComponent(r.article.value.split('/wiki/')[1]).replaceAll('_', ' ');
          return {
            display: title.replace(/ \([^)]*\)$/, ''),
            aliases: [],
            wikipediaTitle: title,
            wikidata: r.item.value.split('/').at(-1),
            source: r.item.value,
            occupationRank:
              'Non-deprecated occupation omitted from the truthy classification snapshot',
          };
        });
        writeFileSync(path, JSON.stringify(rows));
        await sleep(1000);
      }
      entries.push(...rows);
    }
    const path = '.category-cache/r8/other-references/' + def.slug + '.json';
    const current = JSON.parse(readFileSync(path, 'utf8'));
    const present = new Set(current.map((r: any) => r.wikidata));
    const added = entries.filter((r) => !present.has(r.wikidata));
    if (added.length) {
      current.push(...added);
      writeFileSync(path + '.ranks-next', JSON.stringify(current));
      renameSync(path + '.ranks-next', path);
    }
    report[def.slug] = {
      complete: true,
      at: new Date().toISOString(),
      allStatementCandidates: ids.length,
      additionalCandidates: additional.length,
      eligibleAdditional: entries.length,
      added: added.length,
      method:
        'Complete instance occupation statement paths, every uncapped class independently counted; bounded validation of additional IDs excludes deprecated statements and applies the English article quality filter. No global anti-join or result cap.',
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
