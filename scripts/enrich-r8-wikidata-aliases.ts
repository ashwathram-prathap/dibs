import './test-traffic';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const batchSize = Number(
  process.argv.find((arg) => arg.startsWith('--batch-size='))?.slice(13) || 5000,
);
if (!Number.isInteger(batchSize) || batchSize < 250 || batchSize > 5000)
  throw Error(
    'Alias batch size must be an integer between 250 and 5000; it never limits membership.',
  );
const dir = '.category-cache/r8/other-references';
const cache = '.category-cache/r8/wikidata-names-en-mul-v3';
mkdirSync(cache, { recursive: true });
const reportFile = 'review/round8/wikidata-alias-progress.json';
const report: any = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, 'utf8')) : {};
function saveReport() {
  writeFileSync(reportFile + '.next', JSON.stringify(report, null, 2) + '\n');
  renameSync(reportFile + '.next', reportFile);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const processed = new Map<string, number>();
do {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    if (only && !only.includes(file.slice(0, -5).replace(/-wikidata$/, ''))) continue;
    const sourceTime = statSync(dir + '/' + file).mtimeMs;
    if (processed.get(file) === sourceTime) continue;
    const rows = JSON.parse(readFileSync(dir + '/' + file, 'utf8'));
    const slug = file.slice(0, -5).replace(/-wikidata$/, '');
    const definition = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).find(
      (row: any) => row.slug === slug,
    );
    const expectedPolicy = definition?.allowNamedWithoutArticle
      ? 'english-article-or-source-label-v4'
      : 'english-article-title-v3';
    const reference = JSON.parse(
      readFileSync('review/round8/wikidata-reference-progress.json', 'utf8'),
    )[slug];
    if (
      rows.some((r: any) => r.wikidata) &&
      (!reference?.complete ||
        reference.labelPolicy !== expectedPolicy ||
        reference.cacheKey !== definition?.cacheKey)
    ) {
      report[slug] = {
        complete: false,
        reason: 'Awaiting current full classification',
        expectedPolicy,
        classificationRevision: definition?.cacheKey || 'base',
      };
      saveReport();
      continue;
    }
    const targets = rows.filter(
      (r: any) =>
        r.wikidata &&
        (!r.aliasesComplete ||
          r.aliasPolicy !== 'en-mul-labels-aliases-v3' ||
          (slug === 'paintings' && !r.nativeTitlePropertiesComplete)),
    );
    const referenceTotal = rows.filter((r: any) => r.wikidata).length;
    const previouslyComplete = referenceTotal - targets.length;
    if (!targets.length) {
      if (rows.some((row: any) => row.wikidata)) {
        const count = rows.filter((row: any) => row.wikidata).length;
        report[slug] = {
          complete: true,
          checked: count,
          total: count,
          referencePolicy: reference.labelPolicy,
          classificationRevision: reference.cacheKey || 'base',
        };
        saveReport();
      }
      processed.set(file, sourceTime);
      continue;
    }
    console.log(slug, targets.length, 'source records awaiting aliases');
    let done = 0;
    let blocked = false;
    for (let cursor = 0; cursor < targets.length; cursor += batchSize) {
      const batch = targets.slice(cursor, cursor + batchSize);
      const ids = batch.map((r: any) => r.wikidata);
      const path =
        cache +
        '/' +
        createHash('sha256')
          .update((slug === 'paintings' ? 'all-native-titles-v1:' : '') + ids.join(','))
          .digest('hex') +
        '.json';
      let aliases: any;
      const cached = existsSync(path);
      if (cached) aliases = JSON.parse(readFileSync(path, 'utf8'));
      else {
        const values = `VALUES ?item {${ids.map((id: string) => 'wd:' + id).join(' ')}}`;
        // Keep each OPTIONAL join bounded. A UNION here can trigger an unbounded
        // query plan at the public endpoint even when VALUES is outside it.
        const queries = [
          `SELECT ?item ?alias WHERE { ${values} OPTIONAL { ?item (rdfs:label|skos:altLabel|wdt:P1476|wdt:P1448|wdt:P1705) ?alias FILTER(LANG(?alias) IN ("en", "mul", "en-gb", "en-ca", "en-us")) } }`,
          ...(slug === 'paintings'
            ? [
                `SELECT ?item ?alias WHERE { ${values} OPTIONAL { ?item (wdt:P1476|wdt:P1705) ?alias } }`,
              ]
            : []),
        ];
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const bindings: any[] = [];
            for (const query of queries) {
              const response = await fetch('https://query.wikidata.org/sparql', {
                method: 'POST',
                body: new URLSearchParams({ query, format: 'json' }),
                headers: {
                  'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
                  Accept: 'application/sparql-results+json',
                },
                signal: AbortSignal.timeout(90000),
              });
              if (response.status === 429)
                await sleep(
                  Math.max(60000, Number(response.headers.get('retry-after') || 60) * 1000),
                );
              if (!response.ok) throw Error('HTTP ' + response.status);
              const data: any = await response.json();
              if (!Array.isArray(data.results?.bindings)) throw Error('Incomplete alias query');
              const observed = new Set(
                data.results.bindings.map((row: any) => row.item?.value.split('/').at(-1)),
              );
              if (ids.some((id) => !observed.has(id)))
                throw Error('Alias query omitted a requested ID');
              bindings.push(...data.results.bindings);
            }
            aliases = Object.fromEntries(ids.map((id: string) => [id, []]));
            for (const row of bindings)
              if (row.alias?.value) aliases[row.item.value.split('/').at(-1)].push(row.alias.value);
            writeFileSync(path, JSON.stringify(aliases));
            break;
          } catch (e) {
            console.log(slug, 'alias batch retry', cursor, attempt + 1, String(e));
            if (attempt === 2) {
              report[slug] = {
                complete: false,
                checked: previouslyComplete + done,
                total: referenceTotal,
                error: String(e),
              };
              blocked = true;
            } else await sleep(10000);
          }
        }
      }
      if (blocked) break;
      for (const row of batch) {
        row.aliases = [...new Set([...row.aliases, ...aliases[row.wikidata]])];
        row.aliasesComplete = true;
        row.aliasPolicy = 'en-mul-labels-aliases-v3';
        if (slug === 'paintings') row.nativeTitlePropertiesComplete = true;
      }
      done += batch.length;
      report[slug] = {
        complete: false,
        checked: previouslyComplete + done,
        total: referenceTotal,
        referencePolicy: reference.labelPolicy,
        classificationRevision: reference.cacheKey || 'base',
      };
      saveReport();
      console.log(slug, previouslyComplete + done, '/', referenceTotal, 'English aliases');
      if (!cached) await sleep(2000);
    }
    if (statSync(dir + '/' + file).mtimeMs !== sourceTime) {
      console.log(slug, 'reference changed during enrichment; retrying the new full source');
      continue;
    }
    // Atomic replacement: readers never see a partial reference JSON.
    writeFileSync(dir + '/' + file + '.next', JSON.stringify(rows));
    renameSync(dir + '/' + file + '.next', dir + '/' + file);
    if (!blocked) {
      report[slug] = {
        complete: true,
        checked: previouslyComplete + done,
        total: referenceTotal,
        referencePolicy: reference.labelPolicy,
        classificationRevision: reference.cacheKey || 'base',
      };
      saveReport();
    } else saveReport();
    processed.set(file, statSync(dir + '/' + file).mtimeMs);
  }
  if (!process.argv.includes('--watch')) break;
  await sleep(60000);
} while (true);
