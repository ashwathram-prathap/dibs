// A stable digest of a built artifact directory, so production reuses the practice-proven build.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
function files(root: string, base = ''): string[] {
  return readdirSync(join(root, base))
    .sort()
    .flatMap((name) => {
      const path = join(base, name);
      return statSync(join(root, path)).isDirectory() ? files(root, path) : [path];
    });
}
export function artifactDigest(root: string) {
  const hash = createHash('sha256');
  for (const path of files(root)) {
    hash.update(path + '\0');
    hash.update(
      createHash('sha256')
        .update(readFileSync(join(root, path)))
        .digest(),
    );
  }
  return hash.digest('hex');
}
if (process.argv[1]?.endsWith('r19h-artifact.ts')) {
  const root = process.argv[2] || 'dist';
  const result = {
    at: new Date().toISOString(),
    root,
    files: files(root).length,
    digest: artifactDigest(root),
    entry: readFileSync(join(root, 'index.html'), 'utf8').match(
      /src="(\/assets\/index-[^"]+\.js)"/,
    )?.[1],
  };
  if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(result, null, 2));
  console.log(result);
}
