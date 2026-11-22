import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalize } from '../worker/domain';
import { shardFor, type CatalogRow } from '../shared/catalog';
rmSync('public/catalog', { recursive: true, force: true });
mkdirSync('public/catalog', { recursive: true });
for (const f of readdirSync('categories').filter((f) => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync('categories/' + f, 'utf8'));
  if (c.provenance?.identityPolicy !== 'complete-reference-v2') continue;
  const rows: CatalogRow[] = c.answers.map((a: any, i: number) => [i, a.display, a.obscurity]);
  const version = createHash('sha256').update(JSON.stringify(c.answers)).digest('hex').slice(0, 16);
  const dir = `public/catalog/${c.slug}/${version}`;
  mkdirSync(dir, { recursive: true });
  const shards: Record<string, CatalogRow>[] = Array.from({ length: 256 }, () => ({}));
  for (const [i, a] of c.answers.entries())
    for (const key of new Set<string>([normalize(a.display), ...a.aliases.map(normalize)])) {
      if (shards[shardFor(key)][key]) throw Error('Alias collision ' + c.slug + ': ' + key);
      shards[shardFor(key)][key] = rows[i];
    }
  for (let i = 0; i < 256; i++) writeFileSync(`${dir}/keys-${i}.json`, JSON.stringify(shards[i]));
  for (let i = 0; i < rows.length; i += 256)
    writeFileSync(
      `${dir}/rows-${Math.floor(i / 256)}.json`,
      JSON.stringify(rows.slice(i, i + 256)),
    );
  // Typo candidates are a modest popularity-ranked common-name list, fetched only on a miss.
  writeFileSync(
    `${dir}/typos.json`,
    JSON.stringify(rows.filter(([i]) => c.answers[i].pageviews.days > 0).slice(0, 3000)),
  );
  const manifest = {
    v: 2,
    slug: c.slug,
    version,
    count: rows.length,
    house: rows.slice(0, 10),
    scope: c.provenance.scopeNote,
  };
  writeFileSync(`public/catalog/${c.slug}/manifest.json`, JSON.stringify(manifest));
}
