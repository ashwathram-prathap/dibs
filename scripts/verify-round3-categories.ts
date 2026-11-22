import { readCategory } from './category-file';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { catalogContent, keyContent } from '../shared/catalog-digest';
import { normalize } from '../worker/domain';
const token = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
const headers = { authorization: 'Bearer ' + token };
const base = 'https://dibs.here/api';
const listing = await fetch(base + '/admin/registers', { headers });
if (!listing.ok) throw Error('Remote registry unavailable; stop.');
const categories = ((await listing.json()) as any).categories;
const results = [];
for (const c of categories) {
  const r = await fetch(base + '/admin/verify?id=' + c.id, { headers });
  if (!r.ok) throw Error('Remote verification unavailable; stop.');
  const data = (await r.json()) as any;
  const local = readCategory(`categories/${c.id}.json`);
  const digest = createHash('sha256').update(catalogContent(local.answers)).digest('hex');
  const keys = local.answers.flatMap((a: any) =>
    [...new Set([normalize(a.display), ...a.aliases.map(normalize)])].map((match_key) => ({
      match_key,
      display: a.display,
    })),
  );
  const keyDigest = createHash('sha256').update(keyContent(keys)).digest('hex');
  if (data.digest !== digest || data.keyDigest !== keyDigest || data.keys !== keys.length)
    throw Error(c.id + ': content mismatch');
  results.push({
    id: c.id,
    status: c.status,
    date: c.date,
    drop_at: c.drop_at,
    entries: data.entries,
    keys: data.keys,
    digest,
    keyDigest,
    verified: true,
  });
}
writeFileSync('review/round3/remote-verification.json', JSON.stringify(results, null, 2));
console.log(
  results.map((r) => ({ id: r.id, status: r.status, date: r.date, verified: r.verified })),
);
