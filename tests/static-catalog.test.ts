import { readCategory } from '../scripts/category-file';
import { it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { registryDate, dropAt } from '../worker/domain';
let mf: Miniflare, db: any;
let manifest: any;
const call = (path: string, body?: any, cookie?: string) =>
  mf.dispatchFetch('http://localhost/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: 'https://dibs.here',
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
it('claims through the complete static register, persists sparse rows, and restores one identity', async () => {
  const start = await call('/bootstrap');
  const cookie = start.headers.get('set-cookie')!.split(';')[0];
  const initial: any = await start.json();
  expect(initial.today.category.total_registrable).toBe(manifest.count);
  const body = { answer: 'Chameleon', requestId: crypto.randomUUID(), turnstileToken: 'test' };
  const results = await Promise.all([call('/claim', body, cookie), call('/claim', body, cookie)]);
  expect(results.map((r) => r.status)).toEqual([201, 201]);
  const a: any = await results[0].json(),
    b: any = await results[1].json();
  expect(a.claim.id).toBe(b.claim.id);
  expect(a.file.dibs).toBe(1);
  expect(a.recoveryKey).toMatch(/^DIBS-/);
  const restored = await call('/recover', { key: a.recoveryKey });
  expect(restored.status).toBe(200);
  const restoredCookie = restored.headers.get('set-cookie')!.split(';')[0];
  const state: any = await (await call('/me', undefined, restoredCookie)).json();
  expect(state.user.id).toBe(initial.me.user.id);
  expect(state.file.dibs).toBe(1);
  const typo = await call(
    '/claim',
    { answer: 'Chamelon', requestId: crypto.randomUUID(), turnstileToken: 'test' },
    cookie,
  );
  expect(typo.status).toBe(422);
  const missed: any = await typo.json();
  expect(missed.suggestion).toBe('Chameleon');
  expect(missed.spellingCatalog.version).toBe(manifest.version);
  const prototypeName = await call(
    '/claim',
    { answer: 'constructor', requestId: crypto.randomUUID(), turnstileToken: 'test' },
    cookie,
  );
  expect(prototypeName.status).toBe(422); // A JS prototype property is not an accepted hot-index row.
  expect((await db.prepare('SELECT COUNT(*) n FROM answers').first()).n).toBeLessThanOrEqual(21);
  expect((await db.prepare('SELECT COUNT(*) n FROM claims').first()).n).toBe(1);
  expect((await db.prepare('SELECT COUNT(*) n FROM strikes').first()).n).toBe(0);
}, 30000);

it('files a valid answer whose readership is unknown without inventing an obscurity score', async () => {
  const start = await call('/bootstrap');
  const cookie = start.headers.get('set-cookie')!.split(';')[0];
  const response = await call(
    '/claim',
    { answer: 'Pigeon', requestId: crypto.randomUUID(), turnstileToken: 'test' },
    cookie,
  );
  expect(response.status).toBe(201);
  const result: any = await response.json();
  expect(result.claim.display).toBe('Pigeon');
  expect(result.claim.obscurity).toBeNull();
});

it('loads the entire Cities index in the Worker runtime and stores only the claimed reference', async () => {
  await mf.dispose();
  await startRegistry('cities');
  const response = await call('/bootstrap');
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const c = JSON.parse(readFileSync('categories/cities.json', 'utf8'));
  const answer = c.answers[50000].display;
  const claim = await call(
    '/claim',
    { answer, requestId: crypto.randomUUID(), turnstileToken: 'test' },
    cookie,
  );
  expect(claim.status).toBe(201);
  expect(((await claim.json()) as any).claim.display).toBe(answer);
  expect((await db.prepare('SELECT COUNT(*) n FROM answers').first()).n).toBeLessThanOrEqual(21);
}, 30000);

it('claims a deep binary-index entry and publishes the correct typo row layout', async () => {
  await mf.dispose();
  await startRegistry('rivers');
  expect(manifest.indexFormat).toBe('sha256-96-v1');
  const response = await call('/bootstrap');
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const c = readCategory('categories/rivers.json');
  const answer = c.answers[Math.floor(c.answers.length * 0.8)];
  const claim = await call(
    '/claim',
    {
      answer: answer.aliases[0] || answer.display,
      requestId: crypto.randomUUID(),
      turnstileToken: 'test',
    },
    cookie,
  );
  expect(claim.status).toBe(201);
  expect(((await claim.json()) as any).claim.display).toBe(answer.display);
  const missing = await call(
    '/claim',
    {
      answer: 'qzxzzxnotriver',
      requestId: crypto.randomUUID(),
      turnstileToken: 'test',
    },
    cookie,
  );
  expect(missing.status).toBe(422);
  expect(((await missing.json()) as any).spellingCatalog.rowChunkSize).toBe(1024);
  expect((await db.prepare('SELECT COUNT(*) n FROM answers').first()).n).toBeLessThanOrEqual(21);
  expect((await db.prepare('SELECT COUNT(*) n FROM strikes').first()).n).toBe(0);
}, 30000);
