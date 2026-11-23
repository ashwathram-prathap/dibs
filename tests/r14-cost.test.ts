import { resolvePopularity, measured as hasReading } from '../scripts/popularity-aliases';
import { readCategory } from '../scripts/category-file';
import { it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { registryDate, dropAt } from '../worker/domain';
let mf: Miniflare, db: any;
let manifest: any;
const call = (path: string, body?: any, cookie?: string, ip?: string) =>
  mf.dispatchFetch('http://localhost/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: 'https://dibs.here',
      ...(ip ? { 'x-test-ip': ip } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function startRegistry(slug: string) {
  manifest = JSON.parse(readFileSync('public/catalog/' + slug + '/manifest.json', 'utf8'));
  const category = readCategory('categories/' + slug + '.json');
  const code = await build({
    entryPoints: ['worker/index.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    external: ['cloudflare:workers'],
    loader: { '.wasm': 'binary', '.woff': 'binary', '.otf': 'binary' },
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'static-test',
          modules: true,
          script: code.outputFiles[0].text,
          compatibilityDate: '2026-11-20',
          d1Databases: ['DB'],
          durableObjects: {
            REGISTRY: { className: 'Registry', useSQLite: true },
            IMAGE_CACHE: { className: 'ImageCache', useSQLite: true },
          },
          bindings: {
            LOCAL_TEST: 'true',
            COOKIE_SECRET: 'static-test-secret',
            ADMIN_TOKEN: 'static-test-admin',
            TURNSTILE_SITE_KEY: 'test',
          },
          outboundService: async (req: Request) => {
            const url = new URL(req.url);
            if (url.origin === 'https://dibs.here' && url.pathname.startsWith('/catalog/'))
              return new Response(readFileSync('public' + url.pathname), {
                headers: { 'content-type': 'application/json' },
              });
            throw Error('Unexpected outbound ' + url.pathname);
          },
        },
      ],
    }),
  );
  db = await mf.getD1Database('DB');
  for (const f of readdirSync('migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(
      readFileSync('migrations/' + f, 'utf8')
        .replace(/^--.*$/gm, '')
        .replace(/CREATE TRIGGER[\s\S]*?\nEND;/g, (m) => m.replace(/\n/g, ' '))
        .replace(/\n/g, ' '),
    );
  const date = registryDate();
  await db
    .prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status,source_json) VALUES(?,?,?,?,?,?,?,?)',
    )
    .bind(
      'static',
      date,
      category.name,
      slug,
      manifest.count,
      dropAt(date),
      'approved',
      JSON.stringify({ staticCatalog: manifest }),
    )
    .run();
}
beforeAll(() => startRegistry('animals'), 30000);
afterAll(async () => {
  await mf?.dispose();
});
it('measures real static-catalog claims and leaderboard polling using D1 result metadata', async () => {
  const catalog = readCategory('categories/animals.json');
  const samples: any[] = [];
  for (let player = 0; player < 3; player++) {
    const boot = await call('/bootstrap');
    const cookie = boot.headers.get('set-cookie')!.split(';')[0];
    for (const [step, index] of [
      100 + player * 3,
      0,
      0,
      101 + player * 3,
      102 + player * 3,
    ].entries()) {
      const answer = catalog.answers[index];
      const r = await call(
        '/claim',
        { answer: answer.display, turnstileToken: 'test', requestId: crypto.randomUUID() },
        cookie,
        'cost-' + player,
      );
      const data: any = await r.json();
      expect(r.status).toBe(step === 1 || step === 2 ? 409 : 201);
      samples.push({
        player,
        step,
        status: r.status,
        reads: Number(r.headers.get('x-d1-rows-read')),
        writes: Number(r.headers.get('x-d1-rows-written')),
      });
      if (r.status === 201) {
        const measured = resolvePopularity(catalog.answers)
          .readings.filter(hasReading)
          .map((p) => ({ pageviews: p! }))
          .sort(
            (a, b) => b.pageviews.total! / b.pageviews.days - a.pageviews.total! / a.pageviews.days,
          )
          .slice(0, 3000);
        const popularity = answer.pageviews.total / answer.pageviews.days;
        const greater = measured.filter(
          (a: any) => a.pageviews.total / a.pageviews.days > popularity,
        ).length;
        const equal = measured.filter(
          (a: any) => a.pageviews.total / a.pageviews.days === popularity,
        ).length;
        const expected = equal ? (greater + (equal - 1) / 2) / (measured.length - 1) : 1;
        expect(data.claim.percentile).toBeCloseTo(expected, 3);
        expect(data.claim.points - data.claim.bonus).toBe(
          Math.round((10 + (100 / 0.9) * Math.max(0, expected - 0.1)) / 5) * 5,
        );
      }
    }
    for (let i = 0; i < 10; i++) {
      const r = await call('/leaderboard', undefined, cookie);
      samples.push({
        player,
        poll: i,
        status: r.status,
        reads: Number(r.headers.get('x-d1-rows-read')),
        writes: Number(r.headers.get('x-d1-rows-written')),
      });
      expect(r.status).toBe(200);
      expect(Number(r.headers.get('x-d1-rows-written'))).toBe(0);
    }
  }
  writeFileSync(
    'review/round14/static-d1-cost.json',
    JSON.stringify({ players: 3, samples }, null, 2),
  );
}, 30000);
