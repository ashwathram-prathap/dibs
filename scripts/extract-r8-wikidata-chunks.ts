import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const defs = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).filter(
  (d: any) => !['animals', 'plants', 'birds', 'cities', 'arthropods'].includes(d.slug),
);
defs.sort((a: any, b: any) => Number(b.slug === 'actors') - Number(a.slug === 'actors'));
const dir = '.category-cache/r8/wikidata-chunks';
mkdirSync(dir, { recursive: true });
const reportFile = 'review/round8/wikidata-reference-progress.json';
let report: any = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, 'utf8')) : {};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function query(text: string, format = 'json') {
  const r = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    body: new URLSearchParams({ query: text, format }),
    headers: {
      'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)',
      Accept: format === 'json' ? 'application/sparql-results+json' : 'text/tab-separated-values',
    },
    signal: AbortSignal.timeout(90000),
  });
  if (r.status === 429)
    await pause(Math.max(60000, Number(r.headers.get('retry-after') || 60) * 1000));
  if (!r.ok) throw Error('HTTP ' + r.status);
  return r.text();
}
for (const def of defs) {
  const folder = dir + '/' + def.slug;
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
    const prop = def.property === 'P106' ? 'P106' : 'P31';
    const queries = [
      `SELECT DISTINCT ?item WHERE { ?item wdt:${prop}/wdt:P279* wd:${def.root} }`,
      `SELECT DISTINCT ?item WHERE { ?type wdt:P279* wd:${def.root}. ?item wdt:${prop} ?type. }`,
      `SELECT DISTINCT ?item WHERE { ?item wdt:${prop} ?type. FILTER EXISTS { ?type wdt:P279* wd:${def.root} } }`,
    ];
    const errors: any[] = [];
    for (const q of queries) {
      try {
        const text = await query(q, 'tsv');
        const lines = text.trim().split('\n');
        if (
          lines[0] !== '?item' ||
          !lines.slice(1).every((s) => /^<http:\/\/www.wikidata.org\/entity\/Q\d+>$/.test(s))
        )
          throw Error('Incomplete ID table');
        ids = [...new Set(lines.slice(1).map((s) => s.match(/Q\d+/)![0]))];
        if (!ids.length) throw Error('Empty candidate set');
        writeFileSync(idFile, JSON.stringify(ids));
        break;
      } catch (e) {
        errors.push({ query: q, error: String(e) });
        console.log(def.slug, String(e));
        await pause(60000);
      }
    }
    if (!ids.length) {
      report[def.slug] = { complete: false, stage: 'full candidate IDs', errors };
      writeFileSync(reportFile, JSON.stringify(report, null, 2));
      continue;
    }
  }
  let cursor = 0;
  let batchSize = 2000;
  const rows: any[] = [];
  let blocked = false;
  while (cursor < ids.length) {
    const file = folder + '/' + cursor + '.json';
    if (existsSync(file)) {
      const d = JSON.parse(readFileSync(file, 'utf8'));
      rows.push(...d.rows);
      cursor += d.scanned;
      continue;
    }
    const batch = ids.slice(cursor, cursor + batchSize);
    const q = `SELECT ?item ?name ?article WHERE { VALUES ?item {${batch.map((id) => 'wd:' + id).join(' ')}} ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> . ?item rdfs:label ?name FILTER(LANG(?name)="en") }`;
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
        complete: false,
        stage: 'bounded candidate batch',
        candidateCount: ids.length,
        scanned: cursor,
        errors,
      };
      blocked = true;
      break;
    }
    const entries = result.results.bindings.map((r: any) => {
      const title = decodeURIComponent(r.article.value.split('/wiki/')[1]).replaceAll('_', ' ');
      return {
        display: r.name.value,
        aliases: [title.replace(/ \([^)]*\)$/, '')],
        wikipediaTitle: title,
        source: r.item.value,
        wikidata: r.item.value.split('/').at(-1),
      };
    });
    rows.push(...entries);
    writeFileSync(file, JSON.stringify({ scanned: batch.length, rows: entries }));
    cursor += batch.length;
    report[def.slug] = {
      complete: false,
      candidateCount: ids.length,
      scanned: cursor,
      englishArticles: rows.length,
      method:
        'All uncapped classification IDs, complete bounded joins; English Wikipedia article availability is the stated quality filter, never a result-count cutoff.',
    };
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(def.slug, cursor, '/', ids.length, 'eligible', rows.length);
    await pause(2000);
  }
  if (!blocked) {
    mkdirSync('.category-cache/r8/other-references', { recursive: true });
    writeFileSync(
      '.category-cache/r8/other-references/' + def.slug + '.json',
      JSON.stringify(rows),
    );
    report[def.slug] = {
      ...report[def.slug],
      complete: true,
      candidateCount: ids.length,
      scanned: cursor,
      englishArticles: rows.length,
      license: 'https://www.wikidata.org/wiki/Wikidata:Data_access',
    };
    console.log(def.slug, 'COMPLETE', rows.length);
  }
  writeFileSync(reportFile, JSON.stringify(report, null, 2));
}
