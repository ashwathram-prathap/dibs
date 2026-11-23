import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
const path = '.category-cache/r8/pageviews.json',
  cache = JSON.parse(readFileSync(path, 'utf8'));
const overrides = JSON.parse(readFileSync('scripts/r8-page-titles.json', 'utf8'));
const titles = [
  ...new Set([
    ...Object.values(cache)
      .filter((v: any) => v.days > 0)
      .sort((a: any, b: any) => b.total / b.days - a.total / a.days)
      .map((v: any) => v.title)
      .filter(Boolean),
    ...Object.values(overrides).flatMap((o: any) => Object.values(o)),
  ]),
];
const metaPath = '.category-cache/r8/page-metadata.json';
let meta: any = {};
try {
  meta = JSON.parse(readFileSync(metaPath, 'utf8'));
} catch {}
let failures = 0;
for (let i = 0; i < titles.length; i += 40) {
  const batch = titles.slice(i, i + 40).filter((t) => !meta[t]);
  if (!batch.length) continue;
  const r = await fetch(
    'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        format: 'json',
        prop: 'pageprops|pageviews',
        pvipdays: '30',
        titles: batch.join('|'),
        redirects: '1',
      }),
    { headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' } },
  );
  if (!r.ok) {
    if (++failures >= 3) {
      console.log('Scope metadata blocked:', r.status);
      break;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(10000, Number(r.headers.get('retry-after') || 60) * 1000)),
    );
    i -= 40;
    continue;
  }
  const d: any = await r.json();
  const redirect = new Map(
    [...(d.query?.normalized || []), ...(d.query?.redirects || [])].map((x) => [x.from, x.to]),
  );
  for (const t of batch) {
    let key: any = t;
    for (let n = 0; n < 5 && redirect.has(key); n++) key = redirect.get(key);
    const p: any = Object.values(d.query?.pages || {}).find((p: any) => p.title === key);
    meta[t] = {
      title: p?.title,
      description: p?.pageprops?.['wikibase-shortdesc'] || '',
      disambiguation: p?.pageprops?.disambiguation !== undefined,
    };
    const points = Object.entries(p?.pageviews || {}).filter(([, v]) => typeof v === 'number');
    if (points.length && !meta[t].disambiguation)
      cache[t] = {
        total: points.reduce((s, [, v]) => s + (v as number), 0),
        days: points.length,
        start: points[0][0],
        end: points.at(-1)![0],
        title: p.title,
        status: 'measured',
      };
  }
  writeFileSync(metaPath, JSON.stringify(meta));
  writeFileSync(path, JSON.stringify(cache));
  console.log('scope', i + batch.length, '/', titles.length);
  await new Promise((r) => setTimeout(r, 600));
}
