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
const dir = '.category-cache/r8/other-references';
const cache = '.category-cache/r8/wikidata-aliases';
mkdirSync(cache, { recursive: true });
const reportFile = 'review/round8/wikidata-alias-progress.json';
const report: any = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, 'utf8')) : {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const processed = new Map<string, number>();
do {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const sourceTime = statSync(dir + '/' + file).mtimeMs;
    if (processed.get(file) === sourceTime) continue;
    const rows = JSON.parse(readFileSync(dir + '/' + file, 'utf8'));
    const targets = rows.filter((r: any) => r.wikidata && !r.aliasesComplete);
    if (!targets.length) {
      processed.set(file, sourceTime);
      continue;
    }
    const slug = file.slice(0, -5);
    let done = 0;
    let blocked = false;
    for (let cursor = 0; cursor < targets.length; cursor += 1000) {
      const batch = targets.slice(cursor, cursor + 1000);
      const ids = batch.map((r: any) => r.wikidata);
      const path = cache + '/' + createHash('sha256').update(ids.join(',')).digest('hex') + '.json';
      let aliases: any;
      if (existsSync(path)) aliases = JSON.parse(readFileSync(path, 'utf8'));
      else {
        const query = `SELECT ?item ?alias WHERE { VALUES ?item {${ids.map((id: string) => 'wd:' + id).join(' ')}} OPTIONAL { ?item skos:altLabel ?alias FILTER(LANG(?alias)="en") } }`;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
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
            aliases = Object.fromEntries(ids.map((id: string) => [id, []]));
            for (const row of data.results.bindings)
              if (row.alias?.value) aliases[row.item.value.split('/').at(-1)].push(row.alias.value);
            writeFileSync(path, JSON.stringify(aliases));
            break;
          } catch (e) {
            if (attempt === 2) {
              report[slug] = {
                complete: false,
                checked: done,
                total: targets.length,
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
      }
      done += batch.length;
      report[slug] = { complete: done === targets.length, checked: done, total: targets.length };
      writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
      console.log(slug, done, '/', targets.length, 'English aliases');
      await sleep(2000);
    }
    if (statSync(dir + '/' + file).mtimeMs !== sourceTime) {
      console.log(slug, 'reference changed during enrichment; retrying the new full source');
      continue;
    }
    // Atomic replacement: readers never see a partial reference JSON.
    writeFileSync(dir + '/' + file + '.next', JSON.stringify(rows));
    renameSync(dir + '/' + file + '.next', dir + '/' + file);
    processed.set(file, statSync(dir + '/' + file).mtimeMs);
  }
  if (!process.argv.includes('--watch')) break;
  await sleep(60000);
} while (true);
