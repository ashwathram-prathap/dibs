// R19I runs on its own fresh enabled DayRegistry (same harness as r17-journal).
import { decode as decodeJpeg } from 'jpeg-js';
import { assertOwnerSharedPayload, assertPublicPayload, shapes } from './public-payload-schema';
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
    plugins: [
      {
        name: 'compiled-wasm',
        setup(b) {
          b.onResolve({ filter: /\.wasm$/ }, () => ({ path: './resvg.wasm', external: true }));
        },
      },
    ],
    loader: { '.woff': 'binary', '.otf': 'binary' },
  });
  options = convertV4MiniflareOptions({
    workers: [
      {
        name: 'static-test',
        modules: [
          { type: 'ESModule', path: 'worker.mjs', contents: code.outputFiles[0].text },
          {
            type: 'CompiledWasm',
            path: 'resvg.wasm',
            contents: readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'),
          },
        ],
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

// R19I: a player is never charged a second strike for the same resolved answer tonight.
async function measured(cookie: string, answer: string, requestId = crypto.randomUUID()) {
  const r = await call('/claim', { answer, turnstileToken: 'test', requestId }, cookie);
  return {
    status: r.status,
    data: (await r.json()) as any,
    requestId,
    d1Writes: Number(r.headers.get('x-d1-rows-written')),
    journal: Number(r.headers.get('x-do-journal-seq')),
  };
}
const lion = catalog.answers.findIndex((a: any) => a.display === 'Lion');
it('R19I charges no second strike for a repeat taken guess: exact, case, plural, alias', async () => {
  expect(manifest.house.map((r: any) => r[1])).not.toContain('Lion');
  const holder = await account();
  const won = await guess(holder.cookie, 'Lion');
  expect(won.status).toBe(201);
  const p = await account();
  const first = await measured(p.cookie, 'Lion');
  expect(first.status).toBe(409);
  expect(first.data.file.strikes).toBe(1);
  for (const repeat of [
    'Lion',
    'lion',
    '  LION ',
    'Lions',
    'lions',
    'Panthera leo',
    'African Lion',
  ]) {
    const again = await measured(p.cookie, repeat);
    expect(again.status, repeat).toBe(422);
    expect(again.data.code).toBe('ALREADY_TRIED');
    expect(again.data.message).toBe('You already tried Lion. No strike.');
    expect(again.data.answer).toBe('Lion');
    expect(again.data.house).toBe(false);
    expect(again.data.takenBy).toBe(first.data.takenBy);
    expect(again.data.at).toBe(first.data.at);
    expect(again.data.file.strikes).toBe(1);
    expect(again.data.file.events).toHaveLength(1);
    expect(again.data.me.file.strikes).toBe(1);
    // Budget: no D1 row written and no Durable Object journal append for the repeat.
    expect(again.d1Writes).toBe(0);
    expect(again.journal).toBe(first.journal);
  }
  // A different taken answer still costs a strike (only repeats are free).
  await guess(holder.cookie, 'Tiger');
  expect((await guess(p.cookie, 'Tiger')).data.file.strikes).toBe(2);
  // Survives a runtime restart: the stored strike still resolves to the same answer_id.
  await mf.setOptions(options);
  db = await mf.getD1Database('DB');
  const restarted = await measured(p.cookie, 'lions');
  expect(restarted.data.code).toBe('ALREADY_TRIED');
  expect(restarted.data.file.strikes).toBe(2);
}, 30000);
it('R19I charges no second strike for a repeat reserved guess', async () => {
  const p = await account();
  const house = manifest.house[3][1];
  const first = await measured(p.cookie, house);
  expect(first.status).toBe(409);
  expect(first.data.house).toBe(true);
  const again = await measured(p.cookie, house.toLowerCase());
  expect(again.status).toBe(422);
  expect(again.data).toMatchObject({ code: 'ALREADY_TRIED', house: true, takenBy: 'RESERVED' });
  expect(again.data.file.strikes).toBe(1);
  expect(again.d1Writes).toBe(0);
  expect(again.journal).toBe(first.journal);
  // Another reserved answer is a new strike.
  expect((await guess(p.cookie, manifest.house[4][1])).data.file.strikes).toBe(2);
}, 30000);
it('R19I: two tabs submitting the same taken answer at once are charged once', async () => {
  const holder = await account();
  expect((await guess(holder.cookie, 'Zebra')).status).toBe(201);
  // Never struck yet: concurrent double-submit with different request IDs.
  const p = await account();
  const pair = await Promise.all([guess(p.cookie, 'Zebra'), guess(p.cookie, 'zebras')]);
  expect(pair.map((r) => r.status).sort()).toEqual([409, 422]);
  const me: any = await (await call('/me', undefined, p.cookie)).json();
  expect(me.file.strikes).toBe(1);
  // Already struck: both tabs repeat it at once, nothing is charged or written.
  const before = await measured(p.cookie, 'Zebra');
  const both = await Promise.all([measured(p.cookie, 'Zebra'), measured(p.cookie, 'ZEBRA')]);
  for (const r of both) {
    expect(r.data.code).toBe('ALREADY_TRIED');
    expect(r.d1Writes).toBe(0);
    expect(r.journal).toBe(before.journal);
  }
  expect(((await (await call('/me', undefined, p.cookie)).json()) as any).file.strikes).toBe(1);
}, 30000);
it('R19I: a retry after a lost acknowledgement replays the strike without charging again', async () => {
  const holder = await account();
  expect((await guess(holder.cookie, 'Giraffe')).status).toBe(201);
  const p = await account();
  const original = await measured(p.cookie, 'Giraffe');
  expect(original.status).toBe(409);
  // Same request ID (the client never saw the reply): the original strike is replayed.
  const replay = await measured(p.cookie, 'Giraffe', original.requestId);
  expect(replay.status).toBe(409);
  expect(replay.data.replayed).toBe(true);
  expect(replay.data.file.strikes).toBe(1);
  expect(replay.journal).toBe(original.journal);
  // A fresh request ID for the same answer is a no-charge repeat.
  const fresh = await measured(p.cookie, 'giraffes');
  expect(fresh.data.code).toBe('ALREADY_TRIED');
  expect(fresh.data.file.strikes).toBe(1);
  expect(fresh.journal).toBe(original.journal);
  // Retrying that no-charge request is equally free and idempotent.
  const retried = await measured(p.cookie, 'giraffes', fresh.requestId);
  expect(retried.data.code).toBe('ALREADY_TRIED');
  expect(retried.journal).toBe(original.journal);
  // Typos and unknown answers still cost nothing and are unchanged.
  const typo = await measured(p.cookie, 'Girafffffe zzz');
  expect(typo.status).toBe(422);
  expect(typo.data.code).toBe('NOT_REGISTERED');
}, 30000);
