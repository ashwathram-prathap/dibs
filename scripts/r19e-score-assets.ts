import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const origin = process.argv[2];
assert.ok(['https://dibs.here', 'https://practice.dibs-7hz.pages.dev'].includes(origin));
const { assets } = JSON.parse(readFileSync('review/round19e/scoring-assets.json', 'utf8'));
const rows: any[] = [];
for (let offset = 0; offset < assets.length; offset += 6) {
  assert.ok(Date.now() < Date.parse('2026-11-23T21:30:00Z'), 'R19E deadline reached');
  rows.push(
    ...(await Promise.all(
      assets.slice(offset, offset + 6).map(async (asset: any) => {
        const response = await fetch(origin + asset.path, { signal: AbortSignal.timeout(20000) });
        const bytes = Buffer.from(await response.arrayBuffer());
        const hash = createHash('sha256').update(bytes).digest('hex');
        return {
          ...asset,
          status: response.status,
          passed: response.status === 200 && hash === asset.sha256,
        };
      }),
    )),
  );
}
const passed = rows.length === assets.length && rows.every((r) => r.passed);
writeFileSync(
  `review/round19e/${origin.includes('practice') ? 'practice' : 'production'}-score-assets.json`,
  JSON.stringify(
    { at: new Date().toISOString(), origin, passed, files: rows.length, rows },
    null,
    2,
  ),
);
assert.ok(passed, 'New or rollback assets are missing or changed');
console.log({ origin, passed, files: rows.length });
