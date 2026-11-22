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
        return onRequest({ request, next: () => preview(kind)({ request, params: { id }, env: { API: env.API, ASSETS: { fetch: () => new Response(html, { headers: { 'content-type': 'text/html' } }) } } }) });
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
  ])
    await db.exec(
      readFileSync('migrations/' + file, 'utf8')
        .replace(/^--.*$/gm, '')
        .replace(/CREATE TRIGGER[\s\S]*?\nEND;/g, (m) => m.replace(/\n/g, ' '))
        .replace(/\n/g, ' '),
    );
  const date = registryDate();
  await db
    .prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)',
    )
    .bind('test', date, 'Animals', 'animals', 2200, dropAt(date), 'approved')
    .run();
  for (let i = 0; i < 70; i++) {
    await db
      .prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)')
      .bind('a' + i, 'test', 'animal' + i, 'Animal ' + i, '[]', 4)
      .run();
    await db
      .prepare('INSERT INTO answer_keys VALUES(?,?,?)')
      .bind('test', 'animal' + i, 'a' + i)
      .run();
  }
}, 30000);
afterAll(async () => {
  mkdirSync('review/round5', { recursive: true });
  writeFileSync('review/round5/d1-actions.json', JSON.stringify(evidence, null, 2));
  await mf?.dispose();
});
it('creates no D1 users or writes on page loads and cached polls', async () => {
  const first = await account();
  const next = await account();
  expect(first.today.category.name).toBe('Animals');
  expect((await db.prepare('SELECT COUNT(*) n FROM users').first()).n).toBe(0);
  expect(evidence.slice(-2).every((r) => r.writes === 0)).toBe(true);
  expect(evidence.at(-1).reads).toBe(0);
  await call('/ledger?category=test&since=0');
  await call('/ledger?since=900&category=test');
  expect(evidence.at(-1).reads).toBe(0);
  expect(next.rows).toEqual([]);
});
it('keeps the claim race safe behind the coordinator', async () => {
  const accounts = await Promise.all(Array.from({ length: 50 }, account));
  const responses = await Promise.all(
    accounts.map((a, i) =>
      call('/claim', { answer: 'Animal 0', turnstileToken: 'test' }, a.cookie, 'race' + i),
    ),
  );
  expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
  expect(responses.filter((r) => r.status === 409)).toHaveLength(49);
  const winner = responses.findIndex((r) => r.status === 201);
  const data = (await responses[winner].json()) as any;
  expect(data.me.claim.id).toBe(data.claim.id);
  const r = await call('/certificate/' + data.claim.id);
  expect(r.status).toBe(200);
  expect(evidence.at(-1).reads).toBe(0);
  const second = await call(
    '/claim',
    { answer: 'Animal 1', turnstileToken: 'test' },
    accounts[winner].cookie,
    'race-winner',
  );
  expect(second.status).toBe(201);
  const reloaded = (await (
    await call('/bootstrap', undefined, accounts[winner].cookie)
  ).json()) as any;
  expect(reloaded.me.file.dibs).toBe(2);
  const loser = accounts.find((_, i) => i !== winner)!;
  const lost = (await (await call('/bootstrap', undefined, loser.cookie)).json()) as any;
  expect(lost.me.file.strikes).toBe(1);
  expect((await db.prepare('SELECT COUNT(*) n FROM users').first()).n).toBe(1);
  const png = await call('/og/' + data.claim.id);
  expect(png.headers.get('content-type')).toBe('image/png');
  const bytes = await png.arrayBuffer();
  expect(bytes.byteLength).toBeGreaterThan(1000);
  const again = await call('/og/' + data.claim.id);
  expect(Buffer.from(await again.arrayBuffer())).toEqual(Buffer.from(bytes));
  expect(evidence.at(-1).reads).toBe(0);
  expect(evidence.at(-1).writes).toBe(0);
}, 30000);
it('enforces rerolls and attempts in SQLite DO storage with zero D1 writes', async () => {
  const a = await account();
  const rolls = await Promise.all(
    Array.from({ length: 5 }, () => call('/me/reroll', {}, a.cookie)),
  );
  expect(rolls.filter((r) => r.status === 200)).toHaveLength(3);
  expect(rolls.filter((r) => r.status === 403)).toHaveLength(2);
  const rs = await Promise.all(
    Array.from({ length: 13 }, () =>
      call('/claim', { answer: 'missing', turnstileToken: 'test' }, a.cookie),
    ),
  );
  expect(rs.filter((r) => r.status === 422)).toHaveLength(12);
  expect(rs.filter((r) => r.status === 429)).toHaveLength(1);
  expect(evidence.slice(-9).every((r) => r.writes === 0)).toBe(true);
});
it('uses one WebSocket connection and returns cursor-filtered real records', async () => {
  const r = await mf.dispatchFetch('http://localhost/api/live', {
    headers: { origin: 'https://dibs.here', upgrade: 'websocket' },
  });
  expect(r.status).toBe(101);
  const ws = r.webSocket!;
  ws.accept();
  const result = new Promise<any>((resolve) =>
    ws.addEventListener('message', (e) => resolve(JSON.parse(String(e.data))), { once: true }),
  );
  ws.send(JSON.stringify({ category: 'test', since: 900 }));
  const message = await result;
  expect(message.today.category.id).toBe('test');
  expect(message.rows).toEqual([]);
  ws.close(1000);
});
it('indexes privacy cleanup and measures its eventual writes', async () => {
  const plan = await db
    .prepare("EXPLAIN QUERY PLAN UPDATE claims SET ip_hash='' WHERE ip_day<? AND ip_hash!=''")
    .bind('2999-01-01')
    .all();
  expect(plan.results.some((r: any) => String(r.detail).includes('claims_privacy_cleanup'))).toBe(
    true,
  );
  const results = await db.batch([
    db.prepare("UPDATE claims SET ip_hash='' WHERE ip_day<? AND ip_hash!=''").bind('2999-01-01'),
    db.prepare('DELETE FROM rate_limits WHERE day<?').bind('2999-01-01'),
  ]);
  evidence.push({
    action: 'eventual privacy and IP quota cleanup per claim',
    status: 200,
    reads: results.reduce((n: number, r: any) => n + r.meta.rows_read, 0),
    writes: results.reduce((n: number, r: any) => n + r.meta.rows_written, 0),
  });
  expect(results.reduce((n: number, r: any) => n + r.meta.rows_written, 0)).toBeLessThanOrEqual(8);
});
it('invalidates cached certificates and every image shard when moderating', async () => {
  const row = await db.prepare('SELECT id,user_id FROM claims LIMIT 1').first();
  const before = Buffer.from(await (await call('/og/' + row.id)).arrayBuffer());
  const admin = (path: string, id: string) =>
    mf.dispatchFetch('http://localhost/api/admin/' + path, {
      method: 'POST',
      headers: {
        origin: 'https://dibs.here',
        authorization: 'Bearer local-admin',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });
  expect((await admin('hide-user', row.user_id)).status).toBe(200);
  expect(((await (await call('/certificate/' + row.id)).json()) as any).claim.handle).toBe(
    'Record withheld',
  );
  const after = Buffer.from(await (await call('/og/' + row.id)).arrayBuffer());
  expect(after.equals(before)).toBe(false);
  expect((await admin('void-claim', row.id)).status).toBe(200);
  expect((await call('/certificate/' + row.id)).status).toBe(404);
  expect((await call('/og/' + row.id)).status).toBe(404);
});
it('bounds cold full-ID and printed-prefix certificate reads', async () => {
  const id = '12345678-1234-4234-8234-123456789abc';
  await db
    .prepare('INSERT INTO users(id,handle,created_at) VALUES(?,?,?)')
    .bind('cold-user', 'Amber Badger #123', new Date().toISOString())
    .run();
  await db
    .prepare(
      'INSERT INTO claims(id,category_id,answer_id,user_id,claim_no,created_at,ip_hash,ip_day) VALUES(?,?,?,?,?,?,?,?)',
    )
    .bind(id, 'test', 'a69', 'cold-user', 3, new Date().toISOString(), 'cold-hash', '2026-11-21')
    .run();
  expect((await call('/certificate/' + id)).status).toBe(200);
  expect(evidence.at(-1).reads).toBeLessThanOrEqual(10);
  expect((await call('/certificate/' + id.slice(0, 16))).status).toBe(200);
  expect(evidence.at(-1).reads).toBeLessThanOrEqual(10);
});
it('orders completed real files by dibs, strikes, then completion time', async () => {
  const players = await Promise.all(Array.from({ length: 3 }, account));
  for (let p = 0; p < 3; p++) {
    if (p === 0)
      expect(
        (await call('/claim', { answer: 'Animal 0', turnstileToken: 'test' }, players[p].cookie))
          .status,
      ).toBe(409);
    for (let i = 0; i < 3; i++)
      expect(
        (
          await call(
            '/claim',
            { answer: 'Animal ' + (30 + p * 3 + i), turnstileToken: 'test' },
            players[p].cookie,
            'board-' + p,
          )
        ).status,
      ).toBe(201);
  }
  const today = (await (await call('/today')).json()) as any;
  expect(today.board.map((r: any) => r.handle)).toEqual([
    players[1].me.user.handle,
    players[2].me.user.handle,
    players[0].me.user.handle,
  ]);
  expect(today.board.map((r: any) => [r.dibs, r.strikes])).toEqual([
    [3, 0],
    [3, 0],
    [3, 1],
  ]);
  const me = (await (await call('/me', undefined, players[0].cookie)).json()) as any;
  expect(me.file.events.map((e: any) => e.kind)).toEqual(['strike', 'dibs', 'dibs', 'dibs']);
  expect(me.file.closed).toBe(true);
  summaryId = me.file.summaryId;
  certificateId = me.file.claims[0].id;
  expect(summaryId).toMatch(/^[a-f0-9]{40}$/);
  const shared = (await (await call('/summary/' + summaryId)).json()) as any;
  expect(shared.file.dibs).toBe(3);
  expect(shared.file.strikes).toBe(1);
  expect(shared.file.summaryId).toBe(summaryId);
  expect(JSON.stringify(shared)).not.toContain(players[0].me.user.id);
  expect(
    (await call('/claim', { answer: 'Animal 60', turnstileToken: 'test' }, players[0].cookie))
      .status,
  ).toBe(403);
});

it('counts platform-only taps and arrivals anonymously, with zero D1 writes', async () => {
  for (const platform of [
    'native',
    'x',
    'whatsapp',
    'facebook',
    'instagram-tiktok',
    'copy-link',
    'copy-text',
    'story',
    'feed',
  ]) {
    expect((await call('/events/share', { platform })).status).toBe(200);
    expect((await call('/events/arrival', { platform })).status).toBe(200);
    expect(evidence.at(-1).writes).toBe(0);
  }
  expect((await call('/events/share', { platform: 'unknown' })).status).toBe(422);
  expect((await call('/events/share', { platform: 'x', user: 'not allowed' })).status).toBe(422);
  const stats = await mf.dispatchFetch('http://localhost/api/admin/stats', {
    headers: { origin: 'https://dibs.here', authorization: 'Bearer local-admin' },
  });
  const data = (await stats.json()) as any;
  expect(data.platforms).toHaveLength(9);
  expect(data.platforms.every((p: any) => p.shares === 1 && p.arrivals === 1)).toBe(true);
});
it('serves unique cached previews to WhatsApp, X, Facebook, iMessage and Discord fetchers', async () => {
  const agents = {
    WhatsApp: 'WhatsApp/2.24.22.79 A',
    X: 'Twitterbot/1.0',
    Facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    iMessage:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    Discord: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  };
  const results: any[] = [];
  const pages = await mf.getWorker('pages-test');
  for (const [kind, id] of [
    ['certificate', certificateId],
    ['summary', summaryId],
  ]) {
    let original: Buffer | undefined;
    for (const [platform, agent] of Object.entries(agents)) {
      const page = await pages.fetch(`${PUBLIC_ORIGIN}/${kind}/${id}?s=x`, {
        headers: { 'user-agent': agent },
      });
      expect(page.status, await page.clone().text()).toBe(200);
      expect(page.headers.get('content-security-policy')).toContain("style-src 'self'");
      expect(page.headers.get('strict-transport-security')).toBe(
        'max-age=31536000; includeSubDomains',
      );
      const html = await page.text();
      expect(html).not.toMatch(/Animal [0-9]|localhost/);
      expect(html).toContain('summary_large_image');
      const image = html.match(/property="og:image" content="([^"]+)"/)![1];
      expect(html).toContain(`name="twitter:image" content="${image}"`);
      expect(image).toBe(
        `${PUBLIC_ORIGIN}/api/og/${kind === 'summary' ? 'summary/' : ''}${id}?v=4`,
      );
      const started = performance.now();
      const response = await mf.dispatchFetch(image, { headers: { 'user-agent': agent } });
      const bytes = Buffer.from(await response.arrayBuffer());
      const elapsed = performance.now() - started;
      expect(response.status).toBe(200);
      expect(bytes.length).toBeLessThan(300000);
      expect(elapsed).toBeLessThan(2000);
      const png = PNG.sync.read(bytes);
      expect([png.width, png.height]).toEqual([1200, 630]);
      if (original) expect(bytes.equals(original)).toBe(true);
      original = bytes;
      results.push({
        kind,
        platform,
        bytes: bytes.length,
        milliseconds: Math.round(elapsed),
        status: response.status,
      });
      mkdirSync('review/final', { recursive: true });
      writeFileSync(`review/final/${kind}-og.png`, bytes);
    }
  }
  mkdirSync('review/round5', { recursive: true });
  writeFileSync('review/round5/preview-fetches.json', JSON.stringify(results, null, 2));
});

it('keeps a zero-dibs five-strike summary across reloads without creating a D1 player', async () => {
  const player = await account();
  for (let i = 0; i < 5; i++)
    expect(
      (await call('/claim', { answer: 'Animal 30', turnstileToken: 'test' }, player.cookie)).status,
    ).toBe(409);
  const reloaded = (await (await call('/me', undefined, player.cookie)).json()) as any;
  expect(reloaded.file.closed).toBe(true);
  expect(reloaded.file.dibs).toBe(0);
  expect(reloaded.file.strikes).toBe(5);
  const shared = (await (await call('/summary/' + reloaded.file.summaryId)).json()) as any;
  expect(shared.file.claims).toEqual([]);
  expect(shared.file.strikes).toBe(5);
  expect(
    await db.prepare('SELECT id FROM users WHERE id=?').bind(player.me.user.id).first(),
  ).toBeNull();
});
it('invalidates public summaries and PNGs after a claim is voided', async () => {
  const before = (await (await call('/summary/' + summaryId)).json()) as any;
  expect(before.file.claims).toHaveLength(3);
  const response = await mf.dispatchFetch('http://localhost/api/admin/void-claim', {
    method: 'POST',
    headers: {
      origin: 'https://dibs.here',
      authorization: 'Bearer local-admin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ id: certificateId }),
  });
  expect(response.status).toBe(200);
  const after = (await (await call('/summary/' + summaryId)).json()) as any;
  expect(after.file.claims).toHaveLength(2);
  expect(after.file.claims.map((c: any) => c.id)).not.toContain(certificateId);
  expect(after.file.closed).toBe(true);
});

it('locks admin attempts per IP hash, preserves other IPs, and rate limits event floods', async () => {
  const adminCall = (ip: string, token: string) =>
    mf.dispatchFetch('http://localhost/api/admin/stats', {
      headers: { authorization: 'Bearer ' + token, 'x-test-ip': ip },
    });
  const attempts = await Promise.all(
    Array.from({ length: 10 }, () => adminCall('admin-lock-test', 'wrong')),
  );
  expect(attempts.every((r) => r.status === 404)).toBe(true);
  expect((await adminCall('admin-lock-test', 'local-admin')).status).toBe(404);
  expect((await adminCall('admin-other-ip', 'local-admin')).status).toBe(200);
  const floods = await Promise.all(
    Array.from({ length: 31 }, () =>
      call('/events/share', { platform: 'copy-link' }, undefined, 'event-limit-test'),
    ),
  );
  expect(floods.filter((r) => r.status === 200)).toHaveLength(30);
  expect(floods.filter((r) => r.status === 429)).toHaveLength(1);
  for (const path of ['/api/events/share', '/api/claim', '/api/admin/approve']) {
    const r = await mf.dispatchFetch('http://localhost' + path, { method: 'POST', body: '{}' });
    expect(r.status).toBe(path.includes('/admin/') ? 404 : 403);
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
    expect(r.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
  }
});

it('keeps redirects, cached APIs, and rejected requests inside the security headers', async () => {
  for (const origin of ['http://dibs.here', 'https://dibs-api.dibs-registry.workers.dev']) {
    const r = await mf.dispatchFetch(origin + '/api/today?v=5', { redirect: 'manual' });
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://dibs.here/api/today?v=5');
    expect(r.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  }
  for (let i = 0; i < 2; i++) {
    const r = await call('/today');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(r.headers.get('permissions-policy')).toContain('usb=()');
  }
  const pages = await mf.getWorker('pages-test');
  const r = await pages.fetch('https://www.dibs.here/certificate/example-id?s=x', {
    redirect: 'manual',
  });
  expect(r.status).toBe(301);
  expect(r.headers.get('location')).toBe('https://dibs.here/certificate/example-id?s=x');
  expect(r.headers.get('x-content-type-options')).toBe('nosniff');
});
