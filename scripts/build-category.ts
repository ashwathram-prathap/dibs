import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { normalize, dropAt } from '../worker/domain';
const sources = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8'));
mkdirSync('categories', { recursive: true });
mkdirSync('review', { recursive: true });
mkdirSync('.category-cache', { recursive: true });
const ua = 'DibsCategoryBuilder/1.0 (https://www.ashwathram.ca; private registry prototype)';
const sleep = (n: number) => new Promise((r) => setTimeout(r, n));
let nextRequest = 0;
let cooldown = 0;
async function get(url: string) {
  let error: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const slot = Math.max(Date.now(), nextRequest, cooldown);
      nextRequest = slot + 350;
      await sleep(Math.max(0, slot - Date.now()));
      const r = await fetch(url, {
        headers: { 'User-Agent': ua, Accept: 'application/json' },
        signal: AbortSignal.timeout(45000),
      });
      if (r.status === 429) {
        const retry = Number(r.headers.get('retry-after') || 30);
        cooldown = Date.now() + Math.max(30, retry) * 1000;
        console.log(
          'RATE LIMIT ' + new URL(url).hostname + '; waiting ' + Math.max(30, retry) + 's',
        );
        await sleep(Math.max(30, retry) * 1000);
      }
      if (!r.ok) throw new Error(new URL(url).hostname + ' HTTP ' + r.status);
      const j = (await r.json()) as any;
      if (j.error) throw new Error(j.error.info || JSON.stringify(j.error));
      return j;
    } catch (e) {
      error = e;
      await sleep(1200 * (attempt + 1));
    }
  }
  throw error;
}
const blocked = /\b(fuck|shit|cunt|nigg\w*|fagg\w*|porn\w*|sex|sexual|nazi|rape|rapist|suicide)\b/i;
export function acceptable(s: string) {
  return (
    s.length >= 2 &&
    s.length <= 95 &&
    !blocked.test(s) &&
    !/[<>|{}\[\]]/.test(s) &&
    !/^List of |^Category:|^Template:/.test(s)
  );
}
async function wikiList(s: any) {
  const path = '.category-cache/' + s.slug + '-wiki-source.json';
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  const queue = s.wikiCategoryRoots.map((x: string) => 'Category:' + x);
  const visited = new Set<string>();
  const articles = new Map<string, any>();
  while (queue.length && articles.size < 3200) {
    const category = queue.shift();
    if (visited.has(category)) continue;
    visited.add(category);
    let continuation: any = {};
    do {
      const d = await get(
        'https://en.wikipedia.org/w/api.php?' +
          new URLSearchParams({
            action: 'query',
            list: 'categorymembers',
            cmtitle: category,
            cmlimit: '500',
            format: 'json',
            ...continuation,
          }),
      );
      for (const row of d.query.categorymembers) {
        if (row.ns === 0 && acceptable(row.title))
          articles.set(row.title, {
            title: row.title,
            url:
              'https://en.wikipedia.org/wiki/' + encodeURIComponent(row.title.replaceAll(' ', '_')),
            wikidata: null,
          });
        else if (row.ns === 14) queue.push(row.title);
      }
      continuation = d.continue;
    } while (continuation && articles.size < 3200);
  }
  const rows = [...articles.values()];
  writeFileSync(path, JSON.stringify(rows));
  return rows;
}
async function querySource(s: any) {
  if (s.wikiCategoryRoots) return wikiList(s);
  const cache = '.category-cache/' + s.slug + '-source.json';
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'));
  const property = s.property || 'P31';
  let clause =
    property === 'P171'
      ? `?item wdt:P31 wd:Q16521; wdt:P105 wd:Q7432; wdt:P171* wd:${s.root}.`
      : `?item wdt:${property} wd:${s.root}.`;
  const query = `SELECT DISTINCT ?item ?article WHERE { ${clause} ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. } LIMIT 3200`;
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  let result;
  try {
    result = await get(url);
    if (property !== 'P171' && result.results.bindings.length < 2450) {
      const expanded = `SELECT DISTINCT ?item ?article WHERE { ?item wdt:${property}/wdt:P279* wd:${s.root}. ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. } LIMIT 3200`;
      const additional = await get(
        'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(expanded),
      );
      result.results.bindings = [
        ...new Map(
          [...result.results.bindings, ...additional.results.bindings].map((r: any) => [
            r.article.value,
            r,
          ]),
        ).values(),
      ];
    }
  } catch {
    const fallback = `SELECT DISTINCT ?item ?article WHERE { ?item wdt:${property} wd:${s.root}. ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. } LIMIT 3200`;
    result = await get(
      'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(fallback),
    );
  }
  const rows = result.results.bindings.map((r: any) => ({
    title: decodeURIComponent(r.article.value.split('/wiki/')[1]).replaceAll('_', ' '),
    wikidata: r.item.value,
    url: r.article.value,
  }));
  writeFileSync(cache, JSON.stringify(rows));
  return rows;
}
const viewsCache = '.category-cache/pageviews.json';
const viewCache: Record<string, any> = existsSync(viewsCache)
  ? JSON.parse(readFileSync(viewsCache, 'utf8'))
  : {};
let requests = 0;
async function views(titles: string[]) {
  const batches = [];
  for (let i = 0; i < titles.length; i += 40) batches.push(titles.slice(i, i + 40));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < batches.length) {
        const batch = batches[cursor++];
        const params: any = {
          action: 'query',
          format: 'json',
          prop: 'pageviews|pageprops',
          pvipdays: '30',
          titles: batch.join('|'),
          redirects: '1',
        };
        let data: any = { query: { pages: {}, redirects: [], normalized: [] } };
        let continuation: any = {};
        do {
          const part = await get(
            'https://en.wikipedia.org/w/api.php?' +
              new URLSearchParams({ ...params, ...continuation }),
          );
          for (const [id, p] of Object.entries(part.query?.pages || {}))
            data.query.pages[id] = { ...data.query.pages[id], ...(p as any) };
          data.query.redirects.push(...(part.query?.redirects || []));
          data.query.normalized.push(...(part.query?.normalized || []));
          continuation = part.continue;
        } while (continuation);
        const redirects = new Map((data.query?.redirects || []).map((x: any) => [x.from, x.to]));
        const normalized = new Map((data.query?.normalized || []).map((x: any) => [x.from, x.to]));
        for (const title of batch) {
          const key =
            redirects.get(normalized.get(title) || title) || normalized.get(title) || title;
          const page = Object.values(data.query?.pages || {}).find(
            (p: any) => p.title === key,
          ) as any;
          if (
            !page ||
            page.missing !== undefined ||
            page.pageprops?.disambiguation !== undefined ||
            !page.pageviews
          ) {
            viewCache[title] = { excluded: true };
            continue;
          }
          const points = Object.entries(page.pageviews).filter(([, n]) => typeof n === 'number');
          viewCache[title] = {
            title: page.title,
            pageid: page.pageid,
            views: points.reduce((sum, [, n]) => sum + (n as number), 0),
            days: points.length,
            start: points[0]?.[0],
            end: points.at(-1)?.[0],
          };
        }
        requests++;
        if (requests % 10 === 0) writeFileSync(viewsCache, JSON.stringify(viewCache));
        await sleep(200);
      }
    }),
  );
  writeFileSync(viewsCache, JSON.stringify(viewCache));
}
async function build(s: any, index: number) {
  const dest = 'categories/' + s.slug + '.json';
  if (existsSync(dest) && JSON.parse(readFileSync(dest, 'utf8')).answers?.length >= 2000) {
    console.log('CACHED ' + s.slug);
    return;
  }
  console.log('SOURCE ' + s.slug);
  let source = await querySource(s);
  if (s.slug === 'animals') {
    const common =
      'Axolotl|Pangolin|Capybara|Okapi|Quokka|Wombat|Narwhal|Aardvark|Cat|Dog|Lion|Tiger|Giraffe|Zebra|Elephant|Dolphin|Otter|Platypus|Koala|Kangaroo|Red panda|Giant panda|Hedgehog|Raccoon|Red fox|Gray wolf|Brown bear|Polar bear|Meerkat|Sloth|Orangutan|Gorilla|Chimpanzee|Hippopotamus|Rhinoceros|Cheetah|Leopard|Snow leopard|Puma|Jaguar|Beaver|Muskrat|Badger|Wolverine|American bison|Yak|Llama|Alpaca|Dromedary|Bactrian camel|Reindeer|Moose|Wapiti|Sable|Fennec fox|Arctic fox|Harbor seal|Walrus|Sea otter|Blue whale|Humpback whale|Sperm whale'.split(
        '|',
      );
    source = [
      ...common.map((title) => ({
        title,
        url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replaceAll(' ', '_')),
        wikidata: null,
      })),
      ...source,
    ];
  }
  const candidates = source.filter((r: any) => acceptable(r.title)).slice(0, 2450);
  await views(candidates.map((r: any) => r.title).filter((t: string) => !viewCache[t]));
  const seen = new Set<string>();
  const answers = [];
  for (const row of candidates) {
    const v = viewCache[row.title];
    if (!v || v.excluded || v.days < 20 || !acceptable(v.title)) continue;
    const display = v.title;
    const canonical = normalize(display);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const average = v.views / v.days;
    const obscurity =
      average >= 1000 ? 1 : average >= 200 ? 2 : average >= 50 ? 3 : average >= 10 ? 4 : 5;
    answers.push({
      canonical,
      display,
      aliases: [],
      obscurity,
      source: row.url,
      wikidata: row.wikidata,
      pageviews: { total: v.views, days: v.days, start: v.start, end: v.end },
    });
    if (answers.length >= 2200) break;
  }
  const date =
    index < 3
      ? new Date(Date.parse('2026-11-21T12:00:00Z') + index * 86400000).toISOString().slice(0, 10)
      : null;
  const output = {
    id: s.slug,
    slug: s.slug,
    name: s.name,
    status: 'draft',
    date,
    drop_at: date ? dropAt(date) : null,
    total_registrable: answers.length,
    provenance: {
      source: s.wikiCategoryRoots
        ? 'English Wikipedia category lists + PageViewInfo'
        : 'Wikidata SPARQL + English Wikipedia PageViewInfo',
      categoryLists: s.wikiCategoryRoots || null,
      queryRoot: s.root,
      property: s.property || 'P31',
      builtAt: new Date().toISOString(),
      license: 'Wikidata CC0; Wikipedia titles and pageview counts. See source URL on each entry.',
      scoring:
        'Mean daily Wikipedia pageviews over available days in the past 30: 1 >=1000; 2 >=200; 3 >=50; 4 >=10; 5 <10. Missing data excluded.',
      scopeNote: s.note || null,
      reviewRequired: true,
    },
    answers,
  };
  writeFileSync(dest, JSON.stringify(output, null, 2) + '\n');
  console.log('BUILT ' + s.slug + ' ' + answers.length);
  if (answers.length < 2000)
    throw new Error(s.slug + ' has fewer than 2000 measured entries; not schedulable');
}
const selected = process.argv[2] ? sources.filter((s: any) => s.slug === process.argv[2]) : sources;
let failures = [];
for (const source of selected) {
  try {
    await build(
      source,
      sources.findIndex((s: any) => s.slug === source.slug),
    );
  } catch (e) {
    console.error('BLOCKED ' + source.slug + ' ' + String(e));
    failures.push(source.slug);
  }
}
let checklist =
  '# Category review docket\n\nAll registers are drafts. Only the first three carry proposed dates. Nothing may open until the owner reviews and explicitly approves it. Titles retain disambiguating parentheses, rather than silently merging distinct works or places. No fuzzy aliases.\n\n';
for (const s of sources) {
  const path = 'categories/' + s.slug + '.json';
  const c = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  checklist += `## ${s.name}\n\n- Source: Wikidata ${s.root}; English Wikipedia article links in each record.\n- Entries: ${c?.answers?.length || 0}; proposed date: ${c?.date || 'unscheduled'}; status: draft.\n- [ ] Confirm the scope and at least 2,000 suitable answers.\n- [ ] Review every display name for sensitive or offensive terms (automated filter is supplementary).\n- [ ] Check ambiguous titles, duplicates, scientific names and aliases.\n- [ ] Spot-check pageview provenance and 1–5 ratings.\n- [ ] Test familiar and obscure answers.\n- [ ] Approve through the admin command with a future 9 PM Toronto date.\n\n`;
}
writeFileSync('review/categories.md', checklist);
if (failures.length) process.exitCode = 1;
