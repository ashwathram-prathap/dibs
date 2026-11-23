import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
const samples = readFileSync('.tmp/r8-bulk-samples.tsv', 'utf8')
  .trim()
  .split('\n')
  .map((line) => line.split('\t'));
const checks: any[] = [];
await new Promise((r) => setTimeout(r, 60000));
for (const [title, total] of samples) {
  const url =
    'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/' +
    encodeURIComponent(title) +
    '/monthly/2026100100/2026103100';
  let response: Response | undefined;
  let data: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url, {
      headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 429) {
      await new Promise((r) =>
        setTimeout(r, Math.max(60000, Number(response!.headers.get('retry-after') || 60) * 1000)),
      );
      continue;
    }
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'Non-JSON response' };
    }
    break;
  }
  const apiViews = data?.items?.reduce((n: number, r: any) => n + r.views, 0);
  checks.push({
    title,
    dumpViews: Number(total),
    apiViews,
    status: response?.status,
    passed: response?.ok && apiViews === Number(total),
    url,
  });
  await new Promise((r) => setTimeout(r, 2000));
}
writeFileSync(
  'review/round8/bulk-pageviews-api-comparison.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
);
console.log(
  checks.map(({ title, dumpViews, apiViews, passed }) => ({ title, dumpViews, apiViews, passed })),
);
if (checks.some((r) => !r.passed)) throw Error('Monthly dump/API comparison failed');
