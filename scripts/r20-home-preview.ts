// Public image only: no identity, draw, or player request.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const origin = process.argv[2];
assert.ok(['https://dibs.here', 'https://practice.dibs-7hz.pages.dev'].includes(origin));
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const expected = digest(readFileSync('review/round20/og/light-home.jpg'));
const deadline = Date.now() + (process.argv.includes('--wait') ? 360000 : 0);
let proof: any;
do {
  const r = await fetch(origin + '/api/og?v=20', {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(r.ok && !r.headers.get('set-cookie'));
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
  const bytes = new Uint8Array(await r.arrayBuffer());
  const actual = digest(bytes);
  proof = {
    at: new Date().toISOString(),
    origin,
    bytes: bytes.length,
    expected,
    actual,
    passed: actual === expected && bytes.length < 300000,
  };
  if (proof.passed || Date.now() >= deadline) break;
  console.log('Waiting for the deferred DO code update');
  await new Promise((resolve) => setTimeout(resolve, 30000));
} while (true);
writeFileSync(
  'review/round20/' +
    (origin.includes('practice') ? 'practice' : 'production') +
    '-home-preview.json',
  JSON.stringify(proof, null, 2),
);
assert.ok(proof.passed, 'Home image is not the verified current render');
console.log(proof);
