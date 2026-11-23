import { assertPublicPayload, shapes } from './public-payload-schema';
import { visibleClaim } from '../worker/visibility';
import { readCategory } from '../scripts/category-file';
import { it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { registryDate, dropAt } from '../worker/domain';
let mf: Miniflare, db: any, options: any;
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
    stdin: {
      contents: `import worker from './worker/index'; const realNow=Date.now;let clock;Date.now=()=>clock??realNow(); export {Registry, ImageCache, DayRegistry} from './worker/index'; export default {fetch(req,env,ctx){const instant=new URL(req.url).searchParams.get('fixture-now');if(instant)clock=Number(instant);const date=new URL(req.url).searchParams.get('fixture-day'); if(date){const headers=new Headers(req.headers);headers.set('x-r17-day',date);return env.DAY_REGISTRY.get(env.DAY_REGISTRY.idFromName(date)).fetch(new Request(req,{headers}));}return worker.fetch(req,env,ctx);}};`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    external: ['cloudflare:workers'],
    loader: { '.wasm': 'binary', '.woff': 'binary', '.otf': 'binary' },
  });
  options = convertV4MiniflareOptions({
    workers: [
      {
        name: 'static-test',
        modules: true,
        script: code.outputFiles[0].text,
        compatibilityDate: '2026-11-20',
        d1Databases: ['DB', 'PRESERVE'],
        durableObjects: {
          REGISTRY: { className: 'Registry', useSQLite: true },
          DAY_REGISTRY: { className: 'DayRegistry', useSQLite: true },
          IMAGE_CACHE: { className: 'ImageCache', useSQLite: true },
        },
        bindings: {
          LOCAL_TEST: 'true',
          R17_STORAGE: 'true',
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
  });
  mf = new Miniflare(options);
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
const catalog = readCategory('categories/animals.json');
async function account() {
  const r = await call('/bootstrap');
  expect(r.status).toBe(200);
  return { cookie: r.headers.get('set-cookie')!.split(';')[0], data: (await r.json()) as any };
}
async function guess(cookie: string, answer: string, requestId = crypto.randomUUID()) {
  const r = await call('/claim', { answer, turnstileToken: 'test', requestId }, cookie);
  return { status: r.status, data: (await r.json()) as any, requestId };
}
let winner: any, claim: any, last: any;
it('has exactly one durable winner under contention before any D1 mirror', async () => {
  const players = await Promise.all(Array.from({ length: 30 }, () => account()));
  const results = await Promise.all(
    players.map((p) => guess(p.cookie, catalog.answers[120].display)),
  );
  expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  expect(results.filter((r) => r.status === 409)).toHaveLength(29);
  const index = results.findIndex((r) => r.status === 201);
  winner = players[index];
  claim = results[index].data.claim;
  last = results[index];
  expect((await db.prepare('SELECT COUNT(*) n FROM r17_files').first()).n).toBe(0);
  expect((await db.prepare('SELECT COUNT(*) n FROM claims').first()).n).toBe(0);
}, 30000);
it('restarts the actual runtime, retains the winner, points and idempotency without a mirror', async () => {
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  const me: any = await (await call('/me', undefined, winner.cookie)).json();
  expect(me.file.claims.map((c: any) => c.id)).toEqual([claim.id]);
  expect(me.file.points).toBe(claim.points);
  const replay = await guess(winner.cookie, catalog.answers[120].display, last.requestId);
  expect(replay.status).toBe(201);
  expect(replay.data.replayed).toBe(true);
  expect(replay.data.claim.id).toBe(claim.id);
  const late = await account();
  expect((await guess(late.cookie, catalog.answers[120].display)).status).toBe(409);
}, 30000);
it('keeps certificate ownership private, while owner sees stored rarity', async () => {
  const own: any = await (await call('/certificate/' + claim.id, undefined, winner.cookie)).json();
  expect(own.claim.display).toBe(claim.display);
  expect(own.claim.percentile).toBe(claim.percentile);
  expect(own.claim.owned).toBe(true);
  const other = await account();
  const publicResponse = await call('/certificate/' + claim.id, undefined, other.cookie);
  const text = await publicResponse.text();
  expect(text).not.toContain(claim.display);
  const data = JSON.parse(text);
  expect(data.claim).not.toHaveProperty('percentile');
  expect(data.claim.concealed).toBe(true);
  expect(await (await call('/leaderboard', undefined, other.cookie)).text()).not.toContain(
    claim.display,
  );
  expect(((await (await call('/ledger?category=static')).json()) as any).rows).toEqual([]);
});
it('resolves the literal full and legacy short certificate URLs before the D1 mirror', async () => {
  for (const id of [claim.id, claim.id.slice(0, 16)]) {
    const response = await call('/certificate/' + id, undefined, winner.cookie);
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).claim.id).toBe(claim.id);
    const anonymous = await call('/certificate/' + id);
    expect(((await anonymous.json()) as any).claim.concealed).toBe(true);
  }
});
it('mirrors a complete game in batches, preserving exact state and scores after another restart', async () => {
  for (const answer of [
    catalog.answers[0].display,
    catalog.answers[0].display,
    catalog.answers[0].display,
    catalog.answers[121].display,
    catalog.answers[122].display,
  ])
    last = await guess(winner.cookie, answer);
  expect(last.status).toBe(201);
  expect(last.data.file.closed).toBe(true);
  expect(last.data.file.strikes).toBe(3);
  expect(last.data.file.dibs).toBe(3);
  const flush = await mf.dispatchFetch('http://localhost/api/admin/r17-flush', {
    method: 'POST',
    headers: { origin: 'https://dibs.here', authorization: 'Bearer static-test-admin' },
  });
  expect(flush.status).toBe(200);
  const mirrored = JSON.parse(
    (
      await db
        .prepare('SELECT data FROM r17_files WHERE user_id=?')
        .bind(winner.data.me.user.id)
        .first()
    ).data,
  );
  expect(
    mirrored.file.claims.map((c: any) => JSON.parse(JSON.stringify(visibleClaim(c, false, true)))),
  ).toEqual(last.data.file.claims);
  expect(mirrored.file.events).toEqual(last.data.file.events);
  expect(mirrored.file.points).toBe(last.data.file.points);
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  const restored: any = await (await call('/me', undefined, winner.cookie)).json();
  expect(restored.file.claims).toEqual(last.data.file.claims);
  expect(restored.file.points).toBe(last.data.file.points);
  expect(restored.streak).toBe(1);
}, 30000);
it('persists explicit owner sharing and never grants another viewer permission or reveals struck guesses', async () => {
  const other = await account();
  const summary = '/summary/' + last.data.file.summaryId;
  for (const path of ['/certificate/' + claim.id, summary]) {
    expect((await call(path, { showAnswers: true }, other.cookie)).status).toBe(403);
    expect((await call(path, { showAnswers: true }, winner.cookie)).status).toBe(200);
  }
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  const sharedClaim: any = await (await call('/certificate/' + claim.id)).json();
  expect(sharedClaim.claim.display).toBe(claim.display);
  expect(sharedClaim.claim.sharedAnswers).toBe(true);
  const shared: any = await (await call(summary)).json();
  expect(shared.file.claims.map((c: any) => c.display)).toContain(claim.display);
  for (const event of shared.file.events.filter((e: any) => e.kind === 'strike'))
    expect(event).not.toHaveProperty('display');
  expect(JSON.stringify(shared)).not.toMatch(/answer_id|user_id|sharedClaimIds/);
  expect(await (await call('/leaderboard')).text()).not.toContain(claim.display);
  for (const path of ['/certificate/' + claim.id, summary])
    expect((await call(path, { showAnswers: false }, winner.cookie)).status).toBe(200);
  expect(await (await call(summary)).text()).not.toContain(claim.display);
  expect(((await (await call('/certificate/' + claim.id)).json()) as any).claim.concealed).toBe(
    true,
  );
});
let nextDate: string, nextClaim: any;
async function direct(date: string, path: string, data?: any, cookie = winner.cookie) {
  return mf.dispatchFetch('http://localhost/api' + path + '?fixture-day=' + date, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      origin: 'https://dibs.here',
      'content-type': 'application/json',
      cookie,
      authorization: 'Bearer static-test-admin',
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
it('R19B exposes only allowed pre-close fields across anonymous and signed public reads', async () => {
  const other = await account();
  const summary = '/summary/' + last.data.file.summaryId;
  const allowedClaim = new Set([
    'id',
    'category_id',
    'claim_no',
    'handle',
    'created_at',
    'category_name',
    'category_date',
    'category_slug',
    'total_registrable',
    'founder',
    'streak',
    'concealed',
    'revealed',
    'owned',
    'points',
  ]);
  const allowedFile = new Set([
    'category_id',
    'summaryId',
    'dibs',
    'strikes',
    'closed',
    'completedAt',
    'points',
    'rank',
    'players',
    'streak',
    'handle',
    'founder',
    'revealed',
    'claims',
    'events',
    'comparison',
  ]);
  for (const cookie of ['', other.cookie, winner.cookie]) {
    const data: any = await (await call(summary, undefined, cookie)).json();
    assertPublicPayload(data, shapes.summary);
    for (const key of Object.keys(data.file)) expect(allowedFile.has(key), key).toBe(true);
    for (const c of data.file.claims)
      for (const key of Object.keys(c)) expect(allowedClaim.has(key), key).toBe(true);
    for (const e of data.file.events) expect(Object.keys(e).sort()).toEqual(['at', 'kind']);
    expect(JSON.stringify(data)).not.toMatch(
      /answer_id|user_id|"display"|"golden"|"bonus"|"obscurity"/,
    );
    for (const c of data.file.claims) expect(c).not.toHaveProperty('percentile');
  }
  for (const path of [
    '/ledger?category=static',
    '/leaderboard',
    '/bootstrap',
    '/certificate/' + claim.id,
  ]) {
    const data: any = await (await call(path, undefined, other.cookie)).json();
    assertPublicPayload(data, shapes[path.split(/[/?]/)[1]]);
    expect(JSON.stringify(data)).not.toMatch(/answer_id|user_id|"display"/);
  }
});
it('R19B rejects malformed codes cheaply and shares durable throttling between recover and delete', async () => {
  for (const path of ['/recover', '/delete-file']) {
    const r = await call(path, { key: 'bad' }, undefined, '192.0.2.240');
    expect(r.status).toBe(422);
    expect(r.headers.get('x-d1-rows-read')).toBe('0');
  }
  for (let i = 0; i < 5; i++)
    expect(
      (
        await call(
          i % 2 ? '/recover' : '/delete-file',
          { key: 'DIBS-AAAAA-BBBBB-CCCCC-DDDDD' },
          undefined,
          '192.0.2.241',
        )
      ).status,
    ).toBe(422);
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  for (const path of ['/recover', '/delete-file'])
    expect(
      (await call(path, { key: 'DIBS-AAAAA-BBBBB-CCCCC-DDDDD' }, undefined, '192.0.2.241')).status,
    ).toBe(429);
  expect(
    (await call('/recover', { key: 'DIBS-AAAAA-BBBBB-CCCCC-DDDDD' }, undefined, '192.0.2.242'))
      .status,
  ).toBe(422);
});
it('R19B bounds anonymous sockets and same-identity connections without blocking a shared network', async () => {
  const open = async (cookie?: string) =>
    mf.dispatchFetch('http://localhost/api/live', {
      headers: {
        origin: 'https://dibs.here',
        upgrade: 'websocket',
        'x-test-ip': '192.0.2.243',
        ...(cookie ? { cookie } : {}),
      },
    });
  const held: any[] = [];
  try {
    for (let i = 0; i < 4; i++) {
      const r = await open();
      expect(r.status).toBe(101);
      r.webSocket!.accept();
      held.push(r.webSocket);
    }
    expect((await open()).status).toBe(429);
    for (let i = 0; i < 12; i++) {
      const p = await account();
      const r = await open(p.cookie);
      expect(r.status).toBe(101);
      r.webSocket!.accept();
      held.push(r.webSocket);
    }
  } finally {
    held.forEach((ws) => ws.close());
  }
});

it('keeps streak and recovery identity across the next drop', async () => {
  nextDate = new Date(Date.parse(registryDate() + 'T12:00:00Z') + 86400000)
    .toISOString()
    .slice(0, 10);
  const original = await db.prepare('SELECT * FROM categories WHERE id=?').bind('static').first();
  await db
    .prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status,source_json) VALUES(?,?,?,?,?,?,?,?)',
    )
    .bind(
      'second',
      nextDate,
      original.name,
      original.slug,
      original.total_registrable,
      new Date(Date.now() - 1000).toISOString(),
      'approved',
      original.source_json,
    )
    .run();
  const boot: any = await (await direct(nextDate, '/bootstrap')).json();
  expect(boot.me.user.id).toBe(winner.data.me.user.id);
  const won = await direct(nextDate, '/claim', {
    answer: catalog.answers[130].display,
    turnstileToken: 'test',
    requestId: crypto.randomUUID(),
  });
  expect(won.status).toBe(201);
  const result: any = await won.json();
  nextClaim = result.claim;
  expect(result.file.streak).toBe(2);
  expect((await direct(nextDate, '/admin/r17-flush', {})).status).toBe(200);
  const recovered = await call('/recover', { key: result.recoveryKey });
  expect(recovered.status).toBe(200);
  expect(recovered.headers.get('set-cookie')).toContain(winner.data.me.user.id);
}, 30000);
it('anonymises durable copies and mirror, retaining ownership after restart', async () => {
  const removed = await call(
    '/delete-file',
    { confirm: 'DELETE MY FILE', turnstileToken: 'test' },
    winner.cookie,
  );
  expect(removed.status).toBe(200);
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  const certificate: any = await (await call('/certificate/' + claim.id)).json();
  expect(certificate.claim.handle).toBe('Withdrawn player');
  const next: any = await (
    await direct(nextDate, '/certificate/' + nextClaim.id, undefined, '')
  ).json();
  expect(next.claim.handle).toBe('Withdrawn player');
  const late = await account();
  expect((await guess(late.cookie, claim.display)).status).toBe(409);
  expect(
    (
      await db
        .prepare('SELECT COUNT(*) n FROM r17_players WHERE id=?')
        .bind(winner.data.me.user.id)
        .first()
    ).n,
  ).toBe(0);
  const mirrors = await db.prepare('SELECT data FROM r17_files').all();
  expect(JSON.stringify(mirrors)).not.toContain(winner.data.me.user.id);
}, 30000);

it('rejects invalid verification, changed replay answers and cross-origin writes', async () => {
  const p = await account();
  const failed = await call(
    '/claim',
    { answer: catalog.answers[140].display, turnstileToken: '' },
    p.cookie,
  );
  expect(failed.status).toBe(428);
  const requestId = crypto.randomUUID();
  expect((await guess(p.cookie, catalog.answers[140].display, requestId)).status).toBe(201);
  expect((await guess(p.cookie, catalog.answers[141].display, requestId)).status).toBe(422);
  const forbidden = await mf.dispatchFetch('http://localhost/api/claim', {
    method: 'POST',
    headers: {
      origin: 'https://example.com',
      cookie: p.cookie,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ answer: catalog.answers[141].display, turnstileToken: 'test' }),
  });
  expect(forbidden.status).toBe(403);
});

it('propagates founder-by-backup, voiding and hiding into the durable day', async () => {
  const p = await account();
  const first = await guess(p.cookie, catalog.answers[150].display);
  const admin = async (path: string, data: any) =>
    mf.dispatchFetch('http://localhost/api/admin/' + path, {
      method: 'POST',
      headers: {
        origin: 'https://dibs.here',
        authorization: 'Bearer static-test-admin',
        'content-type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  expect(
    (await admin('set-founder', { target: first.data.recoveryKey, name: 'THE REGISTRAR' })).status,
  ).toBe(200);
  const owned: any = await (
    await call('/certificate/' + first.data.claim.id, undefined, p.cookie)
  ).json();
  expect(owned.claim.handle).toBe('THE REGISTRAR');
  expect(owned.claim.founder).toBe(true);
  expect((await admin('void-claim', { id: first.data.claim.id })).status).toBe(200);
  const board: any = await (await call('/leaderboard', undefined, p.cookie)).json();
  expect(board.own).toBeNull();
  const second = await account();
  await guess(second.cookie, catalog.answers[151].display);
  expect((await admin('hide-user', { id: second.data.me.user.id })).status).toBe(200);
  const hidden: any = await (await call('/leaderboard', undefined, second.cookie)).json();
  expect(hidden.own).toBeNull();
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  expect((await guess((await account()).cookie, catalog.answers[150].display)).status).toBe(409);
}, 30000);

it('R19 removes stored hex names, disambiguates clashes with decimal numbers, and keeps rerolls', async () => {
  const players = await Promise.all([account(), account()]);
  for (const p of players) {
    const user = {
      ...p.data.me.user,
      handle: 'Tan Dove #' + p.data.me.user.id.slice(0, 8),
      hidden: 0,
      streakDates: [],
    };
    await db
      .prepare('INSERT INTO r17_players(id,data) VALUES(?,?)')
      .bind(user.id, JSON.stringify(user))
      .run();
  }
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const me: any = await (await call('/me', undefined, p.cookie)).json();
    expect(me.user.handle).toBe('Tan Dove');
    const result = await guess(p.cookie, catalog.answers[180 + i].display);
    expect(result.status).toBe(201);
    expect(JSON.stringify(result.data)).not.toMatch(/#[0-9a-f]{5,}/);
    const cert = await (
      await call('/certificate/' + result.data.claim.id, undefined, p.cookie)
    ).text();
    expect(cert).not.toMatch(/#[0-9a-f]{5,}/);
  }
  const board: any = await (await call('/leaderboard', undefined, players[0].cookie)).json();
  expect(board.own.handle).toMatch(/^Tan Dove #\d{2,3}$/);
  const again: any = await (await call('/leaderboard', undefined, players[0].cookie)).json();
  expect(again.own.handle).toBe(board.own.handle);
  const migrate = await mf.dispatchFetch('http://localhost/api/admin/r19-clean-handles', {
    method: 'POST',
    headers: {
      origin: 'https://dibs.here',
      authorization: 'Bearer static-test-admin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ table: 'r17_players' }),
  });
  expect(migrate.status).toBe(200);
  const stored = await db.prepare('SELECT data FROM r17_players').all();
  expect(JSON.stringify(stored.results)).not.toMatch(/#[0-9a-f]{5,}/);
  const fresh = await account();
  for (let i = 0; i < 3; i++) {
    const r = await call('/me/reroll', {}, fresh.cookie);
    expect(r.status).toBe(200);
    expect(await r.text()).not.toMatch(/ #[0-9a-f]+/);
  }
  expect((await call('/me/reroll', {}, fresh.cookie)).status).toBe(403);
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  expect(await (await call('/me', undefined, players[0].cookie)).text()).not.toMatch(
    /#[0-9a-f]{5,}/,
  );
}, 30000);

it('R19 feedback quota survives a real DO restart, strips controls and caps shared IPs', async () => {
  const p = await account();
  for (let i = 0; i < 3; i++)
    expect(
      (
        await call(
          '/feedback',
          { text: 'Hello\u200b  there ' + i, turnstileToken: 'test' },
          p.cookie,
          '192.0.2.19',
        )
      ).status,
    ).toBe(200);
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  expect(
    (
      await call(
        '/feedback',
        { text: 'Fourth note', turnstileToken: 'test' },
        p.cookie,
        '192.0.2.20',
      )
    ).status,
  ).toBe(429);
  for (let i = 3; i < 20; i++) {
    const next = await account();
    expect(
      (
        await call(
          '/feedback',
          { text: 'A useful note ' + i, turnstileToken: 'test' },
          next.cookie,
          '192.0.2.19',
        )
      ).status,
    ).toBe(200);
  }
  const next = await account();
  expect(
    (
      await call(
        '/feedback',
        { text: 'Another note', turnstileToken: 'test' },
        next.cookie,
        '192.0.2.19',
      )
    ).status,
  ).toBe(429);
  for (const text of ['https://example.com', 'See https://a.com https://b.com https://c.com'])
    expect(
      (await call('/feedback', { text, turnstileToken: 'test' }, next.cookie, '192.0.2.21')).status,
    ).toBe(422);
  const rows = await db
    .prepare('SELECT text FROM feedback WHERE user_id=?')
    .bind(p.data.me.user.id)
    .all();
  expect(rows.results.map((r: any) => r.text)).toEqual([
    'Hello there 0',
    'Hello there 1',
    'Hello there 2',
  ]);
}, 30000);

it('R19 counts only finished files, updates the live score percentile, and exposes no other answers', async () => {
  const before: any = await (await call('/leaderboard')).json();
  const players = await Promise.all(Array.from({ length: 11 }, () => account()));
  // A socket belongs to a real signed player and receives the coalesced server broadcast.
  const response = await mf.dispatchFetch('http://localhost/api/live', {
    headers: { origin: 'https://dibs.here', upgrade: 'websocket', cookie: players[0].cookie },
  });
  const ws = response.webSocket!;
  ws.accept();
  const messages: any[] = [];
  ws.addEventListener('message', (e) => messages.push(JSON.parse(String(e.data))));
  for (const p of players)
    for (let i = 0; i < 5; i++)
      expect((await guess(p.cookie, manifest.house[0][1])).status).toBe(409);
  const final: any = await (await call('/leaderboard', undefined, players[0].cookie)).json();
  expect(final.comparison.finished).toBe(before.comparison.finished + 11);
  expect(final.comparison.points).toBe(0);
  expect(final.comparison.percentile).toBeGreaterThan(0);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  expect(
    messages.some((m) => m.leaderboard?.comparison.finished === final.comparison.finished),
  ).toBe(true);
  for (const message of messages) {
    assertPublicPayload(message, shapes.bootstrap);
    expect(message.rows).toEqual([]);
    expect(JSON.stringify(message.leaderboard)).not.toMatch(/display|answer_id|holder/);
  }
  ws.close();
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  const restored: any = await (await call('/leaderboard', undefined, players[0].cookie)).json();
  expect(restored.comparison).toEqual(final.comparison);
}, 30000);

it('R19B enforces concurrent claim/strike limits and accepts one golden bonus on the enabled runtime', async () => {
  const p = await account();
  const wins = await Promise.all(
    Array.from({ length: 7 }, (_, i) => guess(p.cookie, catalog.answers[300 + i].display)),
  );
  expect(wins.filter((r) => r.status === 201)).toHaveLength(3);
  expect(wins.filter((r) => r.status === 403)).toHaveLength(4);
  const q = await account();
  const strikes = await Promise.all(
    Array.from({ length: 8 }, () => guess(q.cookie, manifest.house[0][1])),
  );
  expect(strikes.filter((r) => r.status === 409)).toHaveLength(5);
  expect(strikes.filter((r) => r.status === 403)).toHaveLength(3);
  // This database is isolated Miniflare fixture data, never a deployed golden draw.
  const special = await db
    .prepare('SELECT golden_json FROM daily_specials WHERE category_id=?')
    .bind('static')
    .first();
  const chosen = JSON.parse(special.golden_json) as string[];
  const golden = chosen.find(
    (id) =>
      ![
        '120',
        '121',
        '122',
        '130',
        '140',
        '150',
        '151',
        '180',
        '181',
        '300',
        '301',
        '302',
        '303',
        '304',
        '305',
        '306',
      ].includes(id.split(':').at(-1)!),
  )!;
  const goldPlayer = await account();
  const index = Number(golden.split(':').at(-1));
  const gold = await guess(goldPlayer.cookie, catalog.answers[index].display);
  expect(gold.status).toBe(201);
  expect(gold.data.claim.bonus).toBe(100);
  expect(gold.data.claim.golden).toBeTruthy();
  expect(gold.data.file.points).toBe(gold.data.claim.points);
  const retry = await guess(goldPlayer.cookie, catalog.answers[index].display, gold.requestId);
  expect(retry.data.file.points).toBe(gold.data.file.points);
});
it('R19B reconciles a deliberately discarded socket ack using the same HTTP request ID', async () => {
  const p = await account();
  const id = crypto.randomUUID();
  const answer = catalog.answers[350].display;
  const response = await mf.dispatchFetch('http://localhost/api/live', {
    headers: { origin: 'https://dibs.here', upgrade: 'websocket', cookie: p.cookie },
  });
  const ws = response.webSocket!;
  ws.accept();
  const accepted = new Promise<void>((resolve) =>
    ws.addEventListener('message', (e) => {
      if (JSON.parse(String(e.data)).rpc === id) resolve();
    }),
  );
  ws.send(
    JSON.stringify({
      rpc: id,
      path: '/claim',
      body: { requestId: id, answer, turnstileToken: 'test' },
    }),
  );
  await accepted;
  ws.close();
  const retry = await guess(p.cookie, answer, id);
  expect(retry.status).toBe(201);
  expect(retry.data.replayed).toBe(true);
  expect(retry.data.file.dibs).toBe(1);
});

it('flushes the exact final board and mirror at close, and reveals only after close', async () => {
  const date = registryDate(),
    closedAt = Date.parse(
      dropAt(new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10)),
    );
  const r = await mf.dispatchFetch(
    'http://localhost/api/admin/r17-flush?fixture-day=' + date + '&fixture-now=' + closedAt,
    {
      method: 'POST',
      headers: { origin: 'https://dibs.here', authorization: 'Bearer static-test-admin' },
    },
  );
  expect(r.status).toBe(200);
  const board: any = await (await call('/leaderboard')).json();
  expect(board.final).toBe(true);
  const saved = JSON.parse(
    (await db.prepare('SELECT data FROM r17_boards WHERE category_id=?').bind('static').first())
      .data,
  );
  expect(saved.rows).toEqual(board.rows);
  expect(saved.total).toBe(board.total);
  const certificate: any = await (await call('/certificate/' + claim.id)).json();
  expect(certificate.claim.display).toBe(claim.display);
  expect(certificate.claim.revealed).toBe(true);
  const all = (
    await db.prepare('SELECT data FROM r17_files WHERE category_id=?').bind('static').all()
  ).results.map((r: any) => JSON.parse(r.data));
  const ledger: any = await (await call('/ledger?category=static')).json();
  expect(all.flatMap((s: any) => s.file.claims.filter((c: any) => !c.voided)).length).toBe(
    ledger.rows.length,
  );
});

it('applies the additive migration without changing any legacy claim, strike, identity or point', async () => {
  const legacy = await mf.getD1Database('PRESERVE');
  for (const name of readdirSync('migrations')
    .filter((f) => f.endsWith('.sql') && !f.startsWith('0015') && !f.startsWith('0016'))
    .sort())
    await legacy.exec(
      readFileSync('migrations/' + name, 'utf8')
        .replace(/^--.*$/gm, '')
        .replace(/CREATE TRIGGER[\s\S]*?\nEND;/g, (m) => m.replace(/\n/g, ' '))
        .replace(/\n/g, ' '),
    );
  await legacy
    .prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)',
    )
    .bind('old', '2026-11-20', 'Animals', 'animals', 2000, '2026-11-21T02:00:00Z', 'approved')
    .run();
  await legacy
    .prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)')
    .bind('old-answer', 'old', 'aardvark', 'Aardvark', '[]', 4)
    .run();
  await legacy
    .prepare('INSERT INTO users(id,handle,created_at) VALUES(?,?,?)')
    .bind('old-user', 'Old Holder', '2026-11-21T02:00:00Z')
    .run();
  await legacy
    .prepare(
      'INSERT INTO claims(id,category_id,answer_id,user_id,claim_no,created_at,ip_hash,ip_day,file_no,points,percentile,bonus) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      'old-claim',
      'old',
      'old-answer',
      'old-user',
      1,
      '2026-11-21T02:01:00Z',
      '',
      '',
      1,
      75,
      0.65,
      0,
    )
    .run();
  await legacy
    .prepare(
      'INSERT INTO strikes(category_id,user_id,seq,created_at,guess,house) VALUES(?,?,?,?,?,?)',
    )
    .bind('old', 'old-user', 2, '2026-11-21T02:02:00Z', 'Cat', 1)
    .run();
  const snapshot = async () =>
    Promise.all(
      [
        'users',
        'claims',
        'strikes',
        'categories',
        'answers',
        'daily_specials',
        'house_words',
        'recovery_keys',
        'founder_role',
      ].map(async (table) => (await legacy.prepare('SELECT * FROM ' + table).all()).results),
    );
  const before = await snapshot();
  await legacy.exec(
    readFileSync('migrations/0015_r17_journal.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  await legacy.exec(
    readFileSync('migrations/0016_r17_file_identity.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  expect(await snapshot()).toEqual(before);
});
