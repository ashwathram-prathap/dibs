import './test-traffic';
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
const rows = [];
const response = await fetch(origin + '/?no-analytics=1', {
  redirect: 'manual',
  cache: 'no-store',
});
const html = await response.text();
assert.equal(response.status, 200);
assert.ok(html.includes(expected), 'HTML must reference this build');
for (const path of paths) {
  const r = await fetch(origin + '/assets/' + path, { redirect: 'manual', cache: 'no-store' });
  const bytes = Buffer.from(await r.arrayBuffer());
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const matches = sha(bytes) === sha(readFileSync('dist/assets/' + path));
  rows.push({
    path,
    status: r.status,
    type: r.headers.get('content-type'),
    bytes: bytes.length,
    matches,
  });
}
const passed = rows.every((r) => r.status === 200 && r.type?.includes('javascript') && r.matches);
writeFileSync(
  'review/round19b/' +
    (origin.includes('practice') ? 'practice' : 'production') +
    '-asset-integrity.json',
  JSON.stringify({ at: new Date().toISOString(), passed, entry: expected, rows }, null, 2),
);
assert.ok(passed, 'Deployed JavaScript must match the built artifacts');
console.log({ passed, chunks: rows.length });
