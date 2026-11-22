import { findTypoMatch, type TypoNode, type CatalogRow } from '../shared/catalog';
import { normalize } from '../worker/domain';
self.onmessage = async ({ data }) => {
  try {
    const { catalog, answer } = data;
    const key = normalize(answer);
    if (
      key.length < 3 ||
      !/^[a-z-]+$/.test(catalog.slug) ||
      !/^[a-f0-9]{16}$/.test(catalog.version)
    ) {
      self.postMessage(null);
      return;
    }
    const base = `/catalog/${catalog.slug}/${catalog.version}/`;
    const candidates = await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const length = key.length + i - 2;
        if (length < 1 || length > 120) return null;
        const response = await fetch(base + `typos-${length}.json`);
        if (!response.ok) return null;
        const tree: TypoNode[] = await response.json();
        return findTypoMatch(tree, key, 2);
      }),
    );
    const id = candidates
      .filter((n): n is { id: number; distance: number } => n !== null)
      .sort((a, b) => a.distance - b.distance || a.id - b.id)[0]?.id;
    if (id === undefined) {
      self.postMessage(null);
      return;
    }
    const size = catalog.rowChunkSize || 256;
    const prefix = size === 256 ? 'rows' : `rows-${size}`;
    const response = await fetch(base + `${prefix}-${Math.floor(id / size)}.json`);
    if (!response.ok) {
      self.postMessage(null);
      return;
    }
    const rows: CatalogRow[] = await response.json();
    self.postMessage(rows[id % size][1]);
  } catch {
    self.postMessage(null);
  }
};
