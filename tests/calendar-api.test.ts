import { LAUNCH_DATE } from '../shared/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { registryDate, dropAt } from '../worker/domain';
import { dayAfter } from '../shared/calendar';
const notifications: string[] = [];
let mf: Miniflare,
  db: any,
  denyAssets = false;
const now = registryDate();
const admin = (path = '', body?: any, auth = true) =>
  mf.dispatchFetch('http://localhost/api/admin/schedule' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: 'https://dibs.here',
      ...(auth ? { authorization: 'Bearer calendar-test' } : {}),
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const state = async () => (await (await admin()).json()) as any;
beforeAll(async () => {
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
          name: 'calendar-test',
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
            COOKIE_SECRET: 'calendar-test',
            ADMIN_TOKEN: 'calendar-test',
            TURNSTILE_SITE_KEY: 'test',
            NTFY_TOPIC: 'test-not-real',
          },
          outboundService: async (req: Request) => {
            if (denyAssets) return new Response('Removed', { status: 404 });
            if (new URL(req.url).hostname === 'ntfy.sh') {
              notifications.push(await req.text());
              return new Response('ok');
            }
            const path = new URL(req.url).pathname;
            if (path.startsWith('/catalog/')) {
              let bytes = readFileSync('public' + path);
              if (path.endsWith('manifest.json')) {
                const m = JSON.parse(bytes.toString());
                delete m.house;
                bytes = Buffer.from(JSON.stringify(m));
              }
              return new Response(bytes, { headers: { 'content-type': 'application/json' } });
            }
            throw Error('Unexpected outbound');
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
  const coverage = JSON.parse(readFileSync('review/coverage/results.json', 'utf8'));
  for (const slug of [
    'animals',
    'cities',
    'foods',
    'films',
    'plants',
    'actors',
    'countries',
    'songs',
  ]) {
    const r = await admin('/library', {
      recipe: JSON.parse(readFileSync('recipes/' + slug + '.json', 'utf8')),
      coverage: coverage.find((c: any) => c.slug === slug),
      manifest: JSON.parse(readFileSync('public/catalog/' + slug + '/manifest.json', 'utf8')),
    });
    expect(r.status, await r.text()).toBe(200);
  }
}, 30000);
afterAll(async () => await mf?.dispose());
it('requires the admin token and rejects no-peek metadata leaks', async () => {
  expect((await admin('', undefined, false)).status).toBe(404);
  const s = await state();
  expect(s.days).toHaveLength(60);
  expect(JSON.stringify(s)).not.toContain('manifest_json');
  expect(JSON.stringify(s)).not.toContain('golden_json');
});
it('preserves pre-existing dates and never auto-opens a day before launch', async () => {
  const date = dayAfter(now, 3);
  await db
    .prepare(
      "INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES('existing-plan',?,'Countries','countries',2000,?,'approved')",
    )
    .bind(date, dropAt(date))
    .run();
  await admin('/tick', {});
  const d = await db.prepare('SELECT * FROM topic_schedule WHERE date=?').bind(date).first();
  expect(d.category_id).toBe('existing-plan');
  expect(d.reason).toContain('Preserved');
  const pre = await db
    .prepare("SELECT COUNT(*) n FROM categories WHERE date<? AND id LIKE 'day-%'")
    .bind(LAUNCH_DATE)
    .first();
  expect(pre.n).toBe(0);
});
it('picks from the library, requests new topics and enforces lead times and stale edits', async () => {
  const date = dayAfter(now, 5);
  expect((await admin('', { action: 'library', date, slug: 'animals', revision: 0 })).status).toBe(
    200,
  );
  expect((await admin('', { action: 'clear', date, revision: 0 })).status).toBe(422);
  const d = (await state()).days.find((d: any) => d.date === date);
  expect(d.status).toBe('requested');
  expect(
    (
      await admin('', {
        action: 'request',
        date: dayAfter(now, 6),
        request: 'Car brands',
        revision: 0,
      })
    ).status,
  ).toBe(200);
  expect((await state()).days.find((d: any) => d.request === 'Car brands').status).toBe(
    'needs recipe',
  );
  const near = [0, 1, 2]
    .map((i) => dayAfter(now, i))
    .find(
      (d) =>
        Date.parse(dropAt(d)) > Date.now() && Date.parse(dropAt(d)) - Date.now() < 24 * 3600000,
    )!;
  expect((await admin('', { action: 'library', date: near, slug: 'cities' })).status).toBe(422);
  expect(
    (await admin('', { action: 'request', date: dayAfter(now, 2), request: 'Movies' })).status,
  ).toBe(422);
  expect((await admin('', { action: 'pick', date: dayAfter(now, 8), revision: 0 })).status).toBe(
    200,
  );
});
it('moves and swaps future days without changing a locked live day', async () => {
  const from = dayAfter(now, 5),
    to = dayAfter(now, 9);
  expect((await admin('', { action: 'move', date: from, to })).status).toBe(200);
  expect((await state()).days.find((d: any) => d.date === from).status).toBe('empty');
  expect((await admin('', { action: 'swap', date: to, to: dayAfter(now, 8) })).status).toBe(200);
  await db
    .prepare("INSERT INTO topic_schedule(date,slug,status,updated_at) VALUES(?,?,'live',?)")
    .bind(dayAfter(now, -1), 'animals', new Date().toISOString())
    .run();
  expect((await admin('', { action: 'move', date: to, to: dayAfter(now, -1) })).status).toBe(422);
  expect((await admin('', { action: 'swap', date: dayAfter(now, -1), to })).status).toBe(422);
});
it('auto-picks empty and failed days at 48 hours, builds uploaded recipes and seals commitments', async () => {
  const near = [0, 1, 2, 3]
    .map((i) => dayAfter(now, i))
    .filter(
      (d) =>
        Date.parse(dropAt(d)) > Date.now() &&
        d >= LAUNCH_DATE &&
        Date.parse(dropAt(d)) - Date.now() <= 48 * 3600000,
    );
  expect(near.length).toBeGreaterThan(0);
  for (const date of near)
    await db
      .prepare(
        'INSERT INTO topic_schedule(date,status,updated_at,build_result) VALUES(?,?,?,?) ON CONFLICT(date) DO UPDATE SET status=excluded.status,slug=NULL',
      )
      .bind(
        date,
        date === near[0] ? 'empty' : 'failed',
        new Date().toISOString(),
        'fixture build failure',
      )
      .run();
  for (let i = 0; i < near.length; i++) {
    const r = await admin('/tick', {});
    expect(r.status, await r.text()).toBe(200);
  }
  const s = await state();
  for (const date of near) {
    const d = s.days.find((d: any) => d.date === date);
    expect(d.auto_picked).toBe(1);
    expect(d.status).toBe('ready');
    expect(d.reason).toContain('21 days');
    const proof = await db
      .prepare('SELECT commitment FROM daily_specials WHERE category_id=?')
      .bind(d.category_id)
      .first();
    expect(proof.commitment).toMatch(/^[a-f0-9]{64}$/);
  }
});
it('removes an unplayed future day metadata and retains archived claims and certificates without index assets', async () => {
  const date = dayAfter(now, 4);
  await admin('', { action: 'library', date, slug: 'countries' });
  for (let i = 0; i < 8; i++) {
    await admin('/tick', {});
    const row = await db
      .prepare('SELECT status FROM topic_schedule WHERE date=?')
      .bind(date)
      .first();
    if (row.status === 'ready') break;
  }
  const row = await db.prepare('SELECT * FROM topic_schedule WHERE date=?').bind(date).first();
  expect(row.status).toBe('ready');
  expect((await admin('', { action: 'clear', date })).status).toBe(200);
  expect(
    await db.prepare('SELECT * FROM categories WHERE id=?').bind(row.category_id).first(),
  ).toBeNull();
  const id = 'historic',
    past = '2020-01-01';
  await db
    .prepare(
      "INSERT INTO categories(id,name,slug,date,drop_at,total_registrable,status) VALUES(?,?,?,?,?,2000,'approved')",
    )
    .bind(id, 'Animals', 'animals', past, dropAt(past))
    .run();
  await db
    .prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)')
    .bind('archive-answer', id, 'axolotl', 'Axolotl', '[]', 4)
    .run();
  await db
    .prepare('INSERT INTO users(id,handle,created_at) VALUES(?,?,?)')
    .bind('archive-user', 'Test holder', '2020-01-01T01:00:00Z')
    .run();
  await db
    .prepare(
      'INSERT INTO claims(id,category_id,answer_id,user_id,claim_no,created_at,ip_hash,ip_day,file_no) VALUES(?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      'archive-claim',
      id,
      'archive-answer',
      'archive-user',
      1,
      '2020-01-01T22:00:00Z',
      '',
      '2020-01-01',
      1,
    )
    .run();
  await db
    .prepare(
      "INSERT INTO topic_schedule(date,slug,status,category_id,updated_at) VALUES(?,?,'closed',?,?)",
    )
    .bind(past, 'animals', id, new Date().toISOString())
    .run();
  denyAssets = true;
  expect((await admin('/archive', { date: past })).status).toBe(200);
  const cert = await mf.dispatchFetch('http://localhost/api/certificate/archive-claim');
  expect(cert.status).toBe(200);
  expect(await cert.text()).toContain('Axolotl');
  const archive = await mf.dispatchFetch('http://localhost/api/archive?id=' + id);
  expect(archive.status).toBe(200);
  expect(await archive.text()).toContain('Axolotl');
  expect((await db.prepare('SELECT COUNT(*) n FROM claims').first()).n).toBe(1);
  denyAssets = false;
});

it('sends at most one capacity alert per day across threshold levels', async () => {
  await admin('/assets', { files: 18000, bytes: 1, maxBytes: 1 });
  const monitor = () =>
    mf.dispatchFetch('http://localhost/api/admin/monitor', {
      method: 'POST',
      headers: { authorization: 'Bearer calendar-test', origin: 'https://dibs.here' },
    });
  expect((await monitor()).status).toBe(200);
  expect((await monitor()).status).toBe(200);
  expect(notifications.filter((n) => n.includes('staticFiles'))).toHaveLength(1);
  expect(notifications.filter((n) => n.includes('70%'))).toHaveLength(1);
  expect(notifications.filter((n) => n.includes('90%'))).toHaveLength(0);
});
