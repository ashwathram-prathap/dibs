import { resolvePopularity, measured } from './popularity-aliases';
import { rarityDensity } from '../shared/rarity';
import { readCategory } from './category-file';
import { rankPopularity } from '../worker/scoring';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const coverage: any[] = [];
for (const name of readdirSync('categories').filter((n) => n.endsWith('.json'))) {
  const c = readCategory('categories/' + name);
  const path = `public/catalog/${c.slug}/manifest.json`;
  if (!existsSync(path)) continue;
  const meta = JSON.parse(readFileSync(path, 'utf8'));
  const resolved = resolvePopularity(c.answers);
  coverage.push({
    category: c.slug,
    total: c.answers.length,
    missingBefore: resolved.before,
    missingAfter: resolved.after,
    mappings: resolved.mappings,
  });
  const { median, percentiles } = rankPopularity(
    resolved.readings.map((p) => (measured(p) ? p!.total! / p!.days : null)),
  );
  mkdirSync('public/rarity', { recursive: true });
  const curve = JSON.stringify(rarityDensity(percentiles));
  if (Buffer.byteLength(curve) >= 2048) throw Error('Rarity asset exceeds 2 KB');
  writeFileSync(`public/rarity/${c.slug}.json`, curve);
  const data = Buffer.alloc((percentiles.length + 1) * 2);
  data.writeUInt16LE(median, 0);
  percentiles.forEach((p, i) =>
    data.writeUInt16LE(p === null ? 65535 : Math.round(p * 10000), (i + 1) * 2),
  );
  writeFileSync(`public/catalog/${c.slug}/${meta.version}/scores-v2.bin`, data);
}
mkdirSync('review/round19c', { recursive: true });
writeFileSync('review/round19c/popularity-coverage.json', JSON.stringify(coverage, null, 2));
console.log(
  'Category percentile scoring assets ready; alias coverage in review/round19c/popularity-coverage.json',
);
