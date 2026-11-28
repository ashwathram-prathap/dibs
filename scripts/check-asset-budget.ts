import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assertAssetBudget, NEW_CATALOG_TARGET_BYTES } from '../shared/asset-budget';
let files = 0,
  bytes = 0,
  maxFileBytes = 0,
  largestPath = '';
function walk(dir: string) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n),
      s = statSync(p);
    if (s.isDirectory()) walk(p);
    else {
      files++;
      bytes += s.size;
      if (s.size > maxFileBytes) {
        maxFileBytes = s.size;
        largestPath = p;
      }
    }
  }
}
walk(process.argv[2] || 'dist');
console.log(JSON.stringify({ files, bytes, maxFileBytes, largestPath }));
assertAssetBudget(files, maxFileBytes);

if (maxFileBytes > NEW_CATALOG_TARGET_BYTES)
  console.warn(
    'Catalog target warning: files above 10,000,000 bytes remain platform-valid; preserve pinned versions.',
  );
