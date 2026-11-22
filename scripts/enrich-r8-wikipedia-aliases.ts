import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pageMatchesScope } from './catalog-quality';
const slug = process.argv.find((arg) => arg.startsWith('--slug='))?.slice(7) || 'airports';
if (!['airports', 'arthropods'].includes(slug)) throw Error('Unsupported reference domain');
const path = '.category-cache/r8/other-references/' + slug + '.json';
const basePath = '.category-cache/r8/' + slug + '-base-reference.json';
const rows = existsSync(basePath)
  ? JSON.parse(readFileSync(basePath, 'utf8'))
  : existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : JSON.parse(readFileSync('.category-cache/r8/candidates.json', 'utf8'))[slug];
if (!existsSync(basePath)) writeFileSync(basePath, JSON.stringify(rows));
if (slug === 'arthropods')
  for (const row of rows)
    row.wikipediaTitle ||=
      row.scientificName || row.display[0].toUpperCase() + row.display.slice(1);
const titles: string[] = [
  ...new Set<string>(rows.map((r: any) => r.wikipediaTitle).filter(Boolean)),
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
  }
> = {};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let cursor = 0,
  checked = 0;
await Promise.all(
  Array.from({ length: slug === 'airports' ? 2 : 1 }, async () => {
    while (cursor < titles.length) {
      const batch = titles.slice(cursor, (cursor += 50));
      const cache =
        dir + '/' + createHash('sha256').update(JSON.stringify(batch)).digest('hex') + '.json';
      if (existsSync(cache)) Object.assign(mappings, JSON.parse(readFileSync(cache, 'utf8')));
      else {
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
            const old = pages[page.title];
            pages[page.title] = {
              ...page,
              redirects: [...(old?.redirects || []), ...(page.redirects || [])],
            };
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
          };
        }
        writeFileSync(cache, JSON.stringify(result));
        Object.assign(mappings, result);
      }
      checked += batch.length;
      if (checked % 500 === 0)
        console.log(slug, 'article names and redirects', checked, '/', titles.length);
      await pause(2000);
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
  if (slug === 'airports') row.display = article.title.replace(/ \([^)]*\)$/, '');
  row.wikipediaTitle = article.title;
  row.wikipediaAliasesComplete = true;
}
writeFileSync(path + '.next', JSON.stringify(rows));
renameSync(path + '.next', path);
writeFileSync(
  'review/round8/' + slug + '-alias-extraction.json',
  JSON.stringify(
    {
      complete: true,
      source:
        'Full ' +
        slug +
        ' reference title set, resolved titles and all namespace-zero redirects; biological common names remain the canonical answers',
      sourceRows: rows.length,
      articleTitles: titles.length,
      checked,
      unrelatedOrMissingArticles: unrelated,
      at: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);
console.log('Completed all', slug, 'article names and aliases', checked);
