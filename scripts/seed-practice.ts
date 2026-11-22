// Explicitly targets only the independent staging database and preview service.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { catalogContent, keyContent } from '../shared/catalog-digest';
import { normalize } from '../worker/domain';
const base = 'https://practice.dibs-7hz.pages.dev';
const token = readFileSync('.dev.vars.staging', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
const category = JSON.parse(readFileSync('categories/animals.json', 'utf8'));
const api = async (path: string, body?: any) => {
  const r = await fetch(base + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { origin: base, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = (await r.json()) as any;
  if (!r.ok) throw Error(r.status + ': ' + d.message);
  return d;
};
const registers = (await api('/admin/registers')).categories;
if (!registers.some((r: any) => r.id === 'practice'))
  await api('/admin/category', {
    ...category,
    id: 'practice',
    name: 'PRACTICE',
    slug: 'animals',
    date: null,
  });
const verification = await api('/admin/verify?id=practice');
const expected = createHash('sha256').update(catalogContent(category.answers)).digest('hex');
const keyDigest = createHash('sha256')
  .update(
    keyContent(
      category.answers.flatMap((a: any) =>
        [...new Set([normalize(a.display), ...a.aliases.map(normalize)])].map((match_key) => ({
          match_key,
          display: a.display,
        })),
      ),
    ),
  )
  .digest('hex');
if (verification.digest !== expected || verification.keyDigest !== keyDigest)
  throw Error('Practice upload mismatch');
execFileSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    'dibs-db-staging',
    '--remote',
    '-c',
    'worker/wrangler.staging.jsonc',
    '--command',
    "UPDATE categories SET status='approved',date='2026-11-21',drop_at='2026-11-22T02:00:00Z' WHERE id='practice'",
  ],
  { stdio: 'pipe' },
);
// Clear only transient practice state after seeding; this also invalidates the empty snapshot.
await api('/admin/practice-reset', {});
const data = (await (await fetch(base + '/api/bootstrap')).json()) as any;
if (!data.today.practice || data.today.category?.id !== 'practice' || data.today.open !== 2190)
  throw Error('Practice did not open');
writeFileSync(
  'review/round6/practice-setup.json',
  JSON.stringify(
    {
      url: base,
      verification,
      category: data.today.category,
      open: data.today.open,
      commitment: data.today.specials.commitment,
    },
    null,
    2,
  ),
);
console.log(
  'Practice is open at ' +
    base +
    '; ' +
    data.today.open +
    ' player answers, separate from production.',
);
