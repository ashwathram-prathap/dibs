import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
it('builds the real game title Constructor without treating a prototype property as a collision', () => {
  mkdirSync('.tmp', { recursive: true });
  const dir = mkdtempSync(resolve('.tmp/catalog-key-'));
  try {
    mkdirSync(dir + '/categories');
    mkdirSync(dir + '/worker');
    mkdirSync(dir + '/scripts');
    writeFileSync(dir + '/scripts/category-plan.json', JSON.stringify({ retainedCatalogs: [] }));
    writeFileSync(
      dir + '/categories/video-games.json',
      JSON.stringify({
        slug: 'video-games',
        provenance: { identityPolicy: 'complete-reference-v2', scopeNote: 'Test fixture' },
        answers: ['Constructor', 'Cars', 'Car', 'Dreams', 'Dream'].map((display) => ({
          display,
          aliases: [],
          obscurity: 3,
          source: 'test',
        })),
      }),
    );
    execFileSync(
      process.execPath,
      [
        resolve('node_modules/tsx/dist/cli.mjs'),
        resolve('scripts/build-catalog-assets.ts'),
        '--force',
      ],
      { cwd: dir, stdio: 'pipe' },
    );
    const manifest = JSON.parse(
      readFileSync(dir + '/public/catalog/video-games/manifest.json', 'utf8'),
    );
    const index = JSON.parse(
      readFileSync(dir + '/public/catalog/video-games/' + manifest.version + '/full.json', 'utf8'),
    );
    expect(index.keys).toEqual(['car', 'cars', 'constructor', 'dream', 'dreams']);
    expect(index.rows.map((row: any[]) => row[1])).toEqual([
      'Constructor',
      'Cars',
      'Car',
      'Dreams',
      'Dream',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
