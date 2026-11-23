import './test-traffic';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pageMatchesScope } from './catalog-quality';
const path = '.category-cache/r8/other-references/paintings.json';
const rows = JSON.parse(readFileSync(path, 'utf8'));
const rejected = rows.filter(
  (r: any) => r.wikipediaTitle && !pageMatchesScope('paintings', r.wikipediaDescription || ''),
);
console.log('Painting references with unrelated or unverified article scope', rejected.length);
if (process.argv.includes('--audit-only')) {
  console.log(
    rejected.slice(0, 15).map(({ display, wikipediaTitle, wikipediaDescription }: any) => ({
      display,
      wikipediaTitle,
      wikipediaDescription,
    })),
  );
  process.exit(0);
}
const cache = '.category-cache/r8/painting-source-only-aliases';
mkdirSync(cache, { recursive: true });
for (let cursor = 0; cursor < rejected.length; cursor += 50) {
  const batch = rejected.slice(cursor, cursor + 50);
  const ids = [...new Set<string>(batch.map((r: any) => r.wikidata))];
  const file = cache + '/' + createHash('sha256').update(ids.join(',')).digest('hex') + '.json';
  let entities: any;
  if (existsSync(file)) entities = JSON.parse(readFileSync(file, 'utf8'));
  else {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = new URL('https://www.wikidata.org/w/api.php');
        url.search = new URLSearchParams({
          action: 'wbgetentities',
          ids: ids.join('|'),
          props: 'labels|aliases|claims',
          format: 'json',
        }).toString();
        const response = await fetch(url, {
          headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
          signal: AbortSignal.timeout(60000),
        });
        if (!response.ok) throw Error('HTTP ' + response.status);
        const data: any = await response.json();
        entities = data.entities;
        if (!entities || ids.some((id) => !entities[id] || entities[id].missing !== undefined))
          throw Error('Missing source entity');
        writeFileSync(file, JSON.stringify(entities));
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
  for (const row of batch) {
    const e = entities[row.wikidata];
    row.aliases = [
      ...new Set([
        ...Object.values(e.labels || {}).map((v: any) => v.value),
        ...Object.values(e.aliases || {}).flatMap((v: any) => v.map((a: any) => a.value)),
        ...['P1476', 'P1705'].flatMap((prop) =>
          (e.claims?.[prop] || [])
            .filter((c: any) => c.rank !== 'deprecated')
            .map((c: any) => c.mainsnak?.datavalue?.value?.text)
            .filter(Boolean),
        ),
      ]),
    ];
    row.wikipediaScopeValid = false;
    row.wikipediaAliasesComplete = true;
  }
  console.log(
    'Rebuilt verified source aliases',
    Math.min(cursor + 50, rejected.length),
    '/',
    rejected.length,
  );
  await new Promise((r) => setTimeout(r, 500));
}
for (const row of rows)
  if (row.wikipediaTitle)
    row.wikipediaScopeValid = pageMatchesScope('paintings', row.wikipediaDescription || '');
writeFileSync(path + '.next', JSON.stringify(rows));
renameSync(path + '.next', path);
writeFileSync(
  'review/round8/painting-redirect-scope-audit.json',
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      articleRecords: rows.filter((r: any) => r.wikipediaTitle).length,
      rejectedArticleAssociations: rejected.map((r: any) => ({
        display: r.display,
        wikidata: r.wikidata,
        article: r.wikipediaTitle,
        description: r.wikipediaDescription || '',
      })),
      membershipRetained: true,
      aliasesRebuiltFromWikidataOnly: true,
      note: 'An unrelated or unverified article cannot supply aliases or readership. The source-backed painting name remains accepted.',
    },
    null,
    2,
  ) + '\n',
);
