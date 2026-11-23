import './test-traffic';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'https://practice.dibs-7hz.pages.dev';
assert.ok(['https://dibs.here', 'https://practice.dibs-7hz.pages.dev'].includes(origin));
const categories = readdirSync('dist/catalog', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const rows: any[] = [];
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
for (let offset = 0; offset < categories.length; offset += 4) {
  const batch = await Promise.all(
    categories.slice(offset, offset + 4).map(async (category) => {
      const base = '/catalog/' + category;
      const meta = JSON.parse(readFileSync('dist' + base + '/manifest.json', 'utf8'));
      const response = await fetch(origin + base + '/manifest.json', {
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(response.status, 200, category + ' manifest unavailable');
      const remote: any = await response.json();
      assert.equal(remote.version, meta.version, category + ' manifest version differs');
      const scores = await Promise.all(
        ['v1', 'v2'].map(async (version) => {
          const path = base + '/' + meta.version + '/scores-' + version + '.bin';
          const local = readFileSync('dist' + path);
          const result = await fetch(origin + path, { signal: AbortSignal.timeout(15000) });
          const bytes = Buffer.from(await result.arrayBuffer());
          return {
            version,
            status: result.status,
            bytes: bytes.length,
            sha256: sha(bytes),
            matches: result.status === 200 && sha(bytes) === sha(local),
          };
        }),
      );
      return { category, catalogVersion: meta.version, scores };
    }),
  );
  rows.push(...batch);
}
const report = {
  at: new Date().toISOString(),
  origin,
  passed:
    rows.length === 33 && rows.every((row) => row.scores.every((score: any) => score.matches)),
  categories: rows.length,
  scoringFiles: rows.length * 2,
  rows,
};
writeFileSync(
  'review/round19c/' +
    (origin.includes('practice') ? 'practice' : 'production') +
    '-score-assets.json',
  JSON.stringify(report, null, 2),
);
assert.ok(report.passed, 'Deployed scoring assets differ from the release build');
console.log({
  passed: report.passed,
  categories: report.categories,
  scoringFiles: report.scoringFiles,
});
