import './test-traffic';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { completeIdsByClass } from './wikidata-complete-ids';
const folder = '.category-cache/r8/described-literary-novels-v1';
mkdirSync(folder, { recursive: true });
const definition = {
  slug: 'novels-description-supplement',
  roots: ['Q571', 'Q7725634'],
  englishOnlyCandidates: true,
  extraPattern:
    '?item schema:description ?description . FILTER(LANG(?description) = "en" && REGEX(?description, "\\\\b(novel|novella)\\\\b", "i") && !REGEX(?description, "series|collection|character|film|writer|author|genre|award", "i"))',
};
async function query(text: string, format = 'json'): Promise<string> {
  const response = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    body: new URLSearchParams({ query: text, format: 'json' }),
    headers: {
      'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
      Accept: 'application/sparql-results+json',
    },
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw Error('HTTP ' + response.status);
  const body = await response.text();
  if (format !== 'tsv') return body;
  const data = JSON.parse(body);
  if (!Array.isArray(data.results?.bindings)) throw Error('Missing complete bindings');
  return '?item\n' + data.results.bindings.map((r: any) => '<' + r.item.value + '>').join('\n');
}
const idsPath = folder + '/ids.json';
try {
  const ids: string[] = existsSync(idsPath)
    ? JSON.parse(readFileSync(idsPath, 'utf8'))
    : await completeIdsByClass(definition, folder, query);
  writeFileSync(idsPath, JSON.stringify(ids));
  const rows: any[] = [];
  for (let offset = 0; offset < ids.length; offset += 1000) {
    const path = folder + '/articles-' + offset + '.json';
    let batch: any[];
    if (existsSync(path)) batch = JSON.parse(readFileSync(path, 'utf8'));
    else {
      const data = JSON.parse(
        await query(
          `SELECT ?item ?article WHERE { VALUES ?item {${ids
            .slice(offset, offset + 1000)
            .map((id) => 'wd:' + id)
            .join(
              ' ',
            )}} ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> . }`,
        ),
      );
      batch = data.results.bindings.map((r: any) => {
        const title = decodeURIComponent(r.article.value.split('/wiki/')[1]).replaceAll('_', ' ');
        return {
          display: title.replace(/ \([^)]*\)$/, ''),
          aliases: [],
          wikipediaTitle: title,
          wikidata: r.item.value.split('/').at(-1),
          source: r.item.value,
          classificationSupplement:
            'Complete book/literary-work classifications with explicit English novel/novella descriptions; excludes series, collections and people',
        };
      });
      writeFileSync(path, JSON.stringify(batch));
    }
    rows.push(...batch);
  }
  const path = '.category-cache/r8/other-references/novels.json';
  const current = JSON.parse(readFileSync(path, 'utf8'));
  const known = new Set(current.map((r: any) => r.wikidata));
  const added = rows.filter((r) => !known.has(r.wikidata));
  current.push(...added);
  writeFileSync(path + '.descriptions-next', JSON.stringify(current));
  renameSync(path + '.descriptions-next', path);
  const report = {
    complete: true,
    at: new Date().toISOString(),
    candidateCount: ids.length,
    added: added.length,
    definition,
  };
  writeFileSync(
    'review/round8/novel-description-supplement.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} catch (error) {
  writeFileSync(
    'review/round8/novel-description-supplement.json',
    JSON.stringify({ complete: false, error: String(error), definition }, null, 2) + '\n',
  );
  throw error;
}
