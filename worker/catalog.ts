import hotCatalog from './catalog-hot.generated';
import { PUBLIC_ORIGIN } from '../shared/config';
import { findTypo, type TypoNode, type CatalogRow } from '../shared/catalog';
import { normalize } from './domain';
import type { Env } from './routes';
const cache = new Map<string, Promise<any>>();
// One active register per isolate. Sorted keys avoid the overhead of a large object hash table.
let complete: {
  version: string;
  data: Promise<{ keys: string[]; ids: Uint32Array; rows: CatalogRow[] }>;
} | null = null;
async function completeIndex(meta: any) {
  const version = meta.slug + '/' + meta.version;
  if (complete?.version === version) return complete.data;
  const data = fetch(PUBLIC_ORIGIN + '/catalog/' + version + '/full.json', {
    cf: { cacheTtl: 86400, cacheEverything: true },
  })
    .then(async (response) => {
      if (!response.ok) throw Error('Catalog unavailable');
      const file: any = await response.json();
      const bytes = Uint8Array.from(atob(file.ids), (c) => c.charCodeAt(0));
      return { keys: file.keys, ids: new Uint32Array(bytes.buffer), rows: file.rows };
    })
    .catch((e) => {
      if (complete?.version === version) complete = null;
      throw e;
    });
  complete = { version, data };
  return data;
}
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
  const index = await completeIndex(meta);
  let low = 0,
    high = index.keys.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const candidate = index.keys[mid];
    if (candidate === key) return index.rows[index.ids[mid]];
    if (candidate < key) low = mid + 1;
    else high = mid - 1;
  }
  return null;
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
