import { beforeAll, afterAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { PUBLIC_ORIGIN } from '../shared/config';
import { registryDate } from '../worker/domain';
let mf: Miniflare, db: any;
const evidence: any[] = [];
async function call(path: string, body?: any, cookie?: string, ip?: string) {
  const r = await mf.dispatchFetch('http://localhost/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: 'https://dibs.here',
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(ip ? { 'x-test-ip': ip } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  evidence.push({
    action: path.split('?')[0],
    status: r.status,
    reads: Number(r.headers.get('x-d1-rows-read') || 0),
    writes: Number(r.headers.get('x-d1-rows-written') || 0),
  });
  return r;
}
async function account() {
  const r = await call('/bootstrap');
  return { cookie: r.headers.get('set-cookie')!.split(';')[0], ...((await r.json()) as any) };
}
beforeAll(async () => {
  const result = await build({
    entryPoints: ['worker/index.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    external: ['cloudflare:workers'],
    loader: { '.woff': 'binary', '.otf': 'binary' },
    plugins: [
      {
        name: 'wasm-module',
        setup(b) {
          b.onResolve({ filter: /\.wasm$/ }, () => ({ path: './resvg.wasm', external: true }));
        },
      },
    ],
  });
  const pages = await build({
    stdin: {
      contents: `import { preview } from './shared/preview';
      import { onRequest } from './functions/_middleware';
      const html = ${JSON.stringify(readFileSync('index.html', 'utf8').replaceAll('__PUBLIC_ORIGIN__', PUBLIC_ORIGIN))};
      export default { fetch(request, env) {
        const [, kind, id] = new URL(request.url).pathname.split('/');
        return onRequest({ request, env, next: () => preview(kind)({ request, params: { id }, env: { API: env.API, ASSETS: { fetch: () => new Response(html, { headers: { 'content-type': 'text/html' } }) } } }) });
      } };`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'cache-test',
          modules: [
            { type: 'ESModule', path: 'worker.mjs', contents: result.outputFiles[0].text },
            {
              type: 'CompiledWasm',
              path: 'resvg.wasm',
              contents: readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'),
            },
          ],
          compatibilityDate: '2026-11-20',
          d1Databases: ['DB'],
          durableObjects: {
            REGISTRY: { className: 'Registry', useSQLite: true },
            IMAGE_CACHE: { className: 'ImageCache', useSQLite: true },
          },
          bindings: {
            COOKIE_SECRET: 'local-test-only',
            ADMIN_TOKEN: 'local-admin',
            LOCAL_TEST: 'true',
            STAGING: 'true',
            TURNSTILE_SITE_KEY: 'test',
          },
        },
        {
          name: 'pages-test',
          modules: [{ type: 'ESModule', path: 'pages.mjs', contents: pages.outputFiles[0].text }],
          compatibilityDate: '2026-11-20',
          serviceBindings: { API: 'cache-test' },
        },
      ],
    }),
  );
  db = await mf.getD1Database('DB');
  for (const file of [
    '0001_registry.sql',
    '0002_foreign_key_indexes.sql',
    '0003_remove_schools.sql',
    '0004_privacy_cleanup_index.sql',
    '0005_three_dibs.sql',
    '0006_file_event_order.sql',
    '0007_daily_specials.sql',
    '0008_guess_details.sql',
  ])
    await db.exec(
      readFileSync('migrations/' + file, 'utf8')
        .replace(/^--.*$/gm, '')
        .replace(/CREATE TRIGGER[\s\S]*?\nEND;/g, (m) => m.replace(/\n/g, ' '))
        .replace(/\n/g, ' '),
    );
  await db.exec(
    readFileSync('migrations/0009_r8.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  await db.exec(
    readFileSync('migrations/0010_r9.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  await db.exec(readFileSync('migrations/0011_calendar.sql', 'utf8').replace(/\n/g, ' '));
  await db.exec(
    readFileSync('migrations/0013_points.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );

  await db.exec(readFileSync('migrations/0014_shared_networks.sql', 'utf8').replace(/^--.*$/gm, '').replace(/\n/g, ' '));  const date = registryDate();
  await db
    .prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(
      'practice',
      date,
      'Animals',
      'animals',
      2200,
      new Date(Date.now() - 60000).toISOString(),
      'approved',
    )
    .run();
  for (let i = 0; i < 70; i++) {
    await db
      .prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)')
      .bind('a' + i, 'practice', 'animal' + i, 'Animal ' + i, '[]', 4)
      .run();
    await db
      .prepare('INSERT INTO answer_keys VALUES(?,?,?)')
      .bind('practice', 'animal' + i, 'a' + i)
      .run();
  }
}, 30000);

afterAll(async () => {
  await mf?.dispose();
});
it('local practice fallback: 200 arrivals in 60 seconds, 3–8 guesses each', async () => {
  const times: number[] = [],
    errors: any[] = [],
    winning = new Set<string>();
  const start = Date.now();
  await Promise.all(
    Array.from({ length: 200 }, async (_, i) => {
      await new Promise((r) => setTimeout(r, i * 300));
      const a = await account();
      for (let j = 0; j < 3 + (i % 6); j++) {
        const at = performance.now();
        const r = await call(
          '/claim',
          {
            answer: j === 0 ? 'Animal 64' : 'dibs',
            requestId: crypto.randomUUID(),
            turnstileToken: 'test',
          },
          a.cookie,
          'local-load-' + i,
        );
        times.push(performance.now() - at);
        const data: any = await r.json();
        if (r.status === 201) winning.add(data.claim.id);
        if (![201, 409, 422].includes(r.status))
          errors.push({ player: i, guess: j, status: r.status });
      }
    }),
  );
  times.sort((a, b) => a - b);
  const report = {
    environment:
      'Isolated local Miniflare practice; no deployed requests and no network latency. This does not satisfy the deployed load gate.',
    players: 200,
    arrivalWindowSeconds: 59.7,
    guesses: times.length,
    p50Ms: Math.round(times[Math.ceil(times.length * 0.5) - 1]),
    p95Ms: Math.round(times[Math.ceil(times.length * 0.95) - 1]),
    durationSeconds: (Date.now() - start) / 1000,
    unexpectedErrors: errors,
    errorRate: errors.length / times.length,
    uniqueWinningClaims: winning.size,
    measuredD1Writes: evidence.reduce((s, r) => s + r.writes, 0),
    passed: errors.length === 0 && winning.size === 1,
  };
  writeFileSync('review/round11/local-load-fallback.json', JSON.stringify(report, null, 2));
  expect(report.passed).toBe(true);
}, 120000);
