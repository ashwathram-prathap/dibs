import './test-traffic';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const base = 'https://practice.dibs-7hz.pages.dev';
const token = readFileSync('.dev.vars.staging', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
const slugs = process.argv.includes('--all')
  ? readdirSync('public/catalog')
  : process.argv
      .find((arg) => arg.startsWith('--slugs='))
      ?.slice(8)
      .split(',') || ['animals', 'cities'];
const reportPath =
  process.argv.find((arg) => arg.startsWith('--report='))?.slice(9) ||
  'review/round8/practice-large-index-benchmark.json';
const coverage = JSON.parse(readFileSync('review/coverage/results.json', 'utf8'));
const api = async (path: string, body: any) => {
  const r = await fetch(base + '/api' + path, {
    method: 'POST',
    headers: { origin: base, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d: any = await r.json();
  if (!r.ok) throw Error(r.status + ': ' + d.message);
  return d;
};
const install = async (slug: string) => {
  await api('/admin/practice-reset', {});
  const c = JSON.parse(readFileSync('categories/' + slug + '.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('public/catalog/' + slug + '/manifest.json', 'utf8'));
  await api('/admin/static-catalog', {
    id: 'practice',
    slug,
    name: c.name,
    manifest,
    coverage: coverage.find((row: any) => row.slug === slug),
  });
  return { category: c, manifest };
};
const report: any[] = [];
try {
  for (const slug of slugs) {
    const { manifest } = await install(slug);
    const size = manifest.rowChunkSize || 256;
    const prefix = size === 256 ? 'rows' : 'rows-' + size;
    const words = Array.from({ length: 100 }, (_, i) => {
      const ordinal = Math.floor((manifest.count * (i + 0.5)) / 100);
      const rows = JSON.parse(
        readFileSync(
          `public/catalog/${slug}/${manifest.version}/${prefix}-${Math.floor(ordinal / size)}.json`,
          'utf8',
        ),
      );
      return rows[ordinal % size][1];
    });
    const passes: any[] = [];
    for (let pass = 0; pass < 2; pass++) {
      const rows: any[] = [];
      const start = performance.now();
      for (let i = 0; i < words.length; i += 20)
        rows.push(...(await api('/admin/check-answers', { answers: words.slice(i, i + 20) })).rows);
      const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
      passes.push({
        pass,
        accepted: rows.filter((r) => r.found).length,
        samples: rows.length,
        p95Ms: ms[95],
        maxMs: ms.at(-1),
        totalRoundTripMs: performance.now() - start,
        rows,
      });
      if (rows.some((row) => !row.found)) throw Error(slug + ': sampled answer missing');
    }
    const obvious: any[] = [];
    if (process.argv.includes('--obvious')) {
      const answers = readFileSync('review/coverage/' + slug + '.txt', 'utf8')
        .trim()
        .split('\n');
      for (let i = 0; i < answers.length; i += 20)
        obvious.push(
          ...(await api('/admin/check-answers', { answers: answers.slice(i, i + 20) })).rows,
        );
    }
    report.push({ slug, entries: manifest.count, version: manifest.version, passes, obvious });
    if (obvious.some((row) => !row.found)) throw Error(slug + ': obvious answer missing');
    console.log(
      slug,
      passes.map((p) => ({ accepted: p.accepted, p95: p.p95Ms, max: p.maxMs })),
    );
  }
} finally {
  await install('animals');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        note: 'First rare lookup includes the lazy catalog download; p95 covers uniformly spaced full-register samples. Cloudflare clock reports zero for sub-tick cached work. No claims are made; practice reset and restored to Animals.',
        report,
      },
      null,
      2,
    ),
  );
}
