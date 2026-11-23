import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SCORING_VERSION } from '../shared/scoring-assets';
const stage = process.argv[2];
assert.ok(stage === 'practice' || stage === 'production');
const origin = stage === 'practice' ? 'https://practice.dibs-7hz.pages.dev' : 'https://dibs.here';
const vars = readFileSync(stage === 'practice' ? '.dev.vars.staging' : '.dev.vars', 'utf8');
const token = vars
  .match(/^ADMIN_TOKEN=(.+)$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
const catalogs = JSON.parse(readFileSync('review/round19e/samples.json', 'utf8'));
const inventory = JSON.parse(
  readFileSync(`.tmp/r19e/${stage}-state-before.json`, 'utf8'),
).scheduled;
const selected =
  stage === 'practice' ? inventory.filter((r: any) => r.id === 'practice') : inventory;
const rows: any[] = [];
for (const category of selected) {
  const samples = catalogs.find(
    (c: any) =>
      c.category === category.staticCatalog.slug &&
      c.catalogVersion === category.staticCatalog.version,
  );
  assert.ok(samples, 'Missing sample table for ' + category.id);
  // Small batches also stay inside the API's existing query-length ceiling.
  for (let offset = 0; offset < samples.rows.length; offset += 4) {
    const batch = samples.rows.slice(offset, offset + 4);
    const query = new URLSearchParams({ id: category.id });
    for (const sample of batch) query.append('q', sample.answer);
    assert.ok(query.toString().length <= 499, 'Diagnostic query too long');
    let result: any;
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await fetch(origin + '/api/admin/scoring?' + query, {
        headers: { authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) {
        result = await response.json();
        if (result.scoringVersion === SCORING_VERSION) break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    assert.equal(
      result?.scoringVersion,
      SCORING_VERSION,
      'Worker scoring version failed to propagate',
    );
    assert.equal(result.rows.length, batch.length);
    for (const [i, row] of result.rows.entries()) {
      assert.equal(row.found, true, row.answer + ' lookup failed');
      assert.equal(row.basePoints, batch[i].afterPoints, row.answer + ' points mismatch');
      assert.equal(row.percentile, batch[i].afterPercentile, row.answer + ' percentile mismatch');
      rows.push({ category: category.id, ...row });
    }
  }
}
writeFileSync(
  `review/round19e/${stage}-worker-scores.json`,
  JSON.stringify(
    { at: new Date().toISOString(), origin, passed: true, version: SCORING_VERSION, rows },
    null,
    2,
  ),
);
console.log({ origin, passed: true, samples: rows.length });
