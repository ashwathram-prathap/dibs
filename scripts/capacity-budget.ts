import { readCategory } from '../scripts/category-file';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { registryDate, dropAt } from '../worker/domain';
const baseline = process.argv.includes('--before');
const practice = process.argv.includes('--practice');
const meterStorage = process.argv.includes('--storage');
if (practice && meterStorage) throw Error('--storage is a local instrumentation mode');
const storageTotals = { reads: 0, writes: 0 };
let setupStorage: typeof storageTotals;
const root = baseline ? '.tmp/r15-baseline/' : '';
let mf: Miniflare, db: any;
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
    entryPoints: [root + 'worker/index.ts'],
    plugins: meterStorage
      ? [
          {
            name: 'local-storage-meter',
            setup(b) {
              b.onLoad({ filter: /\/(registry|leaderboard)\.ts$/ }, async (args) => {
                let source = readFileSync(args.path, 'utf8');
                source = source
                  .replaceAll('this.ctx.storage', '__store(this.ctx.storage)')
                  .replaceAll('this.storage', '__store(this.storage)')
                  .replaceAll(
                    'new Leaderboard(ctx.storage,',
                    'new Leaderboard(__store(ctx.storage),',
                  );
                return {
                  contents:
                    `import { __store } from '${process.cwd()}/scripts/capacity-storage-proxy.ts';\n` +
                    source,
                  loader: 'ts',
                };
              });
            },
          },
        ]
      : [],
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
            if (meterStorage && url.origin === 'https://capacity.local') {
              const m = (await req.json()) as { kind: 'reads' | 'writes'; n: number };
              storageTotals[m.kind] += m.n;
              return new Response('ok');
            }
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
  for (const f of readdirSync(root + 'migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(
      readFileSync(root + 'migrations/' + f, 'utf8')
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

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const WebSocket = createRequire(import.meta.url)('ws');
const origin = practice ? 'https://practice.dibs-7hz.pages.dev' : 'http://localhost';
const vars = practice
  ? Object.fromEntries(
      readFileSync('.dev.vars.staging', 'utf8')
        .split('\n')
        .filter((l) => l.includes('='))
        .map((l) => {
          const i = l.indexOf('=');
          return [
            l.slice(0, i),
            l
              .slice(i + 1)
              .trim()
              .replace(/^['"]|['"]$/g, ''),
          ];
        }),
    )
  : {};
const samples: any[] = [];
let cookie = '';
let socket: any;
let socketMessages = 0;
let httpRequests = 0;
async function http(path: string, body?: any) {
  const headers: any = {
    origin: practice ? origin : 'https://dibs.here',
    ...(cookie ? { cookie } : {}),
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...(practice
      ? { authorization: 'Bearer ' + vars.ADMIN_TOKEN }
      : { 'x-test-ip': 'capacity-r15' }),
  };
  const r = practice
    ? await fetch(origin + '/api' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    : await mf.dispatchFetch(origin + '/api' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
  if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie')!.split(';')[0];
  httpRequests++;
  const data = (await r.json()) as any;
  samples.push({
    path,
    transport: 'http',
    status: r.status,
    reads: Number(r.headers.get('x-d1-rows-read')),
    writes: Number(r.headers.get('x-d1-rows-written')),
    metered: r.headers.has('x-d1-rows-read'),
  });
  return { status: r.status, data };
}
const pending = new Map<string, (data: any) => void>();
function receive(event: any) {
  const data = JSON.parse(String(event.data ?? event));
  if (data.rpc) {
    pending.get(data.rpc)?.(data);
    pending.delete(data.rpc);
  }
}
async function rpc(path: string, body: any) {
  const id = crypto.randomUUID();
  socketMessages++;
  const data = await new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(Error('RPC timed out'));
    }, 20000);
    pending.set(id, (d) => {
      clearTimeout(timeout);
      resolve(d);
    });
    socket.send(JSON.stringify({ rpc: id, path, body }));
  });
  samples.push({
    path,
    transport: 'socket',
    status: data.status,
    reads: data.d1?.reads || 0,
    writes: data.d1?.writes || 0,
    metered: !!data.d1,
  });
  return { status: data.status, data: data.body };
}
try {
  if (!practice) await startRegistry('animals');
  let dailySetup: any = null;
  if (!practice) {
    const setup = await call('/bootstrap');
    dailySetup = {
      reads: Number(setup.headers.get('x-d1-rows-read')),
      writes: Number(setup.headers.get('x-d1-rows-written')),
    };
    await setup.text();
  }
  if (meterStorage) {
    await new Promise((r) => setTimeout(r, 500));
    setupStorage = { ...storageTotals };
    storageTotals.reads = storageTotals.writes = 0;
  }
  const boot = await http('/bootstrap');
  assert.equal(boot.status, 200);
  assert.ok(boot.data.today.category, 'Practice must be open');
  if (!baseline) {
    httpRequests++;
    if (practice) {
      socket = new WebSocket(origin.replace('https:', 'wss:') + '/api/live', {
        headers: { origin, cookie, authorization: 'Bearer ' + vars.ADMIN_TOKEN },
      });
      await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
      socket.on('message', receive);
    } else {
      const r = await mf.dispatchFetch(origin + '/api/live', {
        headers: {
          upgrade: 'websocket',
          origin: 'https://dibs.here',
          cookie,
          'x-test-ip': 'capacity-r15',
        },
      });
      assert.equal(r.status, 101);
      socket = r.webSocket;
      socket.accept();
      socket.addEventListener('message', receive);
    }
  }
  const send = baseline ? http : rpc;
  const verified = await send('/verify-session', {
    turnstileToken: practice ? 'XXXX.DUMMY.TOKEN.XXXX' : 'test',
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  const catalog = readCategory('categories/animals.json');
  const chosen = practice
    ? [
        catalog.answers[2000 + Math.floor(Math.random() * 1000)].display,
        'Dog',
        'Dog',
        'Dog',
        catalog.answers[4000 + Math.floor(Math.random() * 1000)].display,
        catalog.answers[6000 + Math.floor(Math.random() * 1000)].display,
      ]
    : [100, 0, 0, 0, 101, 102].map((i) => catalog.answers[i].display);
  for (const [i, answer] of chosen.entries()) {
    const r = await send('/claim', {
      answer,
      sessionToken: verified.data.sessionToken,
      requestId: crypto.randomUUID(),
    });
    assert.equal(r.status, i === 0 || i >= 4 ? 201 : 409, JSON.stringify(r.data));
  }
  // Current leaderboard is already in bootstrap and pushes; baseline opened an HTTP view.
  if (baseline) await http('/leaderboard');
  await send('/events/share', { platform: 'copy-text' });
  await http('/bootstrap'); // Later return: same cookie, authoritative saved file.
  if (meterStorage) await new Promise((r) => setTimeout(r, 500));
  const rowsRead = samples.reduce((n, s) => n + s.reads, 0),
    rowsWritten = samples.reduce((n, s) => n + s.writes, 0);
  const report = {
    dailySetup,
    ...(meterStorage
      ? { doStorageSetup: setupStorage!, doStorageLogicalRows: { ...storageTotals } }
      : {}),
    mode: practice ? 'practice' : baseline ? 'before-local' : 'after-local',
    at: new Date().toISOString(),
    scenario:
      'load, verification, 6 guesses (3 claims, 3 reserved strikes), leaderboard, share, return visit',
    httpRequests,
    pagesFunctionRequests: practice ? httpRequests : 0,
    workerRequests: httpRequests,
    doRequests: httpRequests + socketMessages / 20,
    socketMessages,
    d1RowsRead: rowsRead,
    d1RowsWritten: rowsWritten,
    allMutationsMetered: samples.filter((s) => s.path === '/claim').every((s) => s.metered),
    samples,
  };
  writeFileSync(
    'review/round15/capacity-' + (meterStorage ? 'do-storage-' : '') + report.mode + '.json',
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} finally {
  socket?.close();
  if (!practice) await mf?.dispose();
}
