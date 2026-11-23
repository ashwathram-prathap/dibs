import './test-traffic';
import { castleTitleDescriptionMatches } from './catalog-quality';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  readdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
const folder = '.category-cache/r8/castle-title-supplement';
mkdirSync(folder, { recursive: true });
const titles: string[] = JSON.parse(
  readFileSync('.category-cache/r8/castle-title-candidates.json', 'utf8'),
);
const primary = '.category-cache/r8/other-references/castles.json';
const known = new Set(
  [primary, '.category-cache/r8/other-references/castles-wikidata.json'].flatMap((path) =>
    JSON.parse(readFileSync(path, 'utf8'))
      .filter(
        (r: any) => !r.referenceSupplement?.startsWith('Complete English article-title inventory'),
      )
      .map((r: any) => r.wikipediaTitle)
      .filter(Boolean),
  ),
);
const pending = titles.filter((t) => !known.has(t));
const byTitle = new Map<string, any>();
for (const file of readdirSync(folder).filter((f) => f.endsWith('.json')))
  for (const page of JSON.parse(readFileSync(folder + '/' + file, 'utf8')))
    for (const title of [page.title, ...(page.aliases || [])]) byTitle.set(title, page);
const results: any[] = [];
let cursor = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (cursor < pending.length) {
      const batch = pending.slice(cursor, (cursor += 50));
      const path =
        folder + '/' + createHash('sha256').update(JSON.stringify(batch)).digest('hex') + '.json';
      let pages: any[];
      if (existsSync(path)) pages = JSON.parse(readFileSync(path, 'utf8'));
      else if (batch.every((title) => byTitle.has(title)))
        pages = batch.map((title) => byTitle.get(title));
      else {
        const requested = batch.filter((title) => !byTitle.has(title));
        let data: any;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(
              'https://en.wikipedia.org/w/api.php?' +
                new URLSearchParams({
                  action: 'query',
                  format: 'json',
                  titles: requested.join('|'),
                  redirects: '1',
                  prop: 'description|pageprops',
                }),
              {
                headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
                signal: AbortSignal.timeout(30000),
              },
            );
            if (response.status === 429)
              await sleep(
                Math.max(60000, Number(response.headers.get('retry-after') || 60) * 1000),
              );
            if (!response.ok) throw Error('HTTP ' + response.status);
            data = await response.json();
            if (!data.query?.pages) throw Error('Incomplete article response');
            break;
          } catch (e) {
            if (attempt === 2) throw e;
            await sleep(5000);
          }
        }
        pages = Object.values(data.query.pages).map((p: any) => ({
          ...p,
          aliases: (data.query.redirects || [])
            .filter((r: any) => r.to === p.title)
            .map((r: any) => r.from),
        }));
        pages.push(
          ...batch.filter((title) => byTitle.has(title)).map((title) => byTitle.get(title)),
        );
        for (const page of pages)
          for (const title of [page.title, ...(page.aliases || [])]) byTitle.set(title, page);
        writeFileSync(path, JSON.stringify(pages));
        await sleep(2000);
      }
      results.push(...pages);
      if (cursor % 500 === 0) console.log('Checked candidate titles', cursor, '/', pending.length);
    }
  }),
);
const distinctPages = [...new Map(results.map((page) => [page.title, page])).values()];
const valid = distinctPages.filter(
  (p) =>
    p.missing === undefined &&
    p.pageprops?.disambiguation === undefined &&
    castleTitleDescriptionMatches(p.description || p.pageprops?.['wikibase-shortdesc'] || ''),
);
const previous = new Map(
  JSON.parse(readFileSync(primary, 'utf8'))
    .filter((r: any) =>
      r.referenceSupplement?.startsWith('Complete English article-title inventory'),
    )
    .map((r: any) => [r.wikipediaTitle, r]),
);
const current = JSON.parse(readFileSync(primary, 'utf8')).filter(
  (r: any) => !r.referenceSupplement?.startsWith('Complete English article-title inventory'),
);
const seen = new Set(
  current
    .filter(
      (r: any) => !r.referenceSupplement?.startsWith('Complete English article-title inventory'),
    )
    .map((r: any) => r.wikipediaTitle),
);
let added = 0;
for (const p of valid) {
  if (seen.has(p.title)) continue;
  seen.add(p.title);
  added++;
  current.push({
    ...((previous.get(p.title) as any) || {}),
    display: p.title.replace(/ \([^)]*\)$/, ''),
    aliases: [...new Set([...((previous.get(p.title) as any)?.aliases || []), ...p.aliases])],
    wikipediaTitle: p.title,
    wikipediaDescription: p.description || p.pageprops?.['wikibase-shortdesc'] || '',
    source: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.title.replaceAll(' ', '_')),
    referenceSupplement:
      'Complete English article-title inventory, domain name plus verified building/estate description',
  });
}
writeFileSync(primary + '.titles-next', JSON.stringify(current));
renameSync(primary + '.titles-next', primary);
const report = {
  complete: true,
  at: new Date().toISOString(),
  candidateTitles: titles.length,
  alreadyReferenced: titles.length - pending.length,
  checked: pending.length,
  added,
  method:
    'Full enwiki article-title dump; castle/palace/fortress/chateau titles excluding list and non-article namespaces. Existing references retained; new membership requires an actual building, estate or landmark description, excluding fictional works and people. No coverage-list lookups.',
  accepted: valid.map((p) => ({
    title: p.title,
    description: p.description || p.pageprops?.['wikibase-shortdesc'] || '',
  })),
  excluded: distinctPages.filter((p) => !valid.includes(p)).map((p) => p.title),
};
writeFileSync('review/round8/castle-title-supplement.json', JSON.stringify(report, null, 2) + '\n');
console.log({ candidateTitles: titles.length, checked: pending.length, added });
