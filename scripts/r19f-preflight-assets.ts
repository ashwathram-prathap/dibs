import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const origin = process.argv[2];
assert.match(origin, /^https:\/\/[a-f0-9]+\.dibs-7hz\.pages\.dev$/);
const paths = readdirSync('dist/assets').filter((p) => /\.(js|css)$/.test(p));
const rows = [];
for (const path of paths) {
  const response = await fetch(origin + '/assets/' + path, { signal: AbortSignal.timeout(15000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const matches = sha(bytes) === sha(readFileSync('dist/assets/' + path));
  rows.push({ path, status: response.status, type: response.headers.get('content-type'), matches });
}
const passed = rows.every(
  (r) =>
    r.status === 200 &&
    r.matches &&
    r.type?.includes(r.path.endsWith('.js') ? 'javascript' : 'text/css'),
);
writeFileSync(
  'review/round19f/production-immutable-assets.json',
  JSON.stringify({ at: new Date().toISOString(), origin, passed, rows }, null, 2),
);
assert.ok(passed, 'Immutable deployment script files failed integrity verification');
console.log({ passed, files: rows.length });
