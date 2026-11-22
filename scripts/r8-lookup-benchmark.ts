import { readCategory } from './category-file';
import { normalize } from '../worker/domain';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { findTypo } from '../shared/catalog';
import { lookup } from '../worker/catalog';
const results: any[] = [];
globalThis.fetch = (async (input: any) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (!url.pathname.startsWith('/catalog/')) throw Error('Unexpected benchmark request');
  return new Response(readFileSync('public' + url.pathname));
}) as typeof fetch;
const p95 = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)];
for (const slug of readdirSync('public/catalog')) {
  const manifest = JSON.parse(readFileSync(`public/catalog/${slug}/manifest.json`, 'utf8'));
  const dir = `public/catalog/${slug}/${manifest.version}`;
  const source = readCategory('categories/' + slug + '.json');
  const keys: string[] = source.answers.flatMap((a: any) => [
    normalize(a.display),
    ...a.aliases.map(normalize),
  ]);
  const category = { source_json: JSON.stringify({ staticCatalog: manifest }) };
  const samples = Array.from(
    { length: 200 },
    (_, i) => keys[Math.floor((keys.length * (i + 0.5)) / 200)],
  );
  const timings: number[] = [];
  const initialStart = performance.now();
  for (const key of samples)
    if (!(await lookup(category, key))) throw Error(slug + ': missing key');
  const initialPassMs = performance.now() - initialStart;
  for (const key of samples) {
    const start = performance.now();
    if (!(await lookup(category, key))) throw Error(slug + ': missing cached key');
    timings.push(performance.now() - start);
  }
  const trees = new Map<number, any>();
  const typoTimes: number[] = [];
  let parsedTypoBytes = 0;
  for (let i = 0; i < 30; i++) {
    const query = keys[Math.floor((i * keys.length) / 30)].slice(0, -1) + 'x';
    for (
      let length = Math.max(1, query.length - 2);
      length <= Math.min(120, query.length + 2);
      length++
    ) {
      if (trees.has(length)) continue;
      const bytes = readFileSync(`${dir}/typos-${length}.json`);
      parsedTypoBytes += bytes.length;
      trees.set(length, JSON.parse(bytes.toString()));
    }
    const start = performance.now();
    for (
      let length = Math.max(1, query.length - 2);
      length <= Math.min(120, query.length + 2);
      length++
    )
      findTypo(trees.get(length), query, 2);
    typoTimes.push(performance.now() - start);
  }
  results.push({
    slug,
    entries: manifest.count,
    keys: keys.length,
    exactSamples: samples.length,
    initialPassIncludingLocalDiskMs: initialPassMs,
    warmExactP95Ms: p95(timings),
    warmTypoP95Ms: p95(typoTimes),
    parsedTypoBytes,
  });
}
writeFileSync(
  'review/round8/local-lookup-benchmark.json',
  JSON.stringify(
    {
      runtime:
        'Actual Worker lookup implementation with local file-backed fetch; Node timing proxy, not Cloudflare CPU or network measurement. Typo search runs in the browser Worker in production.',
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(results);
