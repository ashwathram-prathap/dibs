import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readCategory } from './category-file';
const results = JSON.parse(readFileSync('review/coverage/results.json', 'utf8'));
mkdirSync('recipes', { recursive: true });
const groups: Record<string, string[]> = {
  living: ['animals', 'plants', 'birds', 'arthropods'],
  places: [
    'cities',
    'countries',
    'islands',
    'rivers',
    'lakes',
    'mountains',
    'airports',
    'stations',
    'castles',
    'universities',
    'museums',
  ],
  people: ['actors', 'architects', 'composers', 'painters', 'poets', 'footballers'],
  food: ['foods', 'fruits-vegetables'],
  music: ['bands', 'songs', 'albums'],
  screen: ['films', 'television', 'video-games'],
  objects: ['ships', 'asteroids', 'paintings', 'novels'],
};
const broad = [
  'animals',
  'cities',
  'foods',
  'countries',
  'films',
  'songs',
  'actors',
  'plants',
  'bands',
  'islands',
  'fruits-vegetables',
  'birds',
  'albums',
  'television',
  'rivers',
  'novels',
  'airports',
];
const aliases: Record<string, string[]> = {
  films: ['Movies'],
  television: ['TV shows', 'Television shows'],
  countries: ['Countries and territories'],
  bands: ['Music groups', 'Musical ensembles'],
  songs: ['Songs and compositions'],
  albums: ['Albums and EPs'],
  novels: ['Books', 'Novels and novellas'],
  'fruits-vegetables': ['Fruits and vegetables'],
  arthropods: ['Bugs', 'Arthropods'],
  airports: ['Airports and airfields'],
};
for (const result of results) {
  const slug = result.slug,
    path = 'categories/' + slug + '.json',
    c = readCategory(path);
  const sources = [...new Set(c.answers.map((a: any) => a.source).filter(Boolean))] as string[];
  const roots = [
    ...new Set(
      sources.map((s) => {
        try {
          const u = new URL(s);
          return (
            u.origin +
            (u.hostname.includes('wikidata')
              ? '/wiki/Special:EntityData'
              : u.hostname.includes('geonames')
                ? '/export/'
                : u.hostname.includes('wikipedia')
                  ? '/wiki/'
                  : u.pathname)
          );
        } catch {
          return s;
        }
      }),
    ),
  ];
  const recipe = {
    version: 1,
    slug,
    name: c.name,
    kind: Object.entries(groups).find(([, a]) => a.includes(slug))?.[0] || 'objects',
    priority: broad.includes(slug) ? broad.indexOf(slug) + 1 : 50,
    requestNames: [c.name, slug.replaceAll('-', ' '), ...(aliases[slug] || [])],
    sources: roots.slice(0, 60),
    sourceSnapshot: path,
    snapshotSha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    answerSha256: c.answersSha256 || null,
    scope: c.provenance.scopeNote,
    aliases:
      'Use every source alias, normalize case and punctuation, then apply scripts/catalog-aliases.ts; ambiguous aliases never displace another canonical answer.',
    ranking: c.provenance.ranking,
    obvious: 'review/coverage/' + slug + '.txt',
    independent: 'review/coverage/' + slug + '-independent.json',
    build: 'tsx scripts/build-catalog-assets.ts',
    coverage: 'tsx scripts/check-coverage.ts',
    refresh:
      'Complete upstream extraction and ranking are refreshed explicitly; unattended builds reproduce this audited, checksum-pinned snapshot.',
  };
  writeFileSync('recipes/' + slug + '.json', JSON.stringify(recipe, null, 2) + '\n');
}
console.log(
  results.length +
    ' reproducible recipes written; ' +
    results.filter((r: any) => r.ready).length +
    ' pass coverage.',
);
