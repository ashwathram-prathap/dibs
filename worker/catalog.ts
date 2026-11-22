import hotCatalog from './catalog-hot.generated';
import { PUBLIC_ORIGIN } from '../shared/config';
import { findTypo, type TypoNode, type CatalogRow } from '../shared/catalog';
import { normalize } from './domain';
import type { Env } from './routes';
import { openBinaryCatalog, lookupBinary, type BinaryCatalog } from '../shared/binary-catalog';
const cache = new Map<string, Promise<any>>();
let activeHot: { slug: string; data: any } | null = null;
function hotFor(slug: string) {
  if (activeHot?.slug === slug) return activeHot.data;
  const value = (hotCatalog as any)[slug];
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  activeHot = { slug, data };
  return data;
}
// One active register per isolate. Sorted keys avoid the overhead of a large object hash table.
let complete: {
  version: string;
  data: Promise<{ keys: string[]; ids: Uint32Array; rows: CatalogRow[] } | BinaryCatalog>;
} | null = null;
async function completeIndex(meta: any) {
  const version = meta.slug + '/' + meta.version;
  if (complete?.version === version) return complete.data;
  const data = (
    meta.indexFormat === 'sha256-96-v1'
      ? (async () => {
          const chunks: Uint8Array[] = [];
          for (let i = 0; i < meta.indexChunks; i++) {
            const response = await fetch(
              PUBLIC_ORIGIN + '/catalog/' + version + `/index-${i}.bin`,
              {
                cf: { cacheTtl: 86400, cacheEverything: true },
              },
            );
            if (!response.ok) throw Error('Catalog unavailable');
            chunks.push(new Uint8Array(await response.arrayBuffer()));
          }
          return openBinaryCatalog(chunks);
        })()
      : fetch(PUBLIC_ORIGIN + '/catalog/' + version + '/full.json', {
          cf: { cacheTtl: 86400, cacheEverything: true },
        }).then(async (response) => {
          if (!response.ok) throw Error('Catalog unavailable');
          const file: any = await response.json();
          const bytes = Uint8Array.from(atob(file.ids), (c) => c.charCodeAt(0));
          return { keys: file.keys, ids: new Uint32Array(bytes.buffer), rows: file.rows };
        })
  ).catch((e) => {
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
  const hot = hotFor(meta.slug);
  if (hot?.version === meta.version && Object.hasOwn(hot.keys, key)) return hot.keys[key];
  const index = await completeIndex(meta);
  if ('chunks' in index) {
    const hash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
    );
    return lookupBinary(index, hash);
  }
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
  const size = meta.rowChunkSize || 256;
  const prefix = size === 256 ? 'rows' : `rows-${size}`;
  const rows = await asset(
    `${meta.slug}/${meta.version}/${prefix}-${Math.floor(index / size)}.json`,
  );
  return rows[index % size];
}
export async function nearMiss(category: any, text: string) {
  const meta = catalogMeta(category);
  const key = normalize(text);
  if (key.length < 3) return null;
  const hot = hotFor(meta.slug);
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
