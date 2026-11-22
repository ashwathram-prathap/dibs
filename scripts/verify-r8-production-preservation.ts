import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const beforePath = '.tmp/r8-final-production-before.json';
const verify = process.argv.includes('--verify-after');
const token = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
const response = await fetch('https://dibs.here/api/admin/registers', {
  headers: { authorization: 'Bearer ' + token },
});
assert.ok(response.ok, 'Read-only register inventory failed');
const registers: any[] = ((await response.json()) as any).categories;
const output = execFileSync(
  './node_modules/.bin/wrangler',
  [
    'd1',
    'execute',
    'dibs-db',
    '--remote',
    '-c',
    'worker/wrangler.jsonc',
    '--json',
    '--command',
    'SELECT * FROM users ORDER BY id; SELECT * FROM claims ORDER BY id; SELECT * FROM strikes ORDER BY category_id,user_id,seq;',
  ],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
);
const tables = JSON.parse(output).map((r: any) => r.results);
assert.equal(tables.length, 3);
assert.ok(tables.every(Array.isArray));
const snapshot = { at: new Date().toISOString(), tables, registers };
mkdirSync('.tmp', { recursive: true });
if (!verify) {
  writeFileSync(beforePath, JSON.stringify(snapshot), { mode: 0o600 });
  console.log('Captured private player-row and schedule baseline');
} else {
  const before = JSON.parse(readFileSync(beforePath, 'utf8'));
  writeFileSync('.tmp/r8-final-production-after.json', JSON.stringify(snapshot), { mode: 0o600 });
  const hash = (value: any) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.equal(
    hash(tables),
    hash(before.tables),
    'Player rows changed; inspect the private before/after snapshots before claiming preservation',
  );
  const schedule = (rows: any[]) =>
    rows
      .map((r) => ({ id: r.id, date: r.date, status: r.status, drop_at: r.drop_at }))
      .sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(schedule(registers), schedule(before.registers), 'Schedule changed');
  const counts = (rows: any[]) => ({
    users: rows[0].length,
    claims: rows[1].length,
    strikes: rows[2].length,
  });
  const report = {
    at: snapshot.at,
    beforeAt: before.at,
    before: counts(before.tables),
    after: counts(tables),
    existingPlayerRowsUnchanged: true,
    scheduleUnchanged: true,
    registers: registers
      .filter((r) => r.date)
      .map((r) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        drop_at: r.drop_at,
        static_count: JSON.parse(r.source_json || '{}').staticCatalog?.count,
        version: JSON.parse(r.source_json || '{}').staticCatalog?.version,
      })),
  };
  writeFileSync(
    'review/round8/production-preservation.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  writeFileSync(
    'review/round8/production-registers-after.json',
    JSON.stringify(
      registers.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        date: r.date,
        drop_at: r.drop_at,
        total: r.total_registrable,
        staticCatalog: JSON.parse(r.source_json || '{}').staticCatalog,
      })),
      null,
      2,
    ) + '\n',
  );
  unlinkSync(beforePath);
  unlinkSync('.tmp/r8-final-production-after.json');
  console.log('Verified byte-equivalent player rows and unchanged schedule', counts(tables));
}
