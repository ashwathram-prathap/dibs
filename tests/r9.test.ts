import { beforeAll, afterAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PUBLIC_ORIGIN } from '../shared/config';
import { PNG } from 'pngjs';
import { registryDate, dropAt } from '../worker/domain';
let mf: Miniflare, db: any;
let summaryId: string, certificateId: string;
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
            STAGING: 'true',
            LOCAL_TEST: 'true',
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
  const date = registryDate();
  await db
    .prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)',
    )
    .bind('practice', date, 'Animals', 'animals', 2200, dropAt(date), 'approved')
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
it('recovers a practice reset mid-session without charging a strike or blaming cookies', async () => {
  const a = await account();
  const reset = await mf.dispatchFetch('http://localhost/api/admin/practice-reset', {
    method: 'POST',
    headers: {
      origin: 'https://dibs.here',
      authorization: 'Bearer local-admin',
      'content-type': 'application/json',
    },
    body: '{}',
  });
  expect(reset.status).toBe(200);
  const r = await call(
    '/claim',
    { answer: 'Animal 69', turnstileToken: 'test', requestId: crypto.randomUUID() },
    a.cookie,
    'reset-player',
  );
  expect(r.status).toBe(201);
  const data: any = await r.json();
  expect(data.sessionNotice).toBe('Practice was reset. You have a fresh file.');
  expect(data.me.user.id).not.toBe(a.me.user.id);
  expect(data.file.dibs).toBe(1);
  expect(data.file.strikes).toBe(0);
  expect(r.headers.get('set-cookie')).toContain(data.me.user.id);
  const blocked = await call('/claim', { answer: 'Animal 1', turnstileToken: 'test' });
  expect(blocked.status).toBe(401);
  expect(((await blocked.json()) as any).code).toBe('COOKIES_BLOCKED');
});
it('binds a short-lived verification token to the session and network', async () => {
  const a = await account();
  const checked = await call(
    '/verify-session',
    { turnstileToken: 'test' },
    a.cookie,
    'verified-network',
  );
  expect(checked.status).toBe(200);
  const { sessionToken }: any = await checked.json();
  const filed = await call(
    '/claim',
    { answer: 'Animal 65', sessionToken },
    a.cookie,
    'verified-network',
  );
  expect(filed.status).toBe(201);
  const b = await account();
  expect(
    (await call('/claim', { answer: 'Animal 64', sessionToken }, b.cookie, 'verified-network'))
      .status,
  ).toBe(428);
  expect(
    (await call('/claim', { answer: 'Animal 64', sessionToken }, a.cookie, 'other-network')).status,
  ).toBe(428);
  expect(
    (
      await call(
        '/claim',
        { answer: 'Animal 64', sessionToken: '1.' + sessionToken.split('.')[1] },
        a.cookie,
        'verified-network',
      )
    ).status,
  ).toBe(428);
  const state: any = await (await call('/me', undefined, a.cookie)).json();
  expect(state.file.dibs).toBe(1);
  expect(state.file.strikes).toBe(0);
});
it('redacts live records across bootstrap, ledger, certificates, summaries and sockets until the viewer closes', async () => {
  const owner = await account();
  let result: any;
  for (const answer of ['Animal 31', 'Animal 32', 'Animal 33']) {
    const r = await call(
      '/claim',
      { answer, turnstileToken: 'test' },
      owner.cookie,
      'privacy-owner',
    );
    expect(r.status).toBe(201);
    result = await r.json();
  }
  const viewer = await account();
  const forbidden = (
    await db.prepare('SELECT a.display FROM claims c JOIN answers a ON a.id=c.answer_id').all()
  ).results.map((r: any) => r.display);
  for (const path of [
    '/bootstrap',
    '/today',
    '/ledger?category=practice',
    '/certificate/' + result.claim.id,
    '/summary/' + result.file.summaryId,
    '/archive?id=practice',
  ]) {
    const r = await call(path, undefined, viewer.cookie);
    expect(r.status).toBe(200);
    const text = await r.text();
    for (const word of forbidden) expect(text).not.toContain(word);
  }
  const open = await mf.dispatchFetch('http://localhost/api/live', {
    headers: { origin: 'https://dibs.here', upgrade: 'websocket', cookie: viewer.cookie },
  });
  const ws = open.webSocket!;
  ws.accept();
  const received = new Promise<string>((resolve) =>
    ws.addEventListener('message', (e) => resolve(String(e.data)), { once: true }),
  );
  ws.send(JSON.stringify({ category: 'practice' }));
  const message = await received;
  for (const word of forbidden) expect(message).not.toContain(word);
  ws.close(1000);
  const full = await (await call('/ledger?category=practice', undefined, owner.cookie)).text();
  expect(full).toContain('Animal 31');
  const closedSummary: any = await (
    await call('/summary/' + result.file.summaryId, undefined, owner.cookie)
  ).json();
  expect(closedSummary.file.claims).toHaveLength(3);
  expect(closedSummary.file.claims[0].display).toBe('Animal 31');
});
it('makes records public after the category closes without relying on the viewer identity', async () => {
  const { canReveal } = await import('../worker/visibility');
  expect(
    await canReveal(new Request('https://dibs.here'), { DB: db, COOKIE_SECRET: 'test' } as any, {
      id: 'practice',
      date: '2020-01-01',
    }),
  ).toBe(true);
  expect(
    await canReveal(new Request('https://dibs.here'), { DB: db, COOKIE_SECRET: 'test' } as any, {
      id: 'practice',
      date: '2099-01-01',
    }),
  ).toBe(false);
});
