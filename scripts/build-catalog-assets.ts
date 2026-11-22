import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalize } from '../worker/domain';
import { shardFor, distanceFrom, type TypoNode, type CatalogRow } from '../shared/catalog';
const unchanged =
  existsSync('worker/catalog-hot.generated.ts') &&
  readdirSync('categories')
    .filter((f) => f.endsWith('.json'))
    .every((f) => {
      const c = JSON.parse(readFileSync('categories/' + f, 'utf8'));
      if (c.provenance?.identityPolicy !== 'complete-reference-v2') return true;
      const version = createHash('sha256')
        .update(JSON.stringify(c.answers))
        .digest('hex')
        .slice(0, 16);
      try {
        return (
          JSON.parse(readFileSync(`public/catalog/${c.slug}/manifest.json`, 'utf8')).version ===
            version &&
          existsSync(`public/catalog/${c.slug}/${version}/full.json`) &&
          !existsSync(`public/catalog/${c.slug}/${version}/keys-0.json`)
        );
      } catch {
        return false;
      }
    });
if (unchanged && !process.argv.includes('--force')) {
  console.log('Catalog assets already current');
  process.exit(0);
}
rmSync('public/catalog', { recursive: true, force: true });
mkdirSync('public/catalog', { recursive: true });
const hot: Record<string, any> = {};
for (const f of readdirSync('categories').filter((f) => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync('categories/' + f, 'utf8'));
  if (c.provenance?.identityPolicy !== 'complete-reference-v2') continue;
  const rows: CatalogRow[] = c.answers.map((a: any, i: number) => [i, a.display, a.obscurity]);
  const version = createHash('sha256').update(JSON.stringify(c.answers)).digest('hex').slice(0, 16);
  const dir = `public/catalog/${c.slug}/${version}`;
  mkdirSync(dir, { recursive: true });
  const shards: Record<string, CatalogRow>[] = Array.from({ length: 256 }, () =>
    Object.create(null),
  );
  for (const [i, a] of c.answers.entries())
    for (const key of new Set<string>([normalize(a.display), ...a.aliases.map(normalize)])) {
      if (shards[shardFor(key)][key]) throw Error('Alias collision ' + c.slug + ': ' + key);
      shards[shardFor(key)][key] = rows[i];
    }
  const sortedKeys = shards.flatMap((shard) => Object.keys(shard)).sort();
  const ordinals = Buffer.alloc(sortedKeys.length * 4);
  sortedKeys.forEach((key, i) => ordinals.writeUInt32LE(shards[shardFor(key)][key][0], i * 4));
  const complete = JSON.stringify({ keys: sortedKeys, ids: ordinals.toString('base64'), rows });
  if (Buffer.byteLength(complete) > 25 * 1024 * 1024)
    throw Error(c.slug + ' exceeds Pages asset size');
  writeFileSync(`${dir}/full.json`, complete);
  // Only the sorted full index is used at runtime. Do not ship 256 unused key files.
  for (let i = 0; i < rows.length; i += 256)
    writeFileSync(
      `${dir}/rows-${Math.floor(i / 256)}.json`,
      JSON.stringify(rows.slice(i, i + 256)),
    );
  // A complete metric tree covers every accepted name and alias, without a popularity cap.
  const trees: Record<number, TypoNode[]> = {};
  for (const shard of shards)
    for (const [key, row] of Object.entries(shard)) {
      const tree = (trees[key.length] ||= []);
      const node: TypoNode = [key, row[0], {}];
      if (!tree.length) {
        tree.push(node);
        continue;
      }
      const distance = distanceFrom(key);
      let at = 0;
      while (true) {
        const d = distance(tree[at][0]);
        const child = tree[at][2][d];
        if (child === undefined) {
          tree[at][2][d] = tree.length;
          tree.push(node);
          break;
        }
        at = child;
      }
    }
  for (let length = 1; length <= Math.max(120, ...Object.keys(trees).map(Number)); length++)
    writeFileSync(`${dir}/typos-${length}.json`, JSON.stringify(trees[length] || []));
  const fast: Record<string, CatalogRow> = Object.create(null);
  for (const [i, a] of c.answers.entries())
    if (
      i < 1000 ||
      a.source === 'https://wordnet.princeton.edu/' ||
      a.source === 'Dibs common-name editorial supplement'
    )
      for (const key of new Set<string>([normalize(a.display), ...a.aliases.map(normalize)]))
        fast[key] = rows[i];
  const fastTree: TypoNode[] = [];
  for (const [key, row] of Object.entries(fast)) {
    if (key !== normalize(row[1])) continue;
    const node: TypoNode = [key, row[0], {}];
    if (!fastTree.length) {
      fastTree.push(node);
      continue;
    }
    const distance = distanceFrom(key);
    let at = 0;
    while (true) {
      const d = distance(fastTree[at][0]);
      const child = fastTree[at][2][d];
      if (child === undefined) {
        fastTree[at][2][d] = fastTree.length;
        fastTree.push(node);
        break;
      }
      at = child;
    }
  }
  hot[c.slug] = {
    version,
    keys: fast,
    tree: fastTree,
    names: Object.fromEntries(Object.values(fast).map((row) => [row[0], row[1]])),
  };
  const manifest = {
    v: 2,
    slug: c.slug,
    version,
    count: rows.length,
    house: rows.slice(0, 10),
    scope: c.provenance.scopeNote,
  };
  writeFileSync(`public/catalog/${c.slug}/manifest.json`, JSON.stringify(manifest));
}

writeFileSync(
  'worker/catalog-hot.generated.ts',
  'export default JSON.parse(' +
    JSON.stringify(JSON.stringify(hot)) +
    ') as Record<string, any>;\n',
);
