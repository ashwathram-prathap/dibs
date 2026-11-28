import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
// Ignore packaging timestamps, maps, and local build directories; hash all deploy bytes.
export function releaseDigest(root: string) {
  const hash = createHash('sha256');
  function walk(base = '') {
    for (const name of readdirSync(join(root, base)).sort()) {
      if (name.startsWith('.') || name === 'README.md' || name.endsWith('.map')) continue;
      const rel = join(base, name),
        path = join(root, rel);
      if (statSync(path).isDirectory()) walk(rel);
      else {
        hash.update(rel + '\0');
        hash.update(createHash('sha256').update(readFileSync(path)).digest());
      }
    }
  }
  walk();
  return hash.digest('hex');
}
