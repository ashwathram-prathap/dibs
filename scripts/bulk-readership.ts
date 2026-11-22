import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
export function loadBulkReadership(titles: string[]) {
  const root = '.category-cache/r8/';
  const proof = JSON.parse(readFileSync(root + 'bulk-pageviews-complete.json', 'utf8'));
  if (!proof.complete || proof.days !== 31)
    throw Error('Complete monthly readership proof required');
  const input = JSON.stringify([...new Set(titles)]);
  const hash = createHash('sha256')
    .update('v2-json-title-decoding')
    .update(proof.sha256)
    .update(input)
    .digest('hex');
  const folder = root + 'bulk-selections';
  mkdirSync(folder, { recursive: true });
  const path = folder + '/' + hash + '.json';
  if (!existsSync(path)) {
    const result = execFileSync('python3', ['scripts/select-r8-bulk-pageviews.py'], {
      input,
      maxBuffer: 256 * 1024 * 1024,
    });
    JSON.parse(result.toString());
    writeFileSync(path, result);
  }
  return {
    proof,
    readings: JSON.parse(readFileSync(path, 'utf8')) as Record<string, [number, number]>,
  };
}
