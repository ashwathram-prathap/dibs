import './test-traffic';
import { readCategory } from './category-file';
import { readFileSync, writeFileSync } from 'node:fs';
const origin = 'https://dibs.here';
const token = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
const slugs = process.argv
  .find((arg) => arg.startsWith('--slugs='))
  ?.slice(8)
  .split(',');
if (!slugs?.length) throw Error('Specify the existing launch register slugs');
const expected = JSON.parse(readFileSync('review/round8/production-registers-before.json', 'utf8'));
const coverage = JSON.parse(readFileSync('review/coverage/results.json', 'utf8'));
async function api(path: string, body?: unknown) {
  const response = await fetch(origin + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { origin, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data: any = await response.json();
  if (!response.ok) throw Error('Admin request failed: ' + response.status);
  return data;
}
function verifySchedule(rows: any[]) {
  if (rows.length !== expected.length) throw Error('Register inventory changed');
  for (const row of expected) {
    const current = rows.find((r) => r.id === row.id);
    if (!current || ['date', 'status', 'drop_at'].some((key) => current[key] !== row[key]))
      throw Error('Schedule changed: ' + row.id);
  }
}
const before = (await api('/admin/registers')).categories;
verifySchedule(before);
const checks = [];
for (const slug of slugs) {
  const current = before.find((r: any) => r.id === slug);
  const gate = coverage.find((r: any) => r.slug === slug);
  if (!current || !current.date || !gate?.ready) throw Error('Unverified launch register: ' + slug);
  const category = readCategory('categories/' + slug + '.json');
  const manifest = JSON.parse(readFileSync('public/catalog/' + slug + '/manifest.json', 'utf8'));
  if (JSON.parse(current.source_json || '{}').staticCatalog?.version === manifest.version) {
    checks.push({ slug, version: manifest.version, unchanged: true });
    continue;
  }
  checks.push({
    slug,
    version: manifest.version,
    ...(await api('/admin/static-catalog', {
      id: current.id,
      slug,
      name: category.name,
      manifest,
      coverage: gate,
    })),
  });
}
verifySchedule((await api('/admin/registers')).categories);
writeFileSync(
  'review/round8/production-launch-activation.json',
  JSON.stringify({ at: new Date().toISOString(), checks, scheduleUnchanged: true }, null, 2) + '\n',
);
console.log(checks);
