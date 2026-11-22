import { writeCategory } from './category-file';
import { loadBulkReadership } from './bulk-readership';
import { bestReadership } from './catalog-ranking';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { pageMatchesScope } from './catalog-quality';
import { cleanReferenceRows, usableLatinReferenceName } from './catalog-cleaning';
import {
  commonNamePlurals,
  conjunctionAliases,
  workSubtitleAliases,
  titleArticleAliases,
  geographicAliases,
  shipNameAliases,
  personNameAliases,
} from './catalog-aliases';
import { normalize, normalizeCommonName } from '../worker/domain';
// Every source row is considered; documented quality filters are applied after popularity assessment.
const onlySlugs = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const raw = JSON.parse(readFileSync('.category-cache/r8/candidates.json', 'utf8'));
const definitions = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8'));
const referenceProgress = JSON.parse(
  readFileSync('review/round8/wikidata-reference-progress.json', 'utf8'),
);
const otherDir = '.category-cache/r8/other-references';
if (existsSync(otherDir))
  for (const f of readdirSync(otherDir).filter(
    (f) =>
      f.endsWith('.json') &&
      !f.endsWith('-wikidata.json') &&
      !f.endsWith('-geonames-extra.json') &&
      (!onlySlugs || onlySlugs.includes(f.slice(0, -5))),
  ))
    raw[f.slice(0, -5)] = JSON.parse(readFileSync(otherDir + '/' + f, 'utf8'));
for (const slug of ['mountains', 'rivers', 'lakes', 'islands', 'stations', 'castles']) {
  for (const suffix of ['-wikidata', '-geonames-extra']) {
    const supplementPath = otherDir + '/' + slug + suffix + '.json';
    if (raw[slug] && existsSync(supplementPath))
      raw[slug].push(...JSON.parse(readFileSync(supplementPath, 'utf8')));
  }
}
const countryAliasPath = '.category-cache/r8/iso-aliases.json';
const countryAliases = existsSync(countryAliasPath)
  ? JSON.parse(readFileSync(countryAliasPath, 'utf8'))
  : {};
const iso = await import('../.category-cache/r8/iso.mjs');
raw.countries = iso.iso31661.map((r: any) => ({
  display: r.name,
  aliases: [r.alpha2, r.alpha3, ...(countryAliases[r.alpha2]?.aliases || [])],
  wikipediaTitle: countryAliases[r.alpha2]?.wikipediaTitle,
  source: 'https://github.com/wooorm/iso-3166',
}));
if (onlySlugs) for (const slug of Object.keys(raw)) if (!onlySlugs.includes(slug)) delete raw[slug];
const overrides: Record<string, Record<string, string[]>> = {
  animals: {
    Cat: ['Domestic cat', 'House cat', 'Felis catus', 'Felis domesticus', 'Felis silvestris catus'],
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
    Macau: ['Macao'],
    'British Virgin Islands': ['Virgin Islands (British)'],
    'US Virgin Islands': ['United States Virgin Islands', 'Virgin Islands (U.S.)'],
    'Saint Martin': ['Saint Martin (French part)'],
    'Sint Maarten': ['Sint Maarten (Dutch part)'],
    'Falkland Islands': ['Falkland Islands (Malvinas)'],
    'Caribbean Netherlands': ['Bonaire, Sint Eustatius and Saba'],
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
for (const [slug, unclean] of Object.entries(raw) as any) {
  const categoryLabels: Record<string, string[]> = {
    animals: ['animal'],
    birds: ['bird'],
    plants: ['plant'],
    foods: ['food'],
    'fruits-vegetables': ['ediblefruit', 'fruit', 'vegetable'],
  };
  const input = cleanReferenceRows(unclean).filter(
    (r) =>
      !(r.wikipediaUnavailable && !usableLatinReferenceName(r.display)) &&
      !(categoryLabels[slug] || []).includes(normalizeCommonName(r.display)) &&
      !(slug === 'television' && /\((?:season|series)\s+[^)]+\)$/i.test(r.wikipediaTitle || '')),
  );
  const commonNames = [
    'animals',
    'birds',
    'plants',
    'foods',
    'fruits-vegetables',
    'arthropods',
  ].includes(slug);
  const sourceKey = commonNames ? normalizeCommonName : normalize;
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
  // Explicit editorial renames identify the same entity; source aliases alone
  // must never merge two distinct people, places or work titles.
  const editorialOwners = new Map(
    replacements.flatMap((row) => row.aliases.map((alias) => [sourceKey(alias), row] as const)),
  );
  const exactOwner = new Map<string, any>();
  const byKey = new Map<string, any>();
  const aliasOwner = new Map<string, any>();
  const taxonOwner = new Map<string, any>();
  for (const a of ordered) {
    if (a.wikidata && a.wikipediaTitle) a.aliases.push(a.wikipediaTitle);
    if (a.wikipediaTitle) a.wikipediaTitles = [a.wikipediaTitle];
    const key = sourceKey(a.display);
    if (!key) continue;
    const scientific = a.scientificName ? normalize(a.scientificName) : '';
    const prev =
      exactOwner.get(normalize(a.display)) ||
      byKey.get(key) ||
      (editorialOwners.has(key) && byKey.get(sourceKey(editorialOwners.get(key)!.display))) ||
      (scientific && taxonOwner.get(scientific)) ||
      (commonNames && a.scientificName && aliasOwner.get(sourceKey(a.scientificName)));
    if (prev) {
      if (!prev.wikipediaTitle && a.wikipediaTitle) prev.wikipediaTitle = a.wikipediaTitle;
      prev.wikipediaTitles = [
        ...new Set([...(prev.wikipediaTitles || []), ...(a.wikipediaTitles || [])]),
      ];
      prev.aliases.push(a.display, ...a.aliases);
      byKey.set(key, prev);
      exactOwner.set(normalize(a.display), prev);
      if (scientific) taxonOwner.set(scientific, prev);
      for (const alias of a.aliases)
        if (!byKey.has(sourceKey(alias)) && !aliasOwner.has(sourceKey(alias)))
          aliasOwner.set(sourceKey(alias), prev);
      continue;
    }
    byKey.set(key, a);
    exactOwner.set(normalize(a.display), a);
    if (scientific) taxonOwner.set(scientific, a);
    rows.push(a);
    for (const alias of a.aliases)
      if (!aliasOwner.has(sourceKey(alias))) aliasOwner.set(sourceKey(alias), a);
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
  if (['airports', 'stations'].includes(slug))
    for (const a of rows) {
      for (const name of [a.display, ...a.aliases]) {
        if (slug === 'airports') {
          const short = name.replace(
            /\s+(?:International\s+)?(?:Airport|Airfield|Aerodrome)$/i,
            '',
          );
          if (short !== name) a.aliases.push(short, name.replace(/\bInternational\s+/i, ''));
        } else {
          const short = name.replace(
            /\s+(?:(?:Underground|Tube|Subway|Metro|Railway|Railroad|Rail|Train)\s+)?Station$/i,
            '',
          );
          if (short !== name) a.aliases.push(short);
        }
      }
    }
  // A canonical noun owns its inflections before any ambiguous source alias.
  for (const row of rows)
    row.aliases.push(
      ...[row.display, ...row.aliases].flatMap((name) => [
        ...conjunctionAliases(name),
        ...geographicAliases(slug, name),
      ]),
    );
  if (slug === 'ships')
    for (const row of rows)
      row.aliases.push(...[row.display, ...row.aliases].flatMap(shipNameAliases));
  if (definitions.find((definition: any) => definition.slug === slug)?.property === 'P106')
    for (const row of rows)
      row.aliases.push(...[row.display, ...row.aliases].flatMap(personNameAliases));
  if (
    ['films', 'albums', 'songs', 'novels', 'video-games', 'television', 'paintings'].includes(slug)
  )
    for (const row of rows)
      row.aliases.push(
        ...[row.display, ...row.aliases].flatMap((name) => [
          ...workSubtitleAliases(name),
          ...titleArticleAliases(name),
        ]),
      );
  const inflectionOwners = new Map<string, any>();
  if (commonNames)
    for (const a of rows)
      for (const name of commonNamePlurals(a.display)) {
        const key = normalize(name);
        if (!inflectionOwners.has(key)) inflectionOwners.set(key, a);
      }
  for (const a of rows) used.add(normalize(a.display));
  for (const a of rows) {
    a.canonical = normalize(a.display);
    a.display = a.display[0].toUpperCase() + a.display.slice(1);
    a.aliases = [...new Set(a.aliases as string[])].filter((x: any) => {
      const key = normalize(x);
      if (!key || used.has(key) || (inflectionOwners.has(key) && inflectionOwners.get(key) !== a))
        return false;
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
const referenceMetadata = Object.fromEntries(
  Object.values(raw).flatMap((rows: any) =>
    rows
      .filter((row: any) => row.wikipediaTitle && typeof row.wikipediaDescription === 'string')
      .map((row: any) => [row.wikipediaTitle, { description: row.wikipediaDescription }]),
  ),
);
const metadataFor = (title: string) => referenceMetadata[title] || metadata[title];
const cache: Record<string, any> = existsSync(cacheFile)
  ? JSON.parse(readFileSync(cacheFile, 'utf8'))
  : {};
const saveRankingCache = () => {
  for (const [path, data] of [
    [cacheFile, cache],
    [metadataFile, metadata],
  ] as const) {
    writeFileSync(path + '.next', JSON.stringify(data));
    renameSync(path + '.next', path);
  }
};
const title = (s: string) => s[0].toUpperCase() + s.slice(1);
const titleOverrides = JSON.parse(readFileSync('scripts/r8-page-titles.json', 'utf8'));
const measurementTitles = (a: any, slug: string): string[] =>
  a.wikipediaUnavailable && !a.wikipediaTitle && !a.wikipediaTitles?.length
    ? []
    : titleOverrides[slug]?.[a.display]
      ? [titleOverrides[slug][a.display]]
      : a.wikipediaTitles?.length
        ? a.wikipediaTitles
        : [a.wikipediaTitle || a.scientificName || title(a.display)];
const measurementTitle = (a: any, slug: string) => measurementTitles(a, slug)[0];
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
const extraTitles: string[] = Object.entries(independentPools)
  .filter(([slug]) => !onlySlugs || onlySlugs.includes(slug))
  .flatMap(([, rows]: any) =>
    rows.map((r: any) => (typeof r === 'string' ? r : r.title || r.name)),
  );
for (const t of extraTitles) priority.add(t);
const allTitles = [
  ...new Set([
    ...Object.entries(catalogs).flatMap(([slug, rows]) =>
      rows.flatMap((a) => measurementTitles(a, slug)),
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
const sameInventoryQueue = inventory?.queueHash === queueHash;
const checkedText =
  inventory?.checkedFile && existsSync('.category-cache/r8/' + inventory.checkedFile)
    ? readFileSync('.category-cache/r8/' + inventory.checkedFile, 'utf8')
    : null;
if (checkedText && createHash('sha256').update(checkedText).digest('hex') !== inventory.queueHash)
  throw Error('Title inventory queue checksum mismatch');
const checkedTitles: Set<string> | null = checkedText ? new Set(JSON.parse(checkedText)) : null;
const knownTitles: Set<string> | null =
  sameInventoryQueue || checkedTitles ? new Set(inventory.present) : null;
const absentFromInventory = (t: string) =>
  !!knownTitles && (sameInventoryQueue || !!checkedTitles?.has(t)) && !knownTitles.has(t);
if (allTitles.length > 500000 && !knownTitles)
  throw Error(
    'Regenerate the complete measurement queue and title inventory before ranking large reference sets.',
  );
const bulk = process.argv.includes('--bulk')
  ? loadBulkReadership([...allTitles, ...allTitles.map((t) => cache[t]?.title).filter(Boolean)])
  : null;
const qualifiedTitles = new Set<string>();
const unqualifiedTitles = new Set<string>();
const poolMetadata = new Set<string>(
  ['bands', 'paintings'].flatMap((slug) =>
    (independentPools[slug] || []).map((r: any) => r.title || r.name),
  ),
);
const scopeDomains = new Set([
  'animals',
  'birds',
  'plants',
  'arthropods',
  'foods',
  'fruits-vegetables',
  'cities',
  'mountains',
  'rivers',
  'lakes',
  'islands',
  'stations',
  'airports',
]);
for (const [slug, rows] of Object.entries(catalogs))
  for (const a of rows) {
    const qualified = !scopeDomains.has(slug) || a.wikidata;
    for (const t of measurementTitles(a, slug)) {
      if (qualified) qualifiedTitles.add(slug + ':' + t);
      else unqualifiedTitles.add(t);
    }
  }
const confirmedGaps = new Set(
  JSON.parse(readFileSync('scripts/r8-confirmed-pageview-gaps.json', 'utf8')).titles,
);
const pageviewsFor = (t: string): any => {
  if (bulk) {
    if (['no article', 'disambiguation'].includes(cache[t]?.status)) return cache[t];
    const resolved = cache[t]?.title || t;
    const item = bulk.readings[resolved];
    if (item)
      return {
        total: item[0],
        days: 31,
        start: bulk.proof.periodStart,
        end: bulk.proof.periodEnd,
        title: resolved,
        pageId: item[1],
        status: 'measured complete month',
      };
    return {
      total: null,
      days: 0,
      title: resolved,
      status: 'not in complete monthly human-pageview data',
    };
  }
  return (
    (!cache[t]?.days && (confirmedGaps.has(t) || confirmedGaps.has(cache[t]?.title))
      ? {
          total: null,
          days: 0,
          title: cache[t]?.title || t,
          status: 'confirmed no pageview data',
          evidence: 'review/round8/pageview-gaps.json',
        }
      : cache[t]) ||
    (absentFromInventory(t)
      ? {
          total: 0,
          days: 0,
          status: 'not in complete title inventory',
          inventoryDate: inventory.asOf,
        }
      : { total: 0, days: 0, status: 'unavailable' })
  );
};
const needsMetadata = (t: string) =>
  !!bulk &&
  pageviewsFor(t).days > 0 &&
  (unqualifiedTitles.has(t) || poolMetadata.has(t)) &&
  !metadataFor(cache[t]?.title || t);
if (process.argv.includes('--status')) {
  for (const [slug, rows] of Object.entries(catalogs)) {
    const pending = rows.filter((r) =>
      measurementTitles(r, slug).some(
        (t) =>
          ['unavailable', 'measurement unavailable'].includes(pageviewsFor(t).status) ||
          (needsMetadata(t) && !qualifiedTitles.has(slug + ':' + t)),
      ),
    );
    console.log(
      slug,
      JSON.stringify({
        candidates: rows.length,
        keys: rows.reduce((sum, row) => sum + 1 + row.aliases.length, 0),
        binaryIndexEstimateBytes:
          32 +
          rows.reduce(
            (sum, row) => sum + 16 * (1 + row.aliases.length) + 8 + Buffer.byteLength(row.display),
            0,
          ),
        pending: pending.length,
        examples: pending.slice(0, 10).map((r) => measurementTitle(r, slug)),
      }),
    );
  }
  process.exit(0);
}
const dayPriority = new Map<string, number>();
const liveOrder = JSON.parse(readFileSync('review/round8/production-registers-before.json', 'utf8'))
  .filter((r: any) => r.date)
  .sort((a: any, b: any) => a.date.localeCompare(b.date));
for (const [i, live] of liveOrder.entries())
  for (const row of catalogs[live.id] || []) {
    const t = measurementTitle(row, live.id);
    dayPriority.set(t, Math.min(dayPriority.get(t) ?? 99, i));
  }
for (const row of catalogs.countries || []) {
  const t = measurementTitle(row, 'countries');
  dayPriority.set(t, Math.min(dayPriority.get(t) ?? 99, 0.5));
}
for (const [slug, rows] of Object.entries(catalogs)) {
  const fixture = 'review/coverage/' + slug + '.txt';
  if (!existsSync(fixture)) continue;
  const keys = new Set(readFileSync(fixture, 'utf8').trim().split('\n').map(normalize));
  for (const row of rows)
    if (keys.has(normalize(row.display)) || row.aliases.some((s: string) => keys.has(normalize(s))))
      priority.add(measurementTitle(row, slug));
}
const pending = allTitles
  .filter((t) => bulk || !absentFromInventory(t) || cache[t])
  .filter((t) =>
    bulk
      ? needsMetadata(t)
      : !cache[t] ||
        ['unavailable', 'measurement unavailable'].includes(cache[t].status) ||
        (cache[t].days > 0 && !metadata[cache[t].title]?.description),
  )
  .sort(
    (a, b) =>
      (dayPriority.get(a) ?? 99) - (dayPriority.get(b) ?? 99) ||
      Number(priority.has(b)) - Number(priority.has(a)),
  );
process.on('SIGTERM', () => {
  if (!process.argv.includes('--offline')) {
    saveRankingCache();
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
    prop: bulk ? 'pageprops|description' : 'pageviews|pageprops|description',
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
    if (bulk) {
      cache[t] = {
        total: null,
        days: 0,
        title: p?.title || t,
        status:
          p?.missing !== undefined
            ? 'no article'
            : p?.pageprops?.disambiguation !== undefined
              ? 'disambiguation'
              : 'bulk metadata checked',
      };
      continue;
    }
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
          saveRankingCache();
          console.log('Measured', done, '/', pending.length);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }),
  );
if (!process.argv.includes('--offline')) {
  saveRankingCache();
}

if (process.argv.includes('--measure-only')) process.exit(0);
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
  castles:
    'Castles, forts and palaces in GeoNames, complemented by Wikidata castles, fortifications, palaces and manor houses; one answer per name.',
  songs:
    'Songs, singles and musical compositions, including musical theatre and operas, with English Wikipedia articles; one answer per title.',
  television:
    'Television series, miniseries and independently named seasons with English Wikipedia articles; numbered season articles are excluded. One answer per title.',
  'video-games':
    'Named video games, paired versions, compilations and game series in Wikidata; English article titles or English/Latin-script source names. One answer per title.',
  asteroids:
    'Named asteroids and other minor planets in the complete NASA/JPL Small-Body Database; names and numbered names accepted.',
  arthropods: 'English common names for insects, spiders, crustaceans and other arthropods.',
  mountains:
    'Mountains, ranges, peaks and volcanoes in the full GeoNames reference, complemented by Wikidata; one answer per name.',
  rivers:
    'Rivers, streams and wadis in the full GeoNames reference, complemented by Wikidata; one answer per name.',
  lakes:
    'Lakes and reservoirs in the full GeoNames reference, complemented by Wikidata; one answer per name.',
  islands:
    'Islands, groups and islets in the full GeoNames reference, complemented by Wikidata; one answer per name.',
  stations:
    'Current and former railway and metro stations and stops in the full GeoNames reference, complemented by Wikidata; one answer per name.',
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
  const rankingComplete = answers.every((a) =>
    measurementTitles(a, slug).every(
      (t) =>
        !['unavailable', 'measurement unavailable'].includes(pageviewsFor(t).status) &&
        (!needsMetadata(t) || qualifiedTitles.has(slug + ':' + t)),
    ),
  );
  const geographicQuality = [
    'mountains',
    'rivers',
    'lakes',
    'islands',
    'stations',
    'castles',
  ].includes(slug);
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
  const articleOwners = new Map<string, any>();
  for (const a of answers)
    for (const name of [a.display, ...a.aliases]) articleOwners.set(normalize(name), a);
  for (const a of answers) {
    a.pageviews = bestReadership(
      measurementTitles(a, slug).map((t) => {
        const reading = pageviewsFor(t);
        const m = metadataFor(reading.title);
        return qualifiedTitles.has(slug + ':' + t) ||
          pageMatchesScope(slug, m?.description || '', !!a.scientificName && t === a.scientificName)
          ? reading
          : { total: null, days: 0, title: reading.title, status: 'scope not verified' };
      }),
    );
    if (a.wikipediaUnavailable && !measurementTitles(a, slug).length)
      a.pageviews = {
        total: null,
        days: 0,
        status: 'No English article in the complete source reference',
      };
    const resolvedOwner = articleOwners.get(normalize(a.pageviews.title || ''));
    if (resolvedOwner && resolvedOwner !== a)
      a.pageviews = {
        total: null,
        days: 0,
        title: a.pageviews.title,
        status: 'shared article; readership attributed to its own accepted name',
      };
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
  answers.sort(
    (a, b) =>
      b.pageviews.total / (b.pageviews.days || 1) - a.pageviews.total / (a.pageviews.days || 1) ||
      a.display.localeCompare(b.display),
  );
  const old = existsSync('categories/' + slug + '.json')
    ? JSON.parse(readFileSync('categories/' + slug + '.json', 'utf8'))
    : {};
  writeCategory('categories/' + slug + '.json', {
    ...old,
    id: slug,
    slug,
    name: names[slug],
    status: 'draft',
    date: old.date || null,
    total_registrable: answers.length,
    provenance: {
      source:
        'Full reference extraction, editorial common names, ' +
        (bulk ? 'Wikimedia complete monthly human pageviews' : 'Wikipedia PageViewInfo'),
      scopeNote: scopes[slug],
      builtAt: new Date().toISOString(),
      identityPolicy: 'complete-reference-v2',
      wikidataNamePolicy: raw[slug].some((r: any) => r.wikidata)
        ? (definitions.find((d: any) => d.slug === slug)?.allowNamedWithoutArticle
            ? 'english-article-or-source-label-v4'
            : 'english-article-title-v3') + '+en-mul-labels-aliases-v3'
        : null,
      classificationRevision: definitions.find((d: any) => d.slug === slug)?.cacheKey || 'base',
      scopeValidation: 'article-descriptions-v3',
      reviewRequired: true,
      coverageRequired: true,
      unmeasured: answers.filter((a) => !a.pageviews.days).length,
      license: 'See /data/licenses.txt',
      completeSources:
        (!['animals', 'plants', 'arthropods'].includes(slug) ||
          existsSync('.category-cache/r8/gbif-extracted.json')) &&
        raw[slug].every(
          (r: any) =>
            !r.wikidata || (r.aliasesComplete && r.aliasPolicy === 'en-mul-labels-aliases-v3'),
        ) &&
        (!raw[slug].some((r: any) => r.wikidata) ||
          (referenceProgress[slug]?.complete &&
            referenceProgress[slug]?.labelPolicy ===
              (definitions.find((d: any) => d.slug === slug)?.allowNamedWithoutArticle
                ? 'english-article-or-source-label-v4'
                : 'english-article-title-v3') &&
            referenceProgress[slug]?.cacheKey ===
              definitions.find((d: any) => d.slug === slug)?.cacheKey)),
      candidateCount,
      rankingComplete,
      qualityFilter: geographicQuality
        ? 'All cleaned GeoNames names retained. Wikipedia descriptions qualify readership only; absent or unrelated articles leave obscurity unknown. No result-count cap.'
        : null,
      ranking: bulk
        ? 'Complete October 2026 human pageviews, all access methods, divided by 31 days; absent data remains unknown'
        : '30 available days; unavailable pageviews retained as unknown, never fabricated',
    },
    answers,
  });
  console.log('BUILT', slug, answers.length);
}
