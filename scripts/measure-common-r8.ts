import './test-traffic';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const path = '.category-cache/r8/pageviews.json';
const cache = JSON.parse(readFileSync(path, 'utf8'));
const words = [
  ...new Set(
    readdirSync('review/coverage')
      .filter((f) => f.endsWith('.txt'))
      .flatMap((f) =>
        readFileSync('review/coverage/' + f, 'utf8')
          .trim()
          .split('\n'),
      )
      .map((t) => t[0].toUpperCase() + t.slice(1)),
  ),
];
let failures = 0;
for (let i = 0; i < words.length; i += 30) {
  const titles = words.slice(i, i + 30);
  const r = await fetch(
    'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        format: 'json',
        prop: 'pageviews|pageprops',
        pvipdays: '30',
        titles: titles.join('|'),
        redirects: '1',
      }),
    { headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' } },
  );
  if (!r.ok) {
    if (++failures >= 3) {
      console.log('BLOCKED after three attempts:', r.status);
      break;
    }
    console.log('retry common', r.status);
    i -= 30;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(10000, Number(r.headers.get('retry-after') || 60) * 1000)),
    );
    continue;
  }
  const d: any = await r.json();
  const redirect = new Map(
    [...(d.query?.normalized || []), ...(d.query?.redirects || [])].map((x) => [x.from, x.to]),
  );
  for (const t of titles) {
    let key: any = t;
    for (let n = 0; n < 5 && redirect.has(key); n++) key = redirect.get(key);
    const p: any = Object.values(d.query?.pages || {}).find((p: any) => p.title === key);
    if (!p || p.pageprops?.disambiguation !== undefined) continue;
    const points = Object.entries(p.pageviews || {}).filter(([, v]) => typeof v === 'number');
    if (points.length)
      cache[t] = {
        total: points.reduce((sum, [, v]) => sum + (v as number), 0),
        days: points.length,
        start: points[0][0],
        end: points.at(-1)![0],
        title: p.title,
        status: 'measured',
      };
  }
  writeFileSync(path, JSON.stringify(cache));
  console.log('common', i + titles.length, '/', words.length);
  await new Promise((r) => setTimeout(r, 600));
}
