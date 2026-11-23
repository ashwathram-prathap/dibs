import './test-traffic';
import { awaitCoherentBuild } from './build-readiness';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const origin = process.argv[2] || 'https://practice.dibs-7hz.pages.dev';
assert.ok(['https://dibs.here', 'https://practice.dibs-7hz.pages.dev'].includes(origin));
const build = process.argv[3] || 'dist';
const fresh = process.argv.includes('--fresh');
const builtHtml = readFileSync(build + '/index.html', 'utf8');
const styleHashes = (html: string) =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) =>
    createHash('sha256').update(m[1]).digest('hex'),
  );
const expectedStyles = styleHashes(builtHtml);
assert.ok(expectedStyles.length > 0, 'Expected the inline production styles');
const expected = (builtHtml.match(/src="(\/assets\/index-[^"]+\.js)"/) || [])[1];
assert.ok(expected);
const paths = readdirSync(build + '/assets').filter((p) => /\.(js|css)$/.test(p));
const observations: any[] = [];
const destination =
  'review/round19f/' +
  (origin.includes('practice') ? 'practice' : 'production') +
  (fresh ? '-fresh' : '') +
  '-asset-integrity.json';
const result = await awaitCoherentBuild(async () => {
  assert.ok(Date.now() < Date.parse('2026-11-24T00:30:00Z'), 'R19F deadline reached');
  const query = fresh ? '&r19f-readiness=' + Date.now() : '';
  const response = await fetch(origin + '/?no-analytics=1' + query, {
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  const html = await response.text();
  const actual = (html.match(/src="(\/assets\/index-[^"]+\.js)"/) || [])[1];
  const rows: any[] = [];
  const stylesMatch = JSON.stringify(styleHashes(html)) === JSON.stringify(expectedStyles);
  const htmlMatches =
    response.status === 200 && actual === expected && stylesMatch && !html.includes('cf-chl-');
  if (htmlMatches)
    for (const path of paths) {
      const r = await fetch(origin + '/assets/' + path + (fresh ? '?' + query.slice(1) : ''), {
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
        matches: sha(bytes) === sha(readFileSync(build + '/assets/' + path)),
      });
    }
  const passed =
    htmlMatches &&
    rows.length === paths.length &&
    rows.every(
      (r) =>
        r.status === 200 &&
        r.type?.includes(r.path.endsWith('.css') ? 'text/css' : 'javascript') &&
        r.matches,
    );
  observations.push({
    at: new Date().toISOString(),
    status: response.status,
    actual: actual || null,
    expected,
    stylesMatch,
    htmlMatches,
    passed,
  });
  const report = {
    at: new Date().toISOString(),
    passed,
    entry: expected,
    inlineStyleHashes: expectedStyles,
    rows,
    observations,
  };
  writeFileSync(destination, JSON.stringify(report, null, 2));
  return report;
});
console.log({ passed: result.passed, chunks: result.rows.length, attempts: observations.length });
