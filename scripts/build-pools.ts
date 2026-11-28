import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { catalogSources, readCatalogSource } from './catalog-sources';
import { resolvePopularity, measured } from './popularity-aliases';
import { poolMembership, POOL_VERSION } from '../shared/flow-rules';
import { SCORING_VERSION } from '../shared/scoring-assets';
const plan = JSON.parse(readFileSync('scripts/category-plan.json', 'utf8'));
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const assets: any[] = [];
for (const source of catalogSources()) {
  const c = readCatalogSource(source),
    meta = JSON.parse(readFileSync(`public/catalog/${c.slug}/manifest.json`, 'utf8'));
  const version = source.retained ? source.version : meta.version;
  const values = resolvePopularity(c.answers).readings.map((p) =>
    measured(p) ? p!.total! / p!.days : null,
  );
  const pool = poolMembership(values, plan.rarityPoolSizes[c.slug]);
  const data = {
    version: POOL_VERSION,
    catalogVersion: version,
    scoringVersion: SCORING_VERSION,
    count: c.answers.length,
    poolSize: pool.poolSize,
    boundaryPolicy: 'include all measured answers tied at the cutoff',
    sourceDigest: hash(JSON.stringify(values)),
    membership: pool.membership,
  };
  const bytes = Buffer.from(JSON.stringify(data)),
    path = `public/catalog/${c.slug}/${version}/${POOL_VERSION}.json`;
  if (existsSync(path) && !readFileSync(path).equals(bytes))
    throw Error('Immutable pool changed; bump version: ' + path);
  writeFileSync(path, bytes);
  assets.push({
    path: path.slice(6),
    sha256: hash(bytes),
    bytes: bytes.length,
    poolSize: pool.poolSize,
    catalogCount: c.answers.length,
  });
}
mkdirSync('review/r21-flow', { recursive: true });
writeFileSync(
  'review/r21-flow/pool-assets.json',
  JSON.stringify({ version: POOL_VERSION, assets }, null, 2),
);
console.log('Pinned pool assets:', assets.length);
