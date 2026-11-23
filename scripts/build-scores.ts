import { resolvePopularity, measured } from './popularity-aliases';
import { rarityDensity } from '../shared/rarity';
import { scoreAssetPath, rarityAssetPath, SCORING_VERSION } from '../shared/scoring-assets';
import { catalogSources, readCatalogSource } from './catalog-sources';
import { rankPopularity, rarityPoints } from '../worker/scoring';
import { legacyRankPopularity, legacyRarityPoints } from './legacy-scoring';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const plan = JSON.parse(readFileSync('scripts/category-plan.json', 'utf8'));
const coverage: any[] = [],
  samples: any[] = [],
  assets: any[] = [];
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function immutable(path: string, bytes: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    if (!readFileSync(path).equals(bytes))
      throw Error(`Immutable asset changed: ${path}; bump the scoring version`);
  } else writeFileSync(path, bytes);
  assets.push({ path: path.slice('public'.length), bytes: bytes.length, sha256: sha(bytes) });
}
function encode({ median, percentiles }: { median: number; percentiles: (number | null)[] }) {
  const data = Buffer.alloc((percentiles.length + 1) * 2);
  data.writeUInt16LE(median, 0);
  percentiles.forEach((p, i) =>
    data.writeUInt16LE(p === null ? 65535 : Math.round(p * 10000), (i + 1) * 2),
  );
  return data;
}
for (const source of catalogSources()) {
  const c = readCatalogSource(source);
  const path = `public/catalog/${c.slug}/manifest.json`;
  if (!existsSync(path)) throw Error('Missing catalog: ' + c.slug);
  const meta = source.retained
    ? { version: source.version, count: c.answers.length }
    : JSON.parse(readFileSync(path, 'utf8'));
  if (meta.count !== c.answers.length) throw Error('Catalog ordinal mismatch: ' + c.slug);
  const poolLimit = plan.rarityPoolSizes[c.slug];
  if (!Number.isSafeInteger(poolLimit) || poolLimit < 1)
    throw Error('Missing/invalid rarityPoolSizes: ' + c.slug);
  const resolved = resolvePopularity(c.answers);
  const values = resolved.readings.map((p) => (measured(p) ? p!.total! / p!.days : null));
  const ranked = rankPopularity(values, poolLimit);
  const before = legacyRankPopularity(values);
  const measuredOrder = values
    .map((value, index) => ({ value, index }))
    .filter((v): v is { value: number; index: number } => v.value !== null)
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const poolSize = Math.min(poolLimit, measuredOrder.length);
  coverage.push({
    category: c.slug,
    retained: !!source.retained,
    catalogVersion: meta.version,
    total: c.answers.length,
    measured: measuredOrder.length,
    poolLimit,
    poolSize,
    median: ranked.median,
    missingBefore: resolved.before,
    missingAfter: resolved.after,
    mappedAnswers: resolved.mappings.length,
    examples: resolved.mappings.slice(0, 5),
  });
  immutable(
    `public/catalog/${c.slug}/${meta.version}/scores-v1.bin`,
    encode(
      legacyRankPopularity(
        c.answers.map((a: any) =>
          measured(a.pageviews) ? a.pageviews.total / a.pageviews.days : null,
        ),
      ),
    ),
  );
  immutable(`public/catalog/${c.slug}/${meta.version}/scores-v2.bin`, encode(before));
  // Preserve the pre-R19E curve too. The current UI uses the analytic R19 bell;
  // versioned empirical curves remain available to consumers and rollback clients.
  if (!source.retained)
    immutable(
      `public/rarity/${c.slug}.json`,
      Buffer.from(JSON.stringify(rarityDensity(before.percentiles))),
    );
  immutable('public' + scoreAssetPath(c.slug, meta.version), encode(ranked));
  // Use precisely the quantized percentiles the Worker reads from the binary.
  const percentiles = ranked.percentiles.map((p) =>
    p === null ? null : Math.round(p * 10000) / 10000,
  );
  const curve = Buffer.from(JSON.stringify(rarityDensity(percentiles)));
  if (curve.length >= 2048) throw Error('Rarity asset exceeds 2 KB');
  immutable('public' + rarityAssetPath(c.slug, meta.version), curve);
  const selected = new Set<number>();
  if (c.slug === 'animals') {
    for (const name of [
      'Dog',
      'Cat',
      'Lion',
      'Camel',
      'Deer',
      'Chameleon',
      'Okapi',
      'Axolotl',
      'Quokka',
      'Sarcastic fringehead',
      'Blobfish',
    ]) {
      const i = c.answers.findIndex((a: any) => a.display.toLowerCase() === name.toLowerCase());
      if (i < 0) throw Error('Missing sanity answer: ' + name);
      selected.add(i);
    }
  }
  // Include reference-pool edges, the obscure tail and an honest missing reading.
  for (const position of [0, poolSize - 1, poolSize, measuredOrder.length - 1])
    if (measuredOrder[position]) selected.add(measuredOrder[position].index);
  const missing = values.findIndex((v) => v === null);
  if (missing >= 0) selected.add(missing);
  const remaining = 30 - selected.size;
  for (let i = 1; i <= remaining; i++) {
    let position = Math.floor((i / (remaining + 1)) * Math.max(0, poolSize - 1));
    while (position < measuredOrder.length && selected.has(measuredOrder[position].index))
      position++;
    if (measuredOrder[position]) selected.add(measuredOrder[position].index);
  }
  if (selected.size !== Math.min(30, c.answers.length))
    throw Error('Sample count mismatch: ' + c.slug);
  samples.push({
    category: c.slug,
    catalogVersion: meta.version,
    retained: !!source.retained,
    poolSize,
    medianBefore: before.median,
    medianAfter: ranked.median,
    rows: [...selected]
      .sort((a, b) => (values[b] ?? -1) - (values[a] ?? -1))
      .map((index) => ({
        answer: c.answers[index].display,
        ordinal: index,
        meanDailyViews: values[index],
        beforePercentile: before.percentiles[index],
        afterPercentile: percentiles[index],
        beforePoints:
          before.percentiles[index] === null
            ? before.median
            : legacyRarityPoints(before.percentiles[index]!),
        afterPoints:
          percentiles[index] === null ? ranked.median : rarityPoints(percentiles[index]!),
      })),
  });
}
mkdirSync('review/round19e', { recursive: true });
writeFileSync('review/round19e/popularity-coverage.json', JSON.stringify(coverage, null, 2) + '\n');
writeFileSync(
  'review/round19e/scoring-assets.json',
  JSON.stringify({ version: SCORING_VERSION, assets }, null, 2) + '\n',
);
writeFileSync('review/round19e/samples.json', JSON.stringify(samples, null, 2) + '\n');
const pct = (p: number | null) => (p === null ? 'unmeasured' : (100 * p).toFixed(2) + '%');
writeFileSync(
  'review/round19e/SAMPLES.md',
  '# R19E before/after — 30 answers per category\n\nPercentile 0 is most familiar; 100% is rarest. Views are retained mean daily Wikipedia pageviews. No readings or target scores were invented. Missing readings retain no percentile and use the category reference-pool median. Before uses the exact R19C scale (10–100); after uses the requested 10–110 scale.\n\n' +
    samples
      .map(
        (c) =>
          `## ${c.category}${c.retained ? ' (retained scheduled catalog ' + c.catalogVersion + ')' : ''}\n\nPool: ${c.poolSize}. Missing-data fallback: ${c.medianBefore} → ${c.medianAfter} points.\n\n| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |\n|---|---:|---:|---:|---:|---:|\n` +
          c.rows
            .map(
              (r: any) =>
                `| ${r.answer.replaceAll('|', '\\|')} | ${r.meanDailyViews === null ? 'unknown' : r.meanDailyViews.toFixed(2)} | ${pct(r.beforePercentile)} | ${pct(r.afterPercentile)} | ${r.beforePoints} | ${r.afterPoints} |`,
            )
            .join('\n'),
      )
      .join('\n\n') +
    '\n',
);
console.log(
  `Built ${coverage.length} catalog versions; ${assets.length} new/retained assets; samples in review/round19e/SAMPLES.md`,
);
