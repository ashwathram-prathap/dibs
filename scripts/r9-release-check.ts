import './test-traffic';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const practice = process.argv.includes('--practice'),
  origin = practice ? 'https://practice.dibs-7hz.pages.dev' : 'https://dibs.here';
const token = readFileSync(practice ? '.dev.vars.staging' : '.dev.vars', 'utf8').match(
  /^ADMIN_TOKEN=(.+)$/m,
)![1];
const checks: any[] = [];
for (const path of [
  '/',
  '/about',
  '/archive',
  '/admin/live',
  '/manifest.webmanifest',
  '/reminder.ics',
  '/theme.js',
]) {
  const r = await fetch(origin + path);
  assert.equal(r.status, 200, path);
  checks.push({ path, status: r.status });
}
for (const path of ['/api/admin/live', '/api/admin/registers']) {
  const no = await fetch(origin + path);
  assert.notEqual(no.status, 200);
  const r = await fetch(origin + path, { headers: { authorization: 'Bearer ' + token, origin } });
  assert.equal(r.status, 200, path);
  const d: any = await r.json();
  if (path.endsWith('live')) {
    assert.ok(d.limits.requests);
    assert.ok(Array.isArray(d.feedback));
  }
  checks.push({ path, authenticated: r.status, anonymous: no.status });
}
const boot = await fetch(origin + '/api/bootstrap', { headers: { origin } }),
  data: any = await boot.json();
assert.equal(boot.status, 200);
assert.ok(boot.headers.get('set-cookie'));
assert.equal(!!data.today.practice, practice);
if (data.today.category) assert.ok(!data.today.category.source_json);
checks.push({ path: '/api/bootstrap', status: 200, practice: !!data.today.practice });
writeFileSync(
  'review/round9/' + (practice ? 'practice' : 'production') + '-part-a-check.json',
  JSON.stringify({ at: new Date().toISOString(), origin, checks }, null, 2),
);
console.log(origin, checks.length + ' read-only release checks passed');
