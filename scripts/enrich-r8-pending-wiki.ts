import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
const slugs = process.argv
  .find((arg) => arg.startsWith('--slugs='))
  ?.slice(8)
  .split(',');
if (!slugs?.length) throw Error('Specify the finite queue of reference domains');
const novelsPid = Number(process.argv.find((arg) => arg.startsWith('--novels-pid='))?.slice(13));
const alive = (pid: number) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
for (const slug of slugs) {
  if (!/^[a-z-]+$/.test(slug)) throw Error('Invalid reference domain');
  while (true) {
    const definition = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).find(
      (d: any) => d.slug === slug,
    );
    const reference = JSON.parse(
      readFileSync('review/round8/wikidata-reference-progress.json', 'utf8'),
    )[slug];
    const aliases = JSON.parse(readFileSync('review/round8/wikidata-alias-progress.json', 'utf8'))[
      slug
    ];
    const ranks = existsSync('review/round8/occupation-rank-extraction.json')
      ? JSON.parse(readFileSync('review/round8/occupation-rank-extraction.json', 'utf8'))
      : {};
    const ready =
      reference?.complete &&
      reference.cacheKey === definition?.cacheKey &&
      aliases?.complete &&
      aliases.classificationRevision === (definition?.cacheKey || 'base') &&
      (definition?.property !== 'P106' || ranks[slug]) &&
      (slug !== 'novels' || !alive(novelsPid));
    if (ready) break;
    console.log('Waiting for complete current source and aliases:', slug);
    await sleep(30000);
  }
  console.log('Beginning complete Wikipedia alias set:', slug);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      './node_modules/.bin/tsx',
      [
        'scripts/enrich-r8-wikipedia-aliases.ts',
        '--slug=' + slug,
        ...(process.argv.includes('--incremental') ? ['--incremental'] : []),
      ],
      { stdio: 'inherit' },
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error(slug + ' alias import failed: ' + code)),
    );
  });
}
