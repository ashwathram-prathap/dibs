import './test-traffic';
import { awaitCoherentBuild } from './build-readiness';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const origin = process.argv[2] || 'https://practice.dibs-7hz.pages.dev';
assert.ok(['https://dibs.here', 'https://practice.dibs-7hz.pages.dev'].includes(origin));
const expected = (readFileSync('dist/index.html', 'utf8').match(
  /src="(\/assets\/index-[^"]+\.js)"/,
) || [])[1];
assert.ok(expected);
const paths = readdirSync('dist/assets').filter((p) => p.endsWith('.js'));
const observations: any[] = [];
const destination =
  'review/round19b/' +
  (origin.includes('practice') ? 'practice' : 'production') +
  '-asset-integrity.json';
const result = await awaitCoherentBuild(async () => {
  assert.ok(Date.now() < Date.parse('2026-11-23T20:00:00Z'), 'R19B deadline reached');
  const response = await fetch(origin + '/?no-analytics=1', {
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  const html = await response.text();
  const actual = (html.match(/src="(\/assets\/index-[^"]+\.js)"/) || [])[1];
  const rows: any[] = [];
  const htmlMatches = response.status === 200 && actual === expected && !html.includes('cf-chl-');
  if (htmlMatches)
    for (const path of paths) {
      const r = await fetch(origin + '/assets/' + path, {
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      const bytes = Buffer.from(await r.arrayBuffer());
      const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
      rows.push({
        path,
        status: r.status,
        type: r.headers.get('content-type'),
        bytes: bytes.length,
        matches: sha(bytes) === sha(readFileSync('dist/assets/' + path)),
      });
    }
  const passed =
    htmlMatches &&
    rows.length === paths.length &&
    rows.every((r) => r.status === 200 && r.type?.includes('javascript') && r.matches);
  observations.push({
    at: new Date().toISOString(),
    status: response.status,
    actual: actual || null,
    expected,
    htmlMatches,
    passed,
  });
  const report = { at: new Date().toISOString(), passed, entry: expected, rows, observations };
  writeFileSync(destination, JSON.stringify(report, null, 2));
  return report;
});
console.log({ passed: result.passed, chunks: result.rows.length, attempts: observations.length });
