import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readCategory } from './category-file';
export interface CatalogSource {
  categoryFile: string;
  slug?: string;
  version?: string;
  sha256?: string;
  retained?: boolean;
}
export function catalogSources(): CatalogSource[] {
  const plan = JSON.parse(readFileSync('scripts/category-plan.json', 'utf8'));
  return [
    ...readdirSync('categories')
      .filter((n) => n.endsWith('.json'))
      .sort()
      .map((n) => ({ categoryFile: 'categories/' + n })),
    ...(plan.retainedCatalogs || []).map((c: CatalogSource) => ({ ...c, retained: true })),
  ];
}
export function readCatalogSource(source: CatalogSource) {
  if (!source.retained) return readCategory(source.categoryFile);
  const bytes = readFileSync(source.categoryFile);
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
    throw Error('Retained catalog checksum mismatch');
  const c = JSON.parse(gunzipSync(bytes).toString());
  const version = createHash('sha256').update(JSON.stringify(c.answers)).digest('hex').slice(0, 16);
  if (c.slug !== source.slug || version !== source.version)
    throw Error('Retained catalog identity mismatch');
  return c;
}
