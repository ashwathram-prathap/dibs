import hotCatalog from './catalog-hot.generated';
import { PUBLIC_ORIGIN } from '../shared/config';
import { shardFor, findTypo, type TypoNode, type CatalogRow } from '../shared/catalog';
import { normalize } from './domain';
import type { Env } from './routes';
const cache = new Map<string, Promise<any>>();
export function catalogMeta(category: any) {
  try {
    return JSON.parse(category.source_json || '{}').staticCatalog;
  } catch {
    return null;
  }
}
async function asset(path: string) {
  let pending = cache.get(path);
  if (!pending) {
    pending = fetch(PUBLIC_ORIGIN + '/catalog/' + path, {
      cf: { cacheTtl: 86400, cacheEverything: true },
    })
      .then(async (r) => {
        if (!r.ok) throw Error('Catalog unavailable');
        return r.json();
      })
      .catch((e) => {
        cache.delete(path);
        throw e;
      });
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(path, pending);
  }
  return pending;
}
export async function lookup(category: any, text: string): Promise<CatalogRow | null> {
  const meta = catalogMeta(category);
  const key = normalize(text);
  const hot = (hotCatalog as any)[meta.slug];
  if (hot?.version === meta.version && hot.keys[key]) return hot.keys[key];
  const shard = await asset(`${meta.slug}/${meta.version}/keys-${shardFor(key)}.json`);
  return shard[key] || null;
}
export async function rowAt(category: any, index: number): Promise<CatalogRow> {
  const meta = catalogMeta(category);
  const rows = await asset(`${meta.slug}/${meta.version}/rows-${Math.floor(index / 256)}.json`);
  return rows[index % 256];
}
export async function nearMiss(category: any, text: string) {
  const meta = catalogMeta(category);
  const key = normalize(text);
  if (key.length < 3) return null;
  const hot = (hotCatalog as any)[meta.slug];
  if (hot?.version !== meta.version || !hot.tree) return null;
  const id = findTypo(hot.tree, key, 2);
  return id === null ? null : hot.names[id];
}
export function answerId(category: any, row: CatalogRow) {
  return `${category.id}:v2:${catalogMeta(category).version}:${row[0]}`;
}
export function persistAnswer(env: Env, category: any, row: CatalogRow) {
  return env.DB.prepare(
    'INSERT OR IGNORE INTO answers(id,category_id,canonical,display,aliases_json,obscurity) VALUES(?,?,?,?,?,?)',
  ).bind(
    answerId(category, row),
    category.id,
    'v2:' + catalogMeta(category).version + ':' + row[0],
    row[1],
    '[]',
    row[2],
  );
}
