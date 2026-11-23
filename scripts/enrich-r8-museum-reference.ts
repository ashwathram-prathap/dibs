import './test-traffic';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
// An independent complete article reference, not a lookup of coverage misses.
const folder = '.category-cache/r8/museum-infobox-reference-v1';
mkdirSync(folder, { recursive: true });
const titles: string[] = [];
let continuation: Record<string, string> = {};
let page = 0;
do {
  const path = `${folder}/${page++}.json`;
  let data: any;
  if (existsSync(path)) data = JSON.parse(readFileSync(path, 'utf8'));
  else {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(
          'https://en.wikipedia.org/w/api.php?' +
            new URLSearchParams({
              action: 'query',
              format: 'json',
              list: 'embeddedin',
              eititle: 'Template:Infobox museum',
              einamespace: '0',
              eifilterredir: 'nonredirects',
              eilimit: 'max',
              ...continuation,
            }),
          {
            headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
            signal: AbortSignal.timeout(60000),
          },
        );
        if (!response.ok) throw Error('HTTP ' + response.status);
        data = await response.json();
        if (!Array.isArray(data.query?.embeddedin)) throw Error('Incomplete template reference');
        writeFileSync(path, JSON.stringify(data));
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  titles.push(...data.query.embeddedin.map((row: any) => row.title));
  continuation = data.continue || {};
  console.log('Complete museum-template traversal', titles.length);
} while (Object.keys(continuation).length);
const path = '.category-cache/r8/other-references/museums.json';
const current = JSON.parse(readFileSync(path, 'utf8'));
const known = new Set(current.map((row: any) => row.wikipediaTitle));
const additional = [...new Set(titles)]
  .filter((title) => !known.has(title))
  .map((title) => ({
    display: title.replace(/ \([^)]*\)$/, ''),
    aliases: [],
    wikipediaTitle: title,
    source: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replaceAll(' ', '_')),
    classificationSupplement: 'Complete main-namespace transclusions of Template:Infobox museum',
  }));
current.push(...additional);
writeFileSync(path + '.infobox-next', JSON.stringify(current));
renameSync(path + '.infobox-next', path);
writeFileSync(
  'review/round8/museum-template-reference.json',
  JSON.stringify(
    {
      complete: true,
      at: new Date().toISOString(),
      articleCount: new Set(titles).size,
      added: additional.length,
      pages: page,
      source: 'https://en.wikipedia.org/wiki/Template:Infobox_museum',
      method:
        'All main-namespace, non-redirect transclusions, exhausted API continuation with no membership cap',
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    null,
    2,
  ) + '\n',
);
console.log('Museum reference complete; added', additional.length);
