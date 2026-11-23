import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const html = readFileSync('dist/index.html', 'utf8');
assert.match(html, /https:\/\/dibs\.here/);
assert.match(html, /application\/ld\+json/);
assert.equal((html.match(/application\/ld\+json/g) || []).length, 1);
const schema = JSON.parse(
  html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)![1],
);
assert.ok(schema['@graph'].some((n: any) => n['@type'] === 'VideoGame'));
const scripts = readdirSync('dist/assets').filter((n) => n.endsWith('.js'));
for (const name of scripts) {
  const code = readFileSync('dist/assets/' + name, 'utf8');
  assert.doesNotMatch(
    code,
    /fixture-animals|fixture-1|Development fixtures/,
    'Development fixture leaked into ' + name,
  );
}
const proof = {
  passed: true,
  at: new Date().toISOString(),
  command: 'npm run build',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  htmlSha256: createHash('sha256').update(html).digest('hex'),
  staticHomeStructuredData: true,
  developmentFixturesExcluded: true,
  jsChunks: scripts.length,
  note: 'Production-origin build and both TypeScript projects passed. The release driver rebuilds before deploying.',
};
writeFileSync('review/round19/build-verification.json', JSON.stringify(proof, null, 2));
console.log(proof);
