import { readCategory } from './category-file';
import { rankPopularity } from '../worker/scoring';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
for (const name of readdirSync('categories').filter((n) => n.endsWith('.json'))) {
  const c = readCategory('categories/' + name);
  const path = `public/catalog/${c.slug}/manifest.json`;
  if (!existsSync(path)) continue;
  const meta = JSON.parse(readFileSync(path, 'utf8'));
  const { median, percentiles } = rankPopularity(
    c.answers.map((a: any) =>
      a.pageviews?.days > 0 && typeof a.pageviews.total === 'number'
        ? a.pageviews.total / a.pageviews.days
        : null,
    ),
  );
  const data = Buffer.alloc((percentiles.length + 1) * 2);
  data.writeUInt16LE(median, 0);
  percentiles.forEach((p, i) =>
    data.writeUInt16LE(p === null ? 65535 : Math.round(p * 10000), (i + 1) * 2),
  );
  writeFileSync(`public/catalog/${c.slug}/${meta.version}/scores-v1.bin`, data);
}
console.log('Category percentile scoring assets ready');
