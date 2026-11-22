import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { pageMatchesScope } from './catalog-quality';
import { mergeWikipediaPage } from './wiki-pages';
const slug = process.argv.find((arg) => arg.startsWith('--slug='))?.slice(7) || 'airports';
const definitions = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8'));
if (!['airports', 'arthropods'].includes(slug) && !definitions.some((d: any) => d.slug === slug))
  throw Error('Unsupported reference domain');
const referenceName =
  slug +
  (process.argv.includes('--wikidata-supplement')
    ? '-wikidata'
    : process.argv.includes('--geonames-extra')
      ? '-geonames-extra'
      : '');
const path = '.category-cache/r8/other-references/' + referenceName + '.json';
const lock = '.category-cache/r8/' + referenceName + '-wiki-alias.lock';
while (true) {
  try {
    writeFileSync(lock, String(process.pid), { flag: 'wx' });
    break;
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(readFileSync(lock, 'utf8'));
    let alive = false;
    try {
      if (pid > 0) {
        process.kill(pid, 0);
        alive = true;
      }
    } catch {}
    if (!alive) {
      unlinkSync(lock);
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
process.on('exit', () => {
  if (existsSync(lock) && readFileSync(lock, 'utf8') === String(process.pid)) unlinkSync(lock);
});
const revision = definitions.find((d: any) => d.slug === slug)?.cacheKey || 'base';
const basePath =
  '.category-cache/r8/' +
  referenceName +
  (['airports', 'arthropods'].includes(slug) ? '' : '-' + revision) +
  '-base-reference.json';
const incremental = process.argv.includes('--incremental');
const refreshBase = process.argv.includes('--refresh-base') || incremental;
// Current references can acquire complete supplemental sources after the first
// alias pass. Never replace those additions with an older baseline snapshot.
const rows = existsSync(path)
  ? JSON.parse(readFileSync(path, 'utf8'))
  : existsSync(basePath)
    ? JSON.parse(readFileSync(basePath, 'utf8'))
    : JSON.parse(readFileSync('.category-cache/r8/candidates.json', 'utf8'))[slug];
const previousReport = 'review/round8/' + referenceName + '-alias-extraction.json';
if (
  !refreshBase &&
  existsSync(previousReport) &&
  JSON.parse(readFileSync(previousReport, 'utf8')).complete &&
  rows.every((r: any) => !r.wikipediaTitle || r.wikipediaAliasesComplete)
) {
  console.log(slug, 'all current reference article aliases already complete');
  process.exit(0);
}
if (!existsSync(basePath) || refreshBase) writeFileSync(basePath, JSON.stringify(rows));
const previouslyEnriched = rows.filter(
  (r: any) => r.wikipediaTitle && r.wikipediaAliasesComplete,
).length;
if (slug === 'arthropods')
  for (const row of rows)
    row.wikipediaTitle ||=
      row.scientificName || row.display[0].toUpperCase() + row.display.slice(1);
const titles: string[] = [
  ...new Set<string>(
    rows
      .filter((r: any) => !incremental || !r.wikipediaAliasesComplete)
      .map((r: any) => r.wikipediaTitle)
      .filter(Boolean),
  ),
];
const dir = '.category-cache/r8/' + slug + '-wiki-aliases-scoped-v2';
mkdirSync(dir, { recursive: true });
const mappings: Record<
  string,
  {
    title: string;
    aliases: string[];
    description: string;
    exists: boolean;
    disambiguation: boolean;
    descriptionChecked?: boolean;
  }
> = {};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let cursor = 0,
  checked = 0;
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (cursor < titles.length) {
      const batch = titles.slice(cursor, (cursor += 50));
      const cache =
        dir + '/' + createHash('sha256').update(JSON.stringify(batch)).digest('hex') + '.json';
      let network = false;
      if (existsSync(cache)) {
        const saved = JSON.parse(readFileSync(cache, 'utf8'));
        const blank: string[] = [
          ...new Set<string>(
            Object.values(saved)
              .filter((row: any) => row.exists && !row.description && !row.descriptionChecked)
              .map((row: any) => row.title),
          ),
        ];
        if (blank.length) {
          network = true;
          let data: any;
          for (let attempt = 0; attempt < 3; attempt++) {
            const response = await fetch(
              'https://en.wikipedia.org/w/api.php?' +
                new URLSearchParams({
                  action: 'query',
                  format: 'json',
                  titles: blank.join('|'),
                  prop: 'description|pageprops',
                }),
              {
                headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
                signal: AbortSignal.timeout(30000),
              },
            );
            if (response.status === 429)
              await pause(
                Math.max(60000, Number(response.headers.get('retry-after') || 60) * 1000),
              );
            if (response.ok) {
              data = await response.json();
              if (data.query?.pages) break;
            }
            if (attempt === 2) throw Error('Could not verify cached article descriptions');
            await pause(5000);
          }
          const pages = new Map(
            Object.values(data.query.pages).map((page: any) => [page.title, page]),
          );
          for (const row of Object.values(saved) as any[]) {
            const page: any = pages.get(row.title);
            if (page) {
              row.description = page.description || page.pageprops?.['wikibase-shortdesc'] || '';
              row.disambiguation = page.pageprops?.disambiguation !== undefined;
              row.descriptionChecked = true;
            }
          }
          writeFileSync(cache, JSON.stringify(saved));
        }
        Object.assign(mappings, saved);
      } else {
        network = true;
        const pages: Record<string, any> = {};
        const redirects = new Map<string, string>();
        let continuation: any = {};
        do {
          let data: any;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const response = await fetch(
                'https://en.wikipedia.org/w/api.php?' +
                  new URLSearchParams({
                    action: 'query',
                    format: 'json',
                    titles: batch.join('|'),
                    redirects: '1',
                    prop: 'redirects|description|pageprops',
                    rdnamespace: '0',
                    rdlimit: 'max',
                    ...continuation,
                  }),
                {
                  headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
                  signal: AbortSignal.timeout(30000),
                },
              );
              if (response.status === 429)
                await pause(
                  Math.max(60000, Number(response.headers.get('retry-after') || 60) * 1000),
                );
              if (!response.ok) throw Error('HTTP ' + response.status);
              data = await response.json();
              if (data.error || !data.query?.pages)
                throw Error('Incomplete Wikipedia alias response');
              break;
            } catch (error) {
              if (attempt === 2) throw error;
              await pause(5000);
            }
          }
          for (const row of [...(data.query.normalized || []), ...(data.query.redirects || [])])
            redirects.set(row.from, row.to);
          for (const page of Object.values(data.query.pages) as any[]) {
            pages[page.title] = mergeWikipediaPage(pages[page.title], page);
          }
          continuation = data.continue;
        } while (continuation);
        const result: typeof mappings = {};
        for (const title of batch) {
          let target = title;
          for (let i = 0; i < 10 && redirects.has(target); i++) target = redirects.get(target)!;
          const page = pages[target];
          result[title] = {
            title: page?.missing === undefined && page ? target : title,
            aliases: page?.redirects?.map((r: any) => r.title) || [],
            description: page?.description || page?.pageprops?.['wikibase-shortdesc'] || '',
            exists: !!page && page.missing === undefined,
            disambiguation: page?.pageprops?.disambiguation !== undefined,
            descriptionChecked: true,
          };
        }
        writeFileSync(cache, JSON.stringify(result));
        Object.assign(mappings, result);
      }
      checked += batch.length;
      if (checked % 500 === 0)
        console.log(slug, 'article names and redirects', checked, '/', titles.length);
      if (network) await pause(2000);
    }
  }),
);
let unrelated = 0;
for (const row of rows) {
  const article = mappings[row.wikipediaTitle];
  if (!article) continue;
  const valid =
    article.exists &&
    !article.disambiguation &&
    pageMatchesScope(slug, article.description, !!row.scientificName);
  row.wikipediaDescription = article.description;
  row.wikipediaScopeValid = valid;
  if (!valid) {
    unrelated++;
    row.aliases = row.aliases.filter(
      (name: string) => name !== row.wikipediaTitle && name !== article.title,
    );
    row.wikipediaTitle = article.title;
    row.wikipediaAliasesComplete = true;
    continue;
  }
  row.aliases = [
    ...new Set([
      row.display,
      article.title.replace(/ \([^)]*\)$/, ''),
      ...row.aliases,
      ...article.aliases,
    ]),
  ];
  if (['airports', 'stations', 'lakes', 'mountains', 'rivers', 'islands'].includes(slug))
    row.display = article.title.replace(/ \([^)]*\)$/, '');
  row.wikipediaTitle = article.title;
  row.wikipediaAliasesComplete = true;
}
writeFileSync(path + '.next', JSON.stringify(rows));
renameSync(path + '.next', path);
writeFileSync(
  'review/round8/' + referenceName + '-alias-extraction.json',
  JSON.stringify(
    {
      complete: rows.every((r: any) => !r.wikipediaTitle || r.wikipediaAliasesComplete),
      source:
        'Full ' +
        slug +
        ' reference title set, resolved titles and all namespace-zero redirects; biological common names remain the canonical answers',
      sourceRows: rows.length,
      articleTitles: titles.length,
      checked,
      incremental,
      previouslyEnriched,
      enrichedArticleRows: rows.filter((r: any) => r.wikipediaTitle && r.wikipediaAliasesComplete)
        .length,
      unrelatedOrMissingArticles: unrelated,
      at: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);
console.log('Completed all', slug, 'article names and aliases', checked);
