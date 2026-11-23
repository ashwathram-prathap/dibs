import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const practice = process.argv.includes('--practice');
const origin = practice ? 'https://practice.dibs-7hz.pages.dev' : 'https://dibs.here';
const vars = readFileSync(practice ? '.dev.vars.staging' : '.dev.vars', 'utf8');
const token = vars
  .match(/^ADMIN_TOKEN=(.+)$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
const result: any[] = [];
for (const table of ['users', 'r17_players', 'r17_files']) {
  let after = '',
    done = false,
    read = 0,
    changed = 0,
    batches = 0;
  while (!done) {
    assert.ok(++batches < 1000, 'Unexpected migration size');
    const response = await fetch(origin + '/api/admin/r19-clean-handles', {
      method: 'POST',
      headers: { origin, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ table, after }),
    });
    assert.ok(response.ok, 'Name cleanup failed: ' + response.status);
    const data: any = await response.json();
    read += data.read;
    changed += data.changed;
    after = data.after;
    done = data.done;
  }
  result.push({ table, read, changed, batches });
}
writeFileSync(
  `review/round19/${practice ? 'practice' : 'production'}-handle-migration.json`,
  JSON.stringify({ at: new Date().toISOString(), passed: true, result }, null, 2),
);
console.log({ practice, result });
