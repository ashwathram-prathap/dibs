import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
const reportPath = 'review/round8/pageview-gaps.json';
const decisionsPath = 'scripts/r8-confirmed-pageview-gaps.json';
const report: any[] = JSON.parse(readFileSync(reportPath, 'utf8'));
const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8'));
for (const title of process.argv.slice(2)) {
  const sources = [
    ...['30', '60'].map(
      (pvipdays) =>
        'https://en.wikipedia.org/w/api.php?' +
        new URLSearchParams({
          action: 'query',
          format: 'json',
          prop: 'pageviews|info',
          pvipdays,
          titles: title,
          redirects: '1',
        }),
    ),
    'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/' +
      encodeURIComponent(title) +
      '/daily/2026102300/2026112000',
  ];
  const attempts: any[] = [];
  for (const url of sources) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
        signal: AbortSignal.timeout(30000),
      });
      attempts.push({ url, status: response.status, data: await response.json() });
    } catch (error) {
      attempts.push({ url, error: String(error) });
    }
  }
  const confirmed =
    attempts
      .slice(0, 2)
      .every(
        (r) =>
          r.status === 200 &&
          Object.values(r.data?.query?.pages || {}).some(
            (p: any) =>
              p.pageid > 0 &&
              p.title === title &&
              p.pageviews &&
              Object.values(p.pageviews).every((v) => v === null),
          ),
      ) &&
    attempts[2].status === 404 &&
    /date\(s\).*valid.*not have data/.test(attempts[2].data?.detail || '');
  const entry = { title, checkedAt: new Date().toISOString(), confirmed, attempts };
  const old = report.findIndex((r) => r.title === title);
  if (old < 0) report.push(entry);
  else report[old] = entry;
  if (confirmed && !decisions.titles.includes(title)) decisions.titles.push(title);
  console.log(
    title,
    confirmed
      ? 'confirmed unavailable; remains an accepted answer'
      : 'requires further investigation',
  );
}
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
writeFileSync(decisionsPath, JSON.stringify(decisions, null, 2) + '\n');
