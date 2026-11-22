import { completeIdsByClass, classificationPath } from './wikidata-complete-ids';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
const defs = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).filter(
  (d: any) => !['animals', 'plants', 'birds', 'cities', 'arthropods'].includes(d.slug),
);
defs.sort((a: any, b: any) => Number(b.slug === 'actors') - Number(a.slug === 'actors'));
const dir = '.category-cache/r8/wikidata-chunks';
mkdirSync(dir, { recursive: true });
const reportFile = 'review/round8/wikidata-reference-progress.json';
let report: any = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, 'utf8')) : {};
function saveReport() {
  writeFileSync(reportFile + '.next', JSON.stringify(report, null, 2));
  renameSync(reportFile + '.next', reportFile);
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function query(text: string, format = 'json') {
  const r = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    body: new URLSearchParams({ query: text, format: 'json' }),
    headers: {
      'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
      Accept: 'application/sparql-results+json',
    },
    signal: AbortSignal.timeout(90000),
  });
  if (r.status === 429)
    await pause(Math.max(60000, Number(r.headers.get('retry-after') || 60) * 1000));
  if (!r.ok) throw Error('HTTP ' + r.status);
  const body = await r.text();
  if (format === 'tsv') {
    const d = JSON.parse(body);
    if (!Array.isArray(d.results?.bindings)) throw Error('No complete ID bindings');
    return '?item\n' + d.results.bindings.map((r: any) => '<' + r.item.value + '>').join('\n');
  }
  return body;
}
async function extract(def: any) {
  const labelPolicy = def.allowNamedWithoutArticle
    ? 'english-article-or-source-label-v4'
    : 'english-article-title-v3';
  if (['airports', 'asteroids'].includes(def.slug)) return;
  if (
    report[def.slug]?.complete &&
    report[def.slug]?.labelPolicy === labelPolicy &&
    report[def.slug]?.cacheKey === def.cacheKey &&
    existsSync(
      '.category-cache/r8/other-references/' + def.slug + (def.referenceSuffix || '') + '.json',
    )
  ) {
    console.log(def.slug, 'already complete; preserving enriched aliases');
    return;
  }
  const folder = dir + '/' + def.slug + (def.cacheKey ? '-' + def.cacheKey : '');
  mkdirSync(folder, { recursive: true });
  let ids: string[] = [];
  const idFile = folder + '/ids.json';
  if (existsSync(idFile)) ids = JSON.parse(readFileSync(idFile, 'utf8'));
  else if (def.slug === 'actors') {
    const lines = readFileSync('.category-cache/r8/actors-path.tsv', 'utf8').trim().split('\n');
    if (!lines.slice(1).every((s) => /^<http:\/\/www.wikidata.org\/entity\/Q\d+>$/.test(s)))
      throw Error('Invalid actor ID extraction');
    ids = lines.slice(1).map((s) => s.match(/Q\d+/)![0]);
    writeFileSync(idFile, JSON.stringify(ids));
  } else {
    const prop = classificationPath(def);
    const article = def.englishOnlyCandidates
      ? '?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> .'
      : '';
    const roots = def.roots || [def.root];
    const root = roots.length > 1 ? '?root' : 'wd:' + def.root;
    const bind =
      roots.length > 1
        ? 'VALUES ?root {' + roots.map((r: string) => 'wd:' + r).join(' ') + '}'
        : '';
    const queries = [
      `SELECT DISTINCT ?item WHERE { ${bind} ?item ${prop}/wdt:P279* ${root}. ${article} }`,
      `SELECT DISTINCT ?item WHERE { ${bind} ?type wdt:P279* ${root}. ?item ${prop} ?type. ${article} }`,
      `SELECT DISTINCT ?item WHERE { ${bind} ?item ${prop} ?type. FILTER EXISTS { ?type wdt:P279* ${root} } ${article} }`,
    ];
    const errors: any[] = [];
    for (const q of def.preferClassGroups ||
    (report[def.slug]?.stage === 'full candidate IDs' && report[def.slug]?.errors?.length >= 3)
      ? []
      : queries) {
      try {
        const text = await query(q + ' # snapshot ' + Date.now(), 'tsv');
        const lines = text.trim().split('\n');
        if (
          lines[0] !== '?item' ||
          !lines.slice(1).every((s) => /^<http:\/\/www.wikidata.org\/entity\/Q\d+>$/.test(s))
        )
          throw Error('Incomplete ID table');
        const found = [...new Set(lines.slice(1).map((s) => s.match(/Q\d+/)![0]))];
        const counted = JSON.parse(
          await query(
            q.replace('SELECT DISTINCT ?item', 'SELECT (COUNT(DISTINCT ?item) AS ?count)') +
              ' # snapshot ' +
              Date.now(),
          ),
        );
        if (found.length !== Number(counted.results?.bindings?.[0]?.count?.value))
          throw Error('Full candidate count changed');
        if (!found.length) throw Error('Empty candidate set');
        ids = found;
        writeFileSync(idFile, JSON.stringify(ids));
        break;
      } catch (e) {
        errors.push({ query: q, error: String(e) });
        console.log(def.slug, String(e));
        await pause(60000);
      }
    }
    if (!ids.length) {
      try {
        ids = await completeIdsByClass(def, folder, query);
        if (!ids.length) throw Error('Empty complete class union');
        writeFileSync(idFile, JSON.stringify(ids));
      } catch (e) {
        errors.push({ stage: 'exhaustive subclass and ordered-page fallback', error: String(e) });
      }
    }
    if (!ids.length) {
      report[def.slug] = {
        cacheKey: def.cacheKey,
        complete: false,
        stage: 'full candidate IDs',
        errors,
      };
      saveReport();
      return;
    }
  }
  const priorFile =
    '.category-cache/r8/other-references/' + def.slug + (def.referenceSuffix || '') + '.json';
  const priorNames = new Map<string, any>(
    existsSync(priorFile)
      ? JSON.parse(readFileSync(priorFile, 'utf8')).map((r: any) => [r.wikidata, r])
      : [],
  );
  const statementTypes: string[] = def.allStatementRanks
    ? JSON.parse(readFileSync(folder + '/complete-types.json', 'utf8'))
    : [];
  const labelFolder = folder + '/article-titles-v3';
  mkdirSync(labelFolder, { recursive: true });
  let cursor = 0;
  let batchSize = 5000;
  const rows: any[] = [];
  let blocked = false;
  while (cursor < ids.length) {
    const file = labelFolder + '/' + cursor + '.json';
    if (existsSync(file)) {
      const d = JSON.parse(readFileSync(file, 'utf8'));
      rows.push(...d.rows);
      cursor += d.scanned;
      continue;
    }
    const batch = ids.slice(cursor, cursor + batchSize);
    const values = `VALUES ?item {${batch.map((id) => 'wd:' + id).join(' ')}}`;
    const rankFilter = def.allStatementRanks
      ? `FILTER EXISTS { ?item p:${def.property || 'P31'} ?statement . ?statement ps:${def.property || 'P31'} ?rankType; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank && ?rankType IN (${statementTypes.map((type) => 'wd:' + type).join(',')})) }`
      : '';
    const q = def.allowNamedWithoutArticle
      ? `SELECT ?item ?article ?label ?mul WHERE { ${values} ${rankFilter} OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> } OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") } OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") } FILTER(BOUND(?article) || BOUND(?label) || BOUND(?mul)) }`
      : `SELECT ?item ?article WHERE { ${values} ${rankFilter} ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }`;
    let result: any = null;
    const errors: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = JSON.parse(await query(q));
        if (!Array.isArray(result.results?.bindings)) throw Error('Missing complete binding set');
        break;
      } catch (e) {
        errors.push(String(e));
        result = null;
        await pause(60000);
      }
    }
    if (!result) {
      if (batchSize > 250) {
        batchSize = Math.floor(batchSize / 2);
        continue;
      }
      report[def.slug] = {
        cacheKey: def.cacheKey,
        complete: false,
        stage: 'bounded candidate batch',
        candidateCount: ids.length,
        scanned: cursor,
        errors,
      };
      blocked = true;
      break;
    }
    const entries = result.results.bindings.flatMap((r: any) => {
      const title = r.article
        ? decodeURIComponent(r.article.value.split('/wiki/')[1]).replaceAll('_', ' ')
        : undefined;
      const display = title?.replace(/ \([^)]*\)$/, '') || r.label?.value || r.mul?.value;
      if (!display || !/[\p{Script=Latin}\d]/u.test(display)) return [];
      const prior = priorNames.get(r.item.value.split('/').at(-1));
      return {
        ...(prior && prior.wikipediaTitle === title
          ? {
              wikipediaDescription: prior.wikipediaDescription,
              wikipediaAliasesComplete: prior.wikipediaAliasesComplete,
              originalTitlesComplete: prior.originalTitlesComplete,
            }
          : {}),
        display,
        aliases: [
          ...new Set(
            [
              priorNames.get(r.item.value.split('/').at(-1))?.display,
              ...(priorNames.get(r.item.value.split('/').at(-1))?.aliases || []),
            ].filter(Boolean),
          ),
        ],
        wikipediaTitle: title,
        ...(title ? {} : { wikipediaUnavailable: true }),
        source: r.item.value,
        wikidata: r.item.value.split('/').at(-1),
      };
    });
    rows.push(...entries);
    writeFileSync(file, JSON.stringify({ scanned: batch.length, rows: entries }));
    cursor += batch.length;
    report[def.slug] = {
      labelPolicy,
      cacheKey: def.cacheKey,
      complete: false,
      candidateCount: ids.length,
      scanned: cursor,
      englishArticles: rows.filter((row: any) => row.wikipediaTitle).length,
      namedCandidates: rows.length,
      classificationProperties: def.properties || [def.property || 'P31'],
      candidatePolicy: def.englishOnlyCandidates
        ? 'English-article quality filter applied during uncapped, independently counted classification extraction'
        : def.allowNamedWithoutArticle
          ? 'Entire uncapped classification ID set; English article title or English/Latin-script source label, with unknown readership when no article exists'
          : 'Entire uncapped classification ID set; English-article quality filter applied during bounded joins',
      method: def.allowNamedWithoutArticle
        ? 'Complete classification candidates and bounded non-deprecated statement joins; English article titles or English/default source labels provide names. Works without an English article retain unknown readership. No result-count cutoff.'
        : 'Complete classification candidates and bounded article joins; English article titles provide common names, and English/multilingual labels and aliases supply variants. Article availability is the quality filter, never a result-count cutoff.',
    };
    saveReport();
    console.log(def.slug, cursor, '/', ids.length, 'eligible', rows.length);
    await pause(2000);
  }
  if (!blocked) {
    mkdirSync('.category-cache/r8/other-references', { recursive: true });
    writeFileSync(
      '.category-cache/r8/other-references/' +
        def.slug +
        (def.referenceSuffix || '') +
        '.json.next',
      JSON.stringify(rows),
    );
    renameSync(
      '.category-cache/r8/other-references/' +
        def.slug +
        (def.referenceSuffix || '') +
        '.json.next',
      '.category-cache/r8/other-references/' + def.slug + (def.referenceSuffix || '') + '.json',
    );
    report[def.slug] = {
      cacheKey: def.cacheKey,
      ...report[def.slug],
      complete: true,
      labelPolicy,
      candidateCount: ids.length,
      scanned: cursor,
      englishArticles: rows.filter((row: any) => row.wikipediaTitle).length,
      namedCandidates: rows.length,
      license: 'https://www.wikidata.org/wiki/Wikidata:Data_access',
    };
    console.log(def.slug, 'COMPLETE', rows.length);
  }
  saveReport();
}

const only = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice(7)
  .split(',');
const pending = defs
  .filter((def: any) => !only || only.includes(def.slug))
  .sort((a: any, b: any) => (only ? only.indexOf(a.slug) - only.indexOf(b.slug) : 0));
let next = 0;
// Two independent classifications plus the separate alias job stay below the service concurrency limit.
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (next < pending.length) await extract(pending[next++]);
  }),
);
