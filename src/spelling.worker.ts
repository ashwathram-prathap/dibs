import { findTypo, type TypoNode, type CatalogRow } from '../shared/catalog';
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
        if (length < 1 || length > 96) return null;
        const response = await fetch(base + `typos-${length}.json`);
        if (!response.ok) return null;
        const tree: TypoNode[] = await response.json();
        return findTypo(tree, key, 2);
      }),
    );
    const id = candidates.filter((n): n is number => n !== null).sort((a, b) => a - b)[0];
    if (id === undefined) {
      self.postMessage(null);
      return;
    }
    const response = await fetch(base + `rows-${Math.floor(id / 256)}.json`);
    if (!response.ok) {
      self.postMessage(null);
      return;
    }
    const rows: CatalogRow[] = await response.json();
    self.postMessage(rows[id % 256][1]);
  } catch {
    self.postMessage(null);
  }
};
