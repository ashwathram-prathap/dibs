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
  expect(data.claim.percentile).toBe(null);
  expect(data.claim.concealed).toBe(true);
  expect(await (await call('/leaderboard', undefined, other.cookie)).text()).not.toContain(
    claim.display,
  );
  expect(((await (await call('/ledger?category=static')).json()) as any).rows).toEqual([]);
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
  expect(mirrored.file.claims).toEqual(last.data.file.claims);
  expect(mirrored.file.events).toEqual(last.data.file.events);
  expect(mirrored.file.points).toBe(last.data.file.points);
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  const restored: any = await (await call('/me', undefined, winner.cookie)).json();
  expect(restored.file.claims).toEqual(last.data.file.claims);
  expect(restored.file.points).toBe(last.data.file.points);
  expect(restored.streak).toBe(1);
}, 30000);
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
