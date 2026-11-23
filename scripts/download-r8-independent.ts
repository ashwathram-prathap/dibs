import './test-traffic';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const sources = JSON.parse(readFileSync('scripts/r8-independent-sources.json', 'utf8'));
const folder = '.category-cache/r8/independent-pages';
mkdirSync(folder, { recursive: true });
const report: any = {};
for (const [slug, titles] of Object.entries(sources) as [string, string[]][]) {
  report[slug] = [];
  for (const [index, title] of titles.entries()) {
    const path = `${folder}/${slug}-${index}.json`;
    if (existsSync(path)) {
      report[slug].push({ title, cached: true });
      continue;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(
          'https://en.wikipedia.org/w/api.php?' +
            new URLSearchParams({
              action: 'parse',
              page: title,
              format: 'json',
              prop: 'text',
              redirects: '1',
            }),
          {
            headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
            signal: AbortSignal.timeout(45000),
          },
        );
        if (r.status === 429)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(60000, Number(r.headers.get('retry-after') || 60) * 1000)),
          );
        if (!r.ok) throw Error('HTTP ' + r.status);
        const d: any = await r.json();
        if (d.error || !d.parse?.text?.['*']) throw Error(d.error?.info || 'No parsed HTML');
        writeFileSync(path, JSON.stringify(d));
        report[slug].push({ title, bytes: JSON.stringify(d).length });
        console.log(slug, title);
        break;
      } catch (e) {
        if (attempt === 2) report[slug].push({ title, error: String(e) });
        else await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  writeFileSync(
    'review/round8/independent-source-downloads.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
