import { beforeAll, afterAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registryDate, dropAt, normalize } from '../worker/domain';
import houseWords from '../worker/house-words.json';
let mf: Miniflare, db: any, stage: any;
const date = registryDate();
const call = (path: string, body?: any, cookie?: string, staging = false, admin = false) =>
  mf.dispatchFetch('http://localhost/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: 'http://localhost',
      ...(cookie ? { cookie } : {}),
      ...(admin ? { authorization: 'Bearer test-admin' } : {}),
      'content-type': 'application/json',
      ...(staging ? { 'MF-Experimental-Route-Override': 'stage' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function account(staging = false) {
  const r = await call('/bootstrap', undefined, undefined, staging);
  return { cookie: r.headers.get('set-cookie')!.split(';')[0], data: (await r.json()) as any };
}
beforeAll(async () => {
  const result = await build({
    entryPoints: ['worker/index.ts'],
    bundle: true,
    external: ['cloudflare:workers'],
    write: false,
    format: 'esm',
    platform: 'browser',
    loader: { '.wasm': 'binary', '.woff': 'binary', '.otf': 'binary' },
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [false, true].map((staging) => ({
        name: staging ? 'stage' : 'production',
        modules: true,
        script: result.outputFiles[0].text,
        compatibilityDate: '2026-11-20',
        d1Databases: { DB: staging ? 'stage-db' : 'production-db' },
        durableObjects: { REGISTRY: { className: 'Registry', useSQLite: true } },
        bindings: {
          COOKIE_SECRET: staging ? 'stage-secret' : 'production-secret',
          ADMIN_TOKEN: 'test-admin',
          LOCAL_TEST: 'true',
          STAGING: staging ? 'true' : 'false',
          TURNSTILE_SITE_KEY: 'test',
        },
      })),
    }),
  );
  db = await mf.getD1Database('DB', 'production');
  stage = await mf.getD1Database('DB', 'stage');
  for (const [database, id, day] of [
    [db, 'specials', date],
    [stage, 'practice', '2020-01-01'],
  ] as const) {
    for (const f of readdirSync('migrations').sort())
      await database.exec(
        readFileSync('migrations/' + f, 'utf8')
          .replace(/^--.*$/gm, '')
          .replace(/\n/g, ' '),
      );
    await database
      .prepare(
        'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(id, day, 'Animals', 'animals', 2000, dropAt(day), 'approved')
      .run();
    const names = [
      ...houseWords.animals,
      ...Array.from({ length: 20 }, (_, i) => 'Secret test answer ' + i),
    ];
    for (const [i, display] of names.entries())
      await database.batch([
        database
          .prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)')
          .bind(id + ':' + i, id, normalize(display), display, '[]', 3),
        database
          .prepare('INSERT INTO answer_keys VALUES(?,?,?)')
          .bind(id, normalize(display), id + ':' + i),
      ]);
  }
}, 30000);
afterAll(() => mf.dispose());
it('publishes only a stable commitment before any claim, including cached payloads and HTML', async () => {
  const a = await account();
  const saved = await db.prepare('SELECT * FROM daily_specials').first();
  const ids = JSON.parse(saved.golden_json);
  expect(ids).toHaveLength(3);
  expect(new Set(ids).size).toBe(3);
  const gold = (
    await db
      .prepare('SELECT display FROM answers WHERE id IN (SELECT value FROM json_each(?))')
      .bind(saved.golden_json)
      .all()
  ).results;
  const payloads = [];
  for (const p of [
    '/bootstrap',
    '/today',
    '/ledger?category=specials',
    '/archive',
    '/answers?q=Secret',
    '/me',
    '/today',
  ]) {
    const r = await call(p, undefined, a.cookie);
    expect(r.status).toBe(200);
    payloads.push(await r.text());
  }
  payloads.push(readFileSync('index.html', 'utf8'));
  for (const payload of payloads) {
    for (const word of gold) expect(payload).not.toContain(word.display);
    for (const id of ids) expect(payload).not.toContain(id);
    expect(payload).not.toContain(saved.seed);
    expect(payload).not.toContain('golden_json');
  }
  expect(a.data.today.specials.commitment).toBe(saved.commitment);
  expect(a.data.today.open).toBe(1990);
  expect(a.data.today.claimed).toBe(0);
  expect(a.data.today.specials.houseWords).toEqual([]);
  expect(
    (
      await db
        .prepare(
          'SELECT COUNT(*) n FROM house_words WHERE answer_id IN (SELECT value FROM json_each(?))',
        )
        .bind(saved.golden_json)
        .first()
    ).n,
  ).toBe(0);
  expect((await db.prepare('SELECT * FROM daily_specials').first()).commitment).toBe(
    saved.commitment,
  );
});
it('charges house strikes without creating players, claims or ledger rows; caps concurrently at five', async () => {
  const a = await account();
  const responses = await Promise.all(
    Array.from({ length: 8 }, () =>
      call('/claim', { answer: houseWords.animals[0], turnstileToken: 'test' }, a.cookie),
    ),
  );
  expect(responses.filter((r) => r.status === 409)).toHaveLength(5);
  expect(responses.filter((r) => r.status === 403)).toHaveLength(3);
  const data = (await responses.find((r) => r.status === 409)!.json()) as any;
  expect(data.house).toBe(true);
  expect(data.takenBy).toBe('THE REGISTRY');
  expect(data.message).toContain('Obvious picks are reserved.');
  const me = (await (await call('/me', undefined, a.cookie)).json()) as any;
  expect(me.file.strikes).toBe(5);
  expect(me.file.dibs).toBe(0);
  for (const table of ['claims', 'users'])
    expect((await db.prepare('SELECT COUNT(*) n FROM ' + table).first()).n).toBe(0);
  const today = (await (await call('/bootstrap', undefined, a.cookie)).json()) as any;
  expect(today.today.open).toBe(1990);
  expect(today.rows).toEqual([]);
  expect(today.today.specials.houseWords).toEqual([
    { display: houseWords.animals[0], handle: 'THE REGISTRY' },
  ]);
});
it('reveals a golden answer only after its successful claim and retains stars on reload', async () => {
  const a = await account();
  const saved = await db.prepare('SELECT * FROM daily_specials').first();
  const ids = JSON.parse(saved.golden_json);
  const answer = await db.prepare('SELECT display FROM answers WHERE id=?').bind(ids[0]).first();
  const response = await call(
    '/claim',
    { answer: answer.display, turnstileToken: 'test' },
    a.cookie,
  );
  expect(response.status).toBe(201);
  const result = (await response.json()) as any;
  expect(result.claim.golden).toBe(1);
  expect(result.file.events[0].golden).toBe(true);
  const payload = await (await call('/bootstrap', undefined, a.cookie)).text();
  expect(payload).toContain(answer.display);
  for (const id of ids.slice(1)) {
    const row = await db.prepare('SELECT display FROM answers WHERE id=?').bind(id).first();
    expect(payload).not.toContain(row.display);
  }
  expect(JSON.parse(payload).today.specials.goldenFound).toBe(1);
  expect(JSON.parse(payload).today.open).toBe(1989);
});
it('reveals every reserved word and verifies the original salted commitment only after close', async () => {
  const original = await db.prepare('SELECT * FROM daily_specials').first();
  await db
    .prepare(
      "UPDATE categories SET date='2020-01-01',drop_at='2020-01-02T02:00:00Z' WHERE id='specials'",
    )
    .run();
  // A cached empty archive can live ten minutes, so use an independent direct route for the close boundary.
  // Advance the archive cache key without exposing private state: isolate a fresh coordinator via admin invalidation.
  const filed = await db.prepare('SELECT id FROM claims LIMIT 1').first();
  expect((await call('/admin/void-claim', { id: filed.id }, undefined, false, true)).status).toBe(
    200,
  );
  const closed = (await (await call('/archive')).json()) as any;
  const s = closed.categories[0].specials;
  expect(s.houseWords).toHaveLength(10);
  expect(s.verified).toBe(true);
  expect(s.commitment).toBe(original.commitment);
  expect(createHash('sha256').update(s.reveal.payload).digest('hex')).toBe(original.commitment);
  expect(s.reveal.answers).toHaveLength(3);
  expect(s.reveal.seed).toBe(original.seed);
});
it('allows reset only in isolated staging and keeps practice open outside the calendar', async () => {
  expect((await call('/admin/practice-reset', {}, undefined, false, true)).status).toBe(404);
  const worker = await mf.getWorker('stage');
  const request = (path: string, body?: any, cookie?: string, admin = false) =>
    worker.fetch('http://localhost/api' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: 'http://localhost',
        ...(cookie ? { cookie } : {}),
        ...(admin ? { authorization: 'Bearer test-admin' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const r = await request('/bootstrap');
  const cookie = r.headers.get('set-cookie')!.split(';')[0];
  const data = (await r.json()) as any;
  expect(data.today.practice).toBe(true);
  expect(data.today.category.id).toBe('practice');
  expect(
    (await request('/claim', { answer: 'Secret test answer 1', turnstileToken: 'test' }, cookie))
      .status,
  ).toBe(201);
  expect((await request('/admin/practice-reset', {})).status).toBe(404);
  expect((await request('/admin/practice-reset', {}, undefined, true)).status).toBe(200);
  const fresh = (await (await request('/bootstrap', undefined, cookie)).json()) as any;
  expect(fresh.today.claimed).toBe(0);
  expect(fresh.me.file).toBeNull();
  expect(fresh.rows).toEqual([]);
  expect((await db.prepare('SELECT COUNT(*) n FROM claims').first()).n).toBe(1);
  expect((await stage.prepare('SELECT COUNT(*) n FROM claims').first()).n).toBe(0);
});
