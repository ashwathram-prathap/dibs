// Isolated Miniflare synthetic load; never sends a hosted gameplay request.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { readCategory } from './category-file';
import { registryDate, dropAt } from '../worker/domain';
import assert from 'node:assert/strict';
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

const count = Number(process.argv.find((a) => a.startsWith('--players='))?.slice(10) || 500),
  sockets: any[] = [],
  latencies: Record<string, number[]> = { bootstrap: [], verification: [], claim: [], board: [] };
const errors: string[] = [];
let acknowledgements = 0,
  peakSockets = 0,
  simultaneous = 0,
  active = 0;
const started = performance.now();
async function timed(kind: string, fn: () => Promise<any>) {
  active++;
  simultaneous = Math.max(simultaneous, active);
  const at = performance.now();
  try {
    return await fn();
  } finally {
    latencies[kind].push(performance.now() - at);
    active--;
  }
}
try {
  await startRegistry('animals');
  await (await call('/today')).text(); // Warm the local dispatch listener before concurrent traffic.
  const category = readCategory('categories/animals.json');
  const players = await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      await new Promise((r) => setTimeout(r, i * 10));
      return timed('bootstrap', async () => {
        const r = await call(
          '/bootstrap',
          undefined,
          undefined,
          `198.18.${Math.floor(i / 254)}.${(i % 254) + 1}`,
        );
        assert.equal(r.status, 200);
        const cookie = r.headers.get('set-cookie')!.split(';')[0];
        await r.text();
        return { cookie, token: '', claims: [] as string[] };
      });
    }),
  );
  await Promise.all(
    players.map(async (p) => {
      const r = await mf.dispatchFetch('http://localhost/api/live', {
        headers: { origin: 'https://dibs.here', upgrade: 'websocket', cookie: p.cookie },
      });
      assert.equal(r.status, 101);
      r.webSocket!.accept();
      sockets.push(r.webSocket);
      peakSockets = Math.max(peakSockets, sockets.length);
    }),
  );
  await Promise.all(
    players.map((p) =>
      timed('verification', async () => {
        const r = await call('/verify-session', { turnstileToken: 'test' }, p.cookie);
        assert.equal(r.status, 200);
        p.token = ((await r.json()) as any).sessionToken;
      }),
    ),
  );
  async function claim(p: (typeof players)[number], answer: string, id = crypto.randomUUID()) {
    return timed('claim', async () => {
      const r = await call('/claim', { answer, sessionToken: p.token, requestId: id }, p.cookie);
      const d: any = await r.json();
      if (r.status === 201) {
        acknowledgements++;
        p.claims.push(d.claim.id);
      }
      return { status: r.status, data: d, id };
    });
  }
  const contest = await Promise.all(players.map((p) => claim(p, category.answers[500].display)));
  assert.equal(contest.filter((r) => r.status === 201).length, 1);
  assert.equal(contest.filter((r) => r.status === 409).length, count - 1);
  for (let wave = 0; wave < 3; wave++)
    await Promise.all(
      players.map(async (p, i) => {
        if (p.claims.length === 3) return;
        const r = await claim(p, category.answers[1000 + 3 * i + wave].display);
        assert.equal(r.status, 201);
      }),
    );
  const winner = contest.findIndex((r) => r.status === 201),
    retry = await call(
      '/claim',
      {
        answer: category.answers[500].display,
        sessionToken: players[winner].token,
        requestId: contest[winner].id,
      },
      players[winner].cookie,
    );
  assert.equal(retry.status, 201);
  assert.equal(((await retry.json()) as any).replayed, true);
  await Promise.all(
    players.map((p) =>
      timed('board', async () => {
        const r = await call('/leaderboard', undefined, p.cookie);
        const d: any = await r.json();
        assert.equal(d.own.claims, 3);
        assert.equal(d.total, count);
        assert.ok(!/answer_id|user_id|recoveryHash|requests/.test(JSON.stringify(d)));
      }),
    ),
  );
  const flushed = await mf.dispatchFetch('http://localhost/api/admin/r17-flush', {
    method: 'POST',
    headers: { origin: 'https://dibs.here', authorization: 'Bearer static-test-admin' },
  });
  assert.equal(flushed.status, 200);
  await flushed.text();
  const total: any = await db
    .prepare("SELECT SUM(json_array_length(data,'$.file.claims')) n FROM r17_files")
    .first();
  assert.equal(total.n, acknowledgements);
} catch (e) {
  errors.push(String(e) + '; cause: ' + String((e as any)?.cause));
  process.exitCode = 1;
} finally {
  for (const s of sockets) s.close();
  await mf?.dispose();
  const quantiles = Object.fromEntries(
    Object.entries(latencies).map(([key, values]) => {
      values.sort((a, b) => a - b);
      return [
        key,
        {
          samples: values.length,
          p50: values[Math.ceil(values.length * 0.5) - 1] ?? null,
          p95: values[Math.ceil(values.length * 0.95) - 1] ?? null,
          p99: values[Math.ceil(values.length * 0.99) - 1] ?? null,
        },
      ];
    }),
  );
  const report = {
    at: new Date().toISOString(),
    bootstrapRampSeconds: count * 0.01,
    environment: 'local Miniflare, synthetic only, test Turnstile',
    players: count,
    peakSockets,
    simultaneousRequests: simultaneous,
    acknowledgements,
    durationSeconds: (performance.now() - started) / 1000,
    quantiles,
    errors,
    correctnessPassed: errors.length === 0,
    hostedCapacityProven: false,
    soak: false,
    workerCPU: null,
    workerMemory: null,
    generatorRSS: process.memoryUsage().rss,
    networkRTT: 'loopback',
  };
  writeFileSync('review/round20/local-load-' + count + '.json', JSON.stringify(report, null, 2));
  console.log(report);
}
