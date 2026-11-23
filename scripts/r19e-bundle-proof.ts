import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const rows = [];
for (const [stage, origin] of [
  ['staging', 'https://practice.dibs-7hz.pages.dev'],
  ['production', 'https://dibs.here'],
]) {
  const code = readFileSync(`worker/.tmp/r19e/${stage}-bundle/index.js`, 'utf8');
  assert.match(code, /r19e-pool-v1/);
  const line = code.split('\n').find((l) => l.startsWith('var PUBLIC_ORIGIN ='))!;
  assert.ok(line.includes(JSON.stringify(origin)), stage + ' PUBLIC_ORIGIN incorrect');
  assert.match(code, /scoreAssetPath\(meta.slug, meta.version\)/);
  rows.push({
    stage,
    origin,
    publicOriginDeclaration: line,
    sha256: createHash('sha256').update(code).digest('hex'),
    passed: true,
  });
}
writeFileSync(
  'review/round19e/worker-bundle-proof.json',
  JSON.stringify({ passed: true, rows }, null, 2),
);
console.log(rows);
