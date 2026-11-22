import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pageMatchesScope } from './catalog-quality';
import { commonNamePlurals } from './catalog-aliases';
import { normalize } from '../worker/domain';
// All source rows are considered. Missing Wikipedia articles never exclude a real reference answer.
const raw = JSON.parse(readFileSync('.category-cache/r8/candidates.json', 'utf8'));
const definitions = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8'));
const otherDir = '.category-cache/r8/other-references';
if (existsSync(otherDir))
  for (const f of readdirSync(otherDir).filter((f) => f.endsWith('.json')))
    raw[f.slice(0, -5)] = JSON.parse(readFileSync(otherDir + '/' + f, 'utf8'));
const iso = await import('../.category-cache/r8/iso.mjs');
raw.countries = iso.iso31661.map((r: any) => ({
  display: r.name,
  aliases: [r.alpha2, r.alpha3],
  source: 'https://github.com/wooorm/iso-3166',
}));
const overrides: Record<string, Record<string, string[]>> = {
  animals: {
    Cat: ['Domestic cat', 'House cat', 'Felis catus', 'Felis domesticus'],
    Dog: ['Domestic dog', 'Pooch', 'Canis familiaris'],
    Chicken: ['Domestic fowl', 'Cockerel', 'Pullet', 'Rooster', 'Hen'],
    Tiger: ['Tigress'],
    Peacock: ['Peafowl', 'Peahen', 'Peachick'],
    Wolf: ['wolves'],
    Mouse: ['mice'],
    Octopus: ['octopi', 'octopuses'],
    Cow: ['cattle'],
    Puma: ['cougar', 'mountain lion'],
    Orca: ['killer whale'],
    Ladybug: ['ladybird'],
  },
  birds: {
    Chicken: ['Domestic fowl', 'Cockerel', 'Pullet', 'Rooster', 'Hen'],
    Peacock: ['Peafowl', 'Peahen', 'Peachick'],
  },
  foods: { Poultry: ['Bird', 'Fowl'] },
  cities: {
    "Al Majma'ah": ['Majmaah'],
    'Inda Silasē': ['Shire', 'Shire Inda Selassie'],
    'New York': ['NYC', 'New York City'],
    'Saint Petersburg': ['St Petersburg'],
    'St. John’s': ['Saint Johns'],
  },
  countries: {
    Palestine: ['Palestine, State of'],
    'Vatican City': ['Holy See'],
    Brunei: ['Brunei Darussalam'],
    Micronesia: ['Micronesia, Federated States of'],
    'Democratic Republic of the Congo': ['Congo, Democratic Republic of the'],
    'Republic of the Congo': ['Congo'],
    'Cape Verde': ['Cabo Verde'],
    'United States': ['USA', 'US', 'United States of America', 'America'],
    'United Kingdom': [
      'UK',
      'Great Britain',
      'Britain',
      'United Kingdom of Great Britain and Northern Ireland',
    ],
    Netherlands: ['Holland', 'Netherlands, Kingdom of the'],
    'Ivory Coast': ['Côte d’Ivoire'],
    'South Korea': ['Korea, Republic of'],
    'North Korea': ['Korea, Democratic People’s Republic of'],
    Russia: ['Russian Federation'],
    Iran: ['Iran, Islamic Republic of'],
    Vietnam: ['Viet Nam'],
    Taiwan: ['Taiwan, Province of China'],
    Bolivia: ['Bolivia, Plurinational State of'],
    Venezuela: ['Venezuela, Bolivarian Republic of'],
    Tanzania: ['Tanzania, United Republic of'],
    Syria: ['Syrian Arab Republic'],
    Moldova: ['Moldova, Republic of'],
    Laos: ['Lao People’s Democratic Republic'],
    Turkey: ['Türkiye'],
    Czechia: ['Czech Republic'],
    Eswatini: ['Swaziland'],
    Myanmar: ['Burma'],
  },
};
const supplement = existsSync('scripts/r8-common-names.json')
  ? JSON.parse(readFileSync('scripts/r8-common-names.json', 'utf8'))
  : {};
const catalogs: Record<string, any[]> = {};
for (const [slug, input] of Object.entries(raw) as any) {
  const used = new Set<string>();
  const rows: any[] = [];
  const replacements = Object.entries(overrides[slug] || {}).map(([display, aliases]) => ({
    display,
    aliases,
    source: 'Dibs common-name editorial supplement',
  }));
  const ordered = [
    ...replacements,
    ...(supplement[slug] || []).map((display: string) => ({
      display,
      aliases: [],
      source: 'Dibs common-name editorial supplement',
    })),
    ...input.sort((a: any, b: any) => (b.population || 0) - (a.population || 0)),
  ];
  const byKey = new Map<string, any>();
  const aliasOwner = new Map<string, any>();
  const taxonOwner = new Map<string, any>();
  for (const a of ordered) {
    const key = normalize(a.display);
    if (!key) continue;
    const scientific = a.scientificName ? normalize(a.scientificName) : '';
    const prev =
      byKey.get(key) ||
      (scientific && taxonOwner.get(scientific)) ||
      (!['cities', 'mountains', 'rivers', 'lakes', 'islands', 'stations', 'airports'].includes(
        slug,
      ) &&
        aliasOwner.get(key));
    if (prev) {
      prev.aliases.push(a.display, ...a.aliases);
      byKey.set(key, prev);
      if (scientific) taxonOwner.set(scientific, prev);
      for (const alias of a.aliases)
        if (!byKey.has(normalize(alias)) && !aliasOwner.has(normalize(alias)))
          aliasOwner.set(normalize(alias), prev);
      continue;
    }
    byKey.set(key, a);
    if (scientific) taxonOwner.set(scientific, a);
    rows.push(a);
    for (const alias of a.aliases)
      if (!aliasOwner.has(normalize(alias))) aliasOwner.set(normalize(alias), a);
  }
  if (['animals', 'birds', 'plants', 'foods', 'fruits-vegetables', 'arthropods'].includes(slug)) {
    const genera = new Set(
      input
        .filter((r: any) => r.scientificName)
        .map((r: any) => r.scientificName.split(' ')[0].toLowerCase()),
    );
    for (const a of rows) {
      const names = [a.display, ...a.aliases].filter(
        (name: string) =>
          name.trim() && !(name.includes(' ') && genera.has(name.split(' ')[0].toLowerCase())),
      );
      a.aliases.push(...names.flatMap(commonNamePlurals));
    }
  }
  for (const a of rows) used.add(normalize(a.display));
  for (const a of rows) {
    a.canonical = normalize(a.display);
    a.display = a.display[0].toUpperCase() + a.display.slice(1);
    a.aliases = [...new Set(a.aliases as string[])].filter((x: any) => {
      const key = normalize(x);
      if (!key || used.has(key)) return false;
      used.add(key);
      return true;
    });
  }
  catalogs[slug] = rows;
}
const cacheFile = '.category-cache/r8/pageviews.json';
const metadataFile = '.category-cache/r8/page-metadata.json';
const metadata: Record<string, any> = existsSync(metadataFile)
  ? JSON.parse(readFileSync(metadataFile, 'utf8'))
  : {};
const cache: Record<string, any> = existsSync(cacheFile)
  ? JSON.parse(readFileSync(cacheFile, 'utf8'))
  : {};
const title = (s: string) => s[0].toUpperCase() + s.slice(1);
const titleOverrides = JSON.parse(readFileSync('scripts/r8-page-titles.json', 'utf8'));
const measurementTitle = (a: any, slug: string) =>
  titleOverrides[slug]?.[a.display] || a.wikipediaTitle || a.scientificName || title(a.display);
const priority = new Set(
  readdirSync('review/coverage')
    .filter((f) => f.endsWith('.txt'))
    .flatMap((f) =>
      readFileSync('review/coverage/' + f, 'utf8')
        .trim()
        .split('\n')
        .map(title),
    ),
);
const independentPools = existsSync('.category-cache/r8/independent-pools.json')
  ? JSON.parse(readFileSync('.category-cache/r8/independent-pools.json', 'utf8'))
  : {};
const extraTitles: string[] = Object.values(independentPools).flatMap((rows: any) =>
  rows.map((r: any) => (typeof r === 'string' ? r : r.title || r.name)),
);
for (const t of extraTitles) priority.add(t);
const allTitles = [
  ...new Set([
    ...Object.entries(catalogs).flatMap(([slug, rows]) =>
      rows.map((a) => measurementTitle(a, slug)),
    ),
    ...extraTitles,
  ]),
];
const queueText = JSON.stringify(allTitles);
const queueHash = createHash('sha256').update(queueText).digest('hex');
if (process.argv.includes('--write-measurement-queue')) {
  writeFileSync('.category-cache/r8/measurement-queue.json', queueText);
  console.log('Wrote complete measurement queue', allTitles.length, queueHash);
  process.exit(0);
}
const inventoryPath = '.category-cache/r8/wiki-title-presence.json';
const inventory = existsSync(inventoryPath)
  ? JSON.parse(readFileSync(inventoryPath, 'utf8'))
  : null;
const knownTitles: Set<string> | null =
  inventory?.queueHash === queueHash ? new Set(inventory.present) : null;
if (allTitles.length > 500000 && !knownTitles)
  throw Error(
    'Regenerate the complete measurement queue and title inventory before ranking large reference sets.',
  );
const pageviewsFor = (t: string) =>
  cache[t] ||
  (knownTitles && !knownTitles.has(t)
    ? {
        total: 0,
        days: 0,
        status: 'not in complete title inventory',
        inventoryDate: inventory.asOf,
      }
    : { total: 0, days: 0, status: 'unavailable' });
const pending = allTitles
  .filter((t) => !knownTitles || knownTitles.has(t) || cache[t])
  .filter(
    (t) =>
      !cache[t] ||
      ['unavailable', 'measurement unavailable'].includes(cache[t].status) ||
      (cache[t].days > 0 && !metadata[cache[t].title]?.description),
  )
  .sort((a, b) => Number(priority.has(b)) - Number(priority.has(a)));
process.on('SIGTERM', () => {
  if (!process.argv.includes('--offline')) {
    writeFileSync(cacheFile, JSON.stringify(cache));
    writeFileSync(metadataFile, JSON.stringify(metadata));
  }
  process.exit(0);
});
// Coverage fixtures influence measurement order only, never membership or acceptance.
console.log('Measuring', pending.length, 'uncapped candidate titles');
let cursor = 0,
  done = 0,
  failedBatches = 0;
async function measure(batch: string[]) {
  const params = {
    action: 'query',
    format: 'json',
    prop: 'pageviews|pageprops|description',
    pvipdays: '30',
    titles: batch.join('|'),
    redirects: '1',
  };
  let data: any = { query: { pages: {}, redirects: [], normalized: [] } },
    cont: any = {};
  do {
    let response: any;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(
          'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ ...params, ...cont }),
          {
            headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
            signal: AbortSignal.timeout(30000),
          },
        );
        if (r.status === 429)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(60000, Number(r.headers.get('retry-after') || 60) * 1000)),
          );
        if (!r.ok) throw Error(String(r.status));
        response = await r.json();
        if (response.error) throw Error(response.error.info);
        break;
      } catch (e) {
        if (i === 2) throw e;
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    for (const [id, page] of Object.entries(response.query?.pages || {}) as [string, any][]) {
      const old = data.query.pages[id] || {};
      data.query.pages[id] = {
        ...old,
        ...page,
        pageprops: { ...old.pageprops, ...page.pageprops },
        pageviews: { ...old.pageviews, ...page.pageviews },
      };
    }
    data.query.redirects.push(...(response.query?.redirects || []));
    data.query.normalized.push(...(response.query?.normalized || []));
    cont = response.continue;
  } while (cont);
  const redirects = new Map(
    [...data.query.normalized, ...data.query.redirects].map((r: any) => [r.from, r.to]),
  );
  for (const t of batch) {
    let key: any = t;
    for (let i = 0; i < 5 && redirects.has(key); i++) key = redirects.get(key);
    const p: any = Object.values(data.query.pages).find((p: any) => p.title === key);
    if (p)
      metadata[p.title] = {
        title: p.title,
        description:
          p.description ||
          p.pageprops?.['wikibase-shortdesc'] ||
          metadata[p.title]?.description ||
          '',
        disambiguation: p.pageprops?.disambiguation !== undefined,
      };
    const points = Object.entries(p?.pageviews || {}).filter(([, n]) => typeof n === 'number');
    cache[t] =
      !p || p.missing !== undefined || p.pageprops?.disambiguation !== undefined || !points.length
        ? {
            total: 0,
            days: 0,
            title: p?.title,
            status:
              p?.missing !== undefined
                ? 'no article'
                : p?.pageprops?.disambiguation !== undefined
                  ? 'disambiguation'
                  : 'measurement unavailable',
          }
        : {
            total: points.reduce((n, [, v]) => n + (v as number), 0),
            days: points.length,
            start: points[0][0],
            end: points.at(-1)![0],
            title: p.title,
            status: 'measured',
          };
  }
}
if (!process.argv.includes('--offline'))
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < pending.length) {
        const batch = pending.slice(cursor, (cursor += 50));
        try {
          await measure(batch);
        } catch (e) {
          console.error('Unmeasured batch', batch[0], String(e));
          if (++failedBatches >= 3) {
            console.error(
              'BLOCKED: three batches failed after three request attempts each; preserving unknown measurements.',
            );
            break;
          }
        }
        done += batch.length;
        if (done % 400 === 0) {
          writeFileSync(cacheFile, JSON.stringify(cache));
          writeFileSync(metadataFile, JSON.stringify(metadata));
          console.log('Measured', done, '/', pending.length);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }),
  );
if (!process.argv.includes('--offline')) {
  writeFileSync(cacheFile, JSON.stringify(cache));
  writeFileSync(metadataFile, JSON.stringify(metadata));
}

const names: any = {
  ...Object.fromEntries(definitions.map((d: any) => [d.slug, d.name])),
  animals: 'Animals',
  birds: 'Birds',
  plants: 'Plants',
  foods: 'Foods',
  cities: 'Cities',
  countries: 'Countries & territories',
  'fruits-vegetables': 'Fruits & vegetables',
};
const scopes: any = {
  ...Object.fromEntries(
    definitions.map((d: any) => [
      d.slug,
      d.name + ' classified by Wikidata with English Wikipedia articles; one answer per name.',
    ]),
  ),
  arthropods: 'English common names for insects, spiders, crustaceans and other arthropods.',
  mountains:
    'Mountains, ranges, peaks and volcanoes in GeoNames with verified English Wikipedia articles; one answer per name.',
  rivers:
    'Rivers, streams and wadis in GeoNames with verified English Wikipedia articles; one answer per name.',
  lakes:
    'Lakes and reservoirs in GeoNames with verified English Wikipedia articles; one answer per name.',
  islands:
    'Islands, groups and islets in GeoNames with verified English Wikipedia articles; one answer per name.',
  stations:
    'Current and former railway and metro stations and stops in GeoNames with verified English Wikipedia articles; one answer per name.',
  airports:
    'Current and former airports, airfields and seaplane bases in OurAirports; excludes heliports and balloonports.',
  animals:
    'English common names for animals of every kind, including general groups and bird species.',
  birds: 'Bird species and general bird names.',
  plants: 'English common names for plants, including trees, flowers, herbs and crops.',
  foods: 'Foods, dishes, drinks and edible ingredients.',
  cities:
    'Named populated places in GeoNames cities1000: population 1,000+ or administrative seats; one answer per name.',
  countries: 'ISO 3166 countries and territories, with common alternate names.',
  'fruits-vegetables': 'Culinary fruits and vegetables, including varieties.',
};
for (const [slug, answers] of Object.entries(catalogs)) {
  const candidateCount = answers.length;
  const rankingComplete = answers.every(
    (a) =>
      !['unavailable', 'measurement unavailable'].includes(
        pageviewsFor(measurementTitle(a, slug)).status,
      ),
  );
  const geographicQuality = ['mountains', 'rivers', 'lakes', 'islands', 'stations'].includes(slug);
  if (slug === 'foods') {
    for (let i = answers.length - 1; i >= 0; i--) {
      const a = answers[i];
      const description = metadata[cache[measurementTitle(a, slug)]?.title]?.description || '';
      if (
        a.source.startsWith('https://en.wikipedia.org/wiki/') &&
        /cooking (method|technique)|method of cooking|chef|restaurateur|actor|politician|region of|province|language|ethnic group|city in|town in/i.test(
          description,
        )
      )
        answers.splice(i, 1);
    }
  }
  for (const a of answers) {
    a.pageviews = pageviewsFor(measurementTitle(a, slug));
    const m = metadata[a.pageviews.title];
    if (
      !pageMatchesScope(
        slug,
        m?.description || '',
        !!a.scientificName && measurementTitle(a, slug) === a.scientificName,
      )
    )
      a.pageviews = { total: 0, days: 0, status: 'scope not verified' };
    const mean = a.pageviews.days ? a.pageviews.total / a.pageviews.days : 0;
    a.obscurity = a.pageviews.days
      ? mean >= 1000
        ? 1
        : mean >= 200
          ? 2
          : mean >= 50
            ? 3
            : mean >= 10
              ? 4
              : 5
      : null;
  }
  if (geographicQuality) {
    for (let i = answers.length - 1; i >= 0; i--)
      if (!answers[i].pageviews.days) answers.splice(i, 1);
  }
  answers.sort(
    (a, b) =>
      b.pageviews.total / (b.pageviews.days || 1) - a.pageviews.total / (a.pageviews.days || 1) ||
      a.display.localeCompare(b.display),
  );
  const old = existsSync('categories/' + slug + '.json')
    ? JSON.parse(readFileSync('categories/' + slug + '.json', 'utf8'))
    : {};
  writeFileSync(
    'categories/' + slug + '.json',
    JSON.stringify({
      ...old,
      id: slug,
      slug,
      name: names[slug],
      status: 'draft',
      date: old.date || null,
      total_registrable: answers.length,
      provenance: {
        source: 'Full reference extraction, editorial common names, Wikipedia PageViewInfo',
        scopeNote: scopes[slug],
        builtAt: new Date().toISOString(),
        identityPolicy: 'complete-reference-v2',
        reviewRequired: true,
        coverageRequired: true,
        unmeasured: answers.filter((a) => !a.pageviews.days).length,
        license: 'See /data/licenses.txt',
        completeSources:
          !['animals', 'plants'].includes(slug) ||
          existsSync('.category-cache/r8/gbif-extracted.json'),
        candidateCount,
        rankingComplete,
        qualityFilter: geographicQuality
          ? 'Full GeoNames candidate set checked against the complete English Wikipedia title inventory, then measured; retains only an English article whose description verifies this geographic kind. No result-count cap.'
          : null,
        ranking: '30 available days; unavailable pageviews retained as unknown, never fabricated',
      },
      answers,
    }) + '\n',
  );
  console.log('BUILT', slug, answers.length);
}
