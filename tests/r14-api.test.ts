import { beforeAll, afterAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PUBLIC_ORIGIN } from '../shared/config';
import { PNG } from 'pngjs';
import { registryDate, dropAt } from '../worker/domain';
let mf: Miniflare, db: any;
let summaryId: string, certificateId: string, summaryViewer: string;
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

  await db.exec(
    readFileSync('migrations/0014_shared_networks.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  await db.exec(readFileSync('migrations/0017_day_rules.sql', 'utf8').replace(/^--.*$/gm, '').replace(/\n/g, ' '));
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
  mkdirSync('review/round14', { recursive: true });
  writeFileSync('review/round14/d1-actions.json', JSON.stringify(evidence, null, 2));
  await mf?.dispose();
});
let first: any, second: any, firstClaim: any, summary: string;
const won: any[] = [];
async function play(player: any, number: number, extra = {}) {
  const r = await call(
    '/claim',
    {
      answer: 'Animal ' + number,
      turnstileToken: 'test',
      requestId: crypto.randomUUID(),
      ...extra,
    },
    player.cookie,
    'r14-' + player.me.user.id,
  );
  const data: any = await r.json();
  return { status: r.status, data };
}
const admin = (path: string, data: any) =>
  mf.dispatchFetch('http://localhost/api/admin/' + path, {
    method: 'POST',
    headers: {
      origin: PUBLIC_ORIGIN,
      authorization: 'Bearer local-admin',
      'content-type': 'application/json',
    },
    body: JSON.stringify(data),
  });
it('scores server-side at claim time, adds golden +100, and ignores submitted points', async () => {
  first = await account();
  second = await account();
  const special = await db
    .prepare('SELECT golden_json FROM daily_specials WHERE category_id=?')
    .bind('test')
    .first();
  const golden = JSON.parse(special.golden_json).map((id: string) => Number(id.slice(1)));
  const normal = Array.from({ length: 69 }, (_, i) => i).find((i) => !golden.includes(i))!;
  const body = { requestId: crypto.randomUUID(), points: 999999, percentile: 1, bonus: 100 };
  const a = await play(first, normal, body);
  expect(a.status).toBe(201);
  firstClaim = a.data.claim;
  expect(a.data.claim).toMatchObject({ points: 50, bonus: 0, percentile: null });
  expect(a.data.file.points).toBe(50);
  expect(a.data.me.file.rank).toBe(1);
  const replay = await play(first, normal, body);
  expect(replay.status).toBe(201);
  expect(replay.data.claim.points).toBe(50);
  expect(replay.data.file.dibs).toBe(1);
  const g = await play(second, golden[0]);
  expect(g.status).toBe(201);
  expect(g.data.claim).toMatchObject({ points: 150, bonus: 100, golden: 1 });
  expect(g.data.file.points).toBe(150);
  won.push(normal, golden[0]);
  const row = await db
    .prepare('SELECT points,percentile,bonus FROM claims WHERE id=?')
    .bind(firstClaim.id)
    .first();
  expect(row).toEqual({ points: 50, percentile: null, bonus: 0 });
  await db
    .prepare('UPDATE answers SET obscurity=1 WHERE id=?')
    .bind('a' + normal)
    .run();
  const after: any = await (await call('/me', undefined, first.cookie)).json();
  expect(after.file.claims[0].points).toBe(50);
});
it('deducts taken and reserved strikes, floors at zero, and excludes strike-only players from the claimants rank', async () => {
  const taken = await play(first, won[1]);
  expect(taken.status).toBe(409);
  expect(taken.data.file.points).toBe(40);
  await db
    .prepare('INSERT INTO house_words(category_id,answer_id) VALUES(?,?)')
    .bind('test', 'a69')
    .run();
  const reserved = await play(first, 69);
  expect(reserved.status).toBe(409);
  expect(reserved.data.house).toBe(true);
  expect(reserved.data.file.points).toBe(30);
  const loser = await account();
  const r = await play(loser, won[0]);
  expect(r.data.file.points).toBe(0);
  const board: any = await (await call('/leaderboard', undefined, loser.cookie)).json();
  expect(board.own).toBeNull();
  const reroll = await call('/me/reroll', {}, loser.cookie);
  expect(reroll.status).toBe(200);
  const renamed: any = await reroll.json();
  const after: any = await (await call('/leaderboard', undefined, loser.cookie)).json();
  expect(after.own).toBeNull();
  const renamedMe: any = await (await call('/me', undefined, loser.cookie)).json();
  expect(renamedMe.user.handle).toBe(renamed.user.handle);
  expect(renamedMe.file.points).toBe(0);
});
it('never leaks other answers through leaderboard, completed-viewer ledger, socket, summary or HTML', async () => {
  for (const n of [60, 61]) {
    const r = await play(first, n);
    expect(r.status).toBe(201);
    summary = r.data.file.summaryId;
  }
  const current: any = await (await call('/me', undefined, first.cookie)).json();
  expect(current.file.closed).toBe(true);
  for (const path of ['/leaderboard', '/ledger?category=test', '/summary/' + summary]) {
    const r = await call(path, undefined, first.cookie);
    expect(r.status).toBe(200);
    expect(await r.text()).not.toMatch(/Animal [0-9]/);
  }
  const ownCertificate: any = await (
    await call('/certificate/' + firstClaim.id, undefined, first.cookie)
  ).json();
  expect(ownCertificate.claim.display).toBe(firstClaim.display);
  expect(ownCertificate.claim.owned).toBe(true);
  expect(await (await call('/certificate/' + firstClaim.id)).text()).not.toMatch(/Animal [0-9]/);
  const pages = await mf.getWorker('pages-test');
  const html = await (await pages.fetch(PUBLIC_ORIGIN + '/summary/' + summary)).text();
  expect(html).not.toMatch(/Animal [0-9]/);
  const r = await mf.dispatchFetch('http://localhost/api/live', {
    headers: { origin: PUBLIC_ORIGIN, upgrade: 'websocket', cookie: first.cookie },
  });
  const ws = r.webSocket!;
  ws.accept();
  const received = new Promise<any>((resolve) =>
    ws.addEventListener('message', (e) => resolve(JSON.parse(String(e.data))), { once: true }),
  );
  ws.send(JSON.stringify({ category: 'test' }));
  const data = await received;
  expect(data.rows).toEqual([]);
  expect(JSON.stringify(data.leaderboard)).not.toMatch(/Animal [0-9]/);
  // A player's private me record can contain their own guesses, never another player's claim.
  expect(
    (data.me?.file?.claims || []).every((c: any) =>
      current.file.claims.some((own: any) => own.id === c.id),
    ),
  ).toBe(true);
  ws.close(1000);
});
it('returns 25 real rows plus own rank and makes repeated polling cost zero D1 reads or writes', async () => {
  let last: any;
  for (let n = 10; n < 40; n++) {
    if (won.includes(n)) continue;
    const a = await account();
    const r = await play(a, n);
    expect(r.status).toBe(201);
    last = a;
  }
  // A successful claim with a strike ranks below every unpenalized claim.
  const specials = await db
    .prepare('SELECT golden_json FROM daily_specials WHERE category_id=?')
    .bind('test')
    .first();
  const goldens = JSON.parse(specials.golden_json).map((id: string) => Number(id.slice(1)));
  const ordinary = Array.from({ length: 29 }, (_, i) => i + 40).find(
    (n) => n !== 50 && !won.includes(n) && !goldens.includes(n),
  )!;
  const outsider = await account();
  expect((await play(outsider, ordinary)).status).toBe(201);
  await play(outsider, won[0]);
  const board: any = await (await call('/leaderboard', undefined, outsider.cookie)).json();
  expect(board.rows).toHaveLength(25);
  expect(board.own.rank).toBeGreaterThan(25);
  for (let i = 0; i < 10; i++) await call('/leaderboard', undefined, last.cookie);
  expect(evidence.slice(-10).every((e) => e.reads === 0 && e.writes === 0)).toBe(true);
});
it('uses the real founder name without changing points and preserves withdrawn scores anonymously', async () => {
  const a = await account();
  const win = await play(a, 50);
  expect(win.status).toBe(201);
  expect(
    (await admin('set-founder', { target: a.me.user.id, name: 'Practice Founder' })).status,
  ).toBe(200);
  let board: any = await (await call('/leaderboard', undefined, a.cookie)).json();
  expect(board.own).toMatchObject({
    handle: 'Practice Founder',
    founder: true,
    points: win.data.file.points,
  });
  const deleted = await call(
    '/delete-file',
    { confirm: 'DELETE MY FILE', turnstileToken: 'test' },
    a.cookie,
  );
  expect(deleted.status).toBe(200);
  const rows: any = await (await call('/leaderboard')).json();
  expect(JSON.stringify(rows)).not.toContain('Practice Founder');
  const withdrawn = await db
    .prepare("SELECT id FROM users WHERE provider_subject LIKE 'withdrawn:%'")
    .first();
  expect(withdrawn).toBeTruthy();
  // All rows (including a low-ranked withdrawn filer) remain in the final cache, not an old handle.
  const cert: any = await (await call('/certificate/' + win.data.claim.id)).json();
  expect(cert.claim.handle).toBe('Withdrawn player');
  expect(cert.claim.points).toBe(win.data.claim.points); // Points are public; answer rarity remains sealed.
  expect(cert.claim).not.toHaveProperty('percentile');
  expect(
    (await db.prepare('SELECT points FROM claims WHERE id=?').bind(win.data.claim.id).first())
      .points,
  ).toBe(win.data.claim.points);
});
it('excludes hidden users and every file with a voided claim immediately', async () => {
  expect((await admin('hide-user', { id: second.me.user.id })).status).toBe(200);
  let board: any = await (await call('/leaderboard', undefined, second.cookie)).json();
  expect(board.own).toBeNull();
  expect(JSON.stringify(board)).not.toContain(second.me.user.handle);
  expect((await admin('void-claim', { id: firstClaim.id })).status).toBe(200);
  board = await (await call('/leaderboard', undefined, first.cookie)).json();
  expect(board.own).toBeNull();
});
it('returns an archived final top 10 with the same score order and unlocks the past ledger', async () => {
  await db
    .prepare(
      "INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES('past','2020-01-01','Past practice','practice',2200,'2020-01-02T02:00:00Z','approved')",
    )
    .run();
  const players = await db
    .prepare('SELECT id FROM users WHERE hidden=0 ORDER BY id LIMIT 12')
    .all();
  for (const [i, player] of players.results.entries()) {
    await db
      .prepare('INSERT INTO answers(id,category_id,canonical,display) VALUES(?,?,?,?)')
      .bind('past-' + i, 'past', 'past answer ' + i, 'Past answer ' + i)
      .run();
    await db
      .prepare(
        `INSERT INTO claims(id,category_id,answer_id,user_id,claim_no,created_at,ip_hash,ip_day,points)
      VALUES(?,?,?,?,?,'2020-01-02T02:01:00Z',?,'2020-01-01',?)`,
      )
      .bind('past-claim-' + i, 'past', 'past-' + i, player.id, i + 1, 'past-ip-' + i, 50 + i * 5)
      .run();
  }
  const r: any = await (await call('/leaderboard?category=past&limit=10')).json();
  expect(r).toMatchObject({ total: 12, final: true });
  expect(r.rows).toHaveLength(10);
  expect(r.rows.map((row: any) => row.points)).toEqual([105, 100, 95, 90, 85, 80, 75, 70, 65, 60]);
  const ledger: any = await (await call('/ledger?category=past')).json();
  expect(ledger.locked).toBeUndefined();
});
