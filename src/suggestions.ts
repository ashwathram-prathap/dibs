import { normalize } from '../worker/domain';
const catalogs = new Map<string, Promise<{ display: string; keys: string[] }[]>>();
export async function suggestions(slug: string, query: string) {
  let catalog = catalogs.get(slug);
  if (!catalog) {
    catalog = fetch('/catalog/' + encodeURIComponent(slug) + '.json').then((r) => {
      if (!r.ok) throw new Error('Catalog unavailable');
      return r.json();
    });
    catalogs.set(slug, catalog);
    catalog.catch(() => catalogs.delete(slug));
  }
  const key = normalize(query);
  return (await catalog)
    .filter((a) => a.keys.some((k) => k.startsWith(key)))
    .slice(0, 8)
    .map((a) => a.display);
}
