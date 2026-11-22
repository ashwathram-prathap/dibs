import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { registryDate, dropAt } from '../worker/domain';
import { SECURITY_HEADERS } from '../shared/security';
const compiled = await build({
  entryPoints: ['worker/index.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  external: ['cloudflare:workers'],
  loader: { '.wasm': 'binary', '.woff': 'binary', '.otf': 'binary' },
});
const mf = new Miniflare(
  convertV4MiniflareOptions({
    port: 5178,
    workers: [
      {
        name: 'web',
        modules: true,
        script: `export default {fetch(r,e) {return new URL(r.url).pathname.startsWith('/api/') ? e.API.fetch(r) : e.ASSETS.fetch(r)}}`,
        serviceBindings: {
          API: 'api',
          ASSETS: async (req: Request) => {
            const path = new URL(req.url).pathname;
            const file = '.tmp/r14/app' + (path.includes('.') ? path : '/index.html');
            if (!existsSync(file)) return new Response('Not found', { status: 404 });
            const type = path.endsWith('.js')
              ? 'text/javascript'
              : path.endsWith('.css')
                ? 'text/css'
                : path.endsWith('.svg')
                  ? 'image/svg+xml'
                  : path.endsWith('.png')
                    ? 'image/png'
                    : path.endsWith('.woff2')
                      ? 'font/woff2'
                      : path.endsWith('.mp3')
                        ? 'audio/mpeg'
                        : 'text/html';
            return new Response(readFileSync(file), {
              headers: { ...SECURITY_HEADERS, 'content-type': type },
            });
          },
        },
      },
      {
        name: 'api',
        modules: true,
        script: compiled.outputFiles[0].text,
        compatibilityDate: '2026-11-20',
        d1Databases: ['DB'],
        durableObjects: {
          REGISTRY: { className: 'Registry', useSQLite: true },
          IMAGE_CACHE: { className: 'ImageCache', useSQLite: true },
        },
        bindings: {
          LOCAL_TEST: 'true',
          STAGING: 'true',
          COOKIE_SECRET: 'r14-local-only',
          ADMIN_TOKEN: 'r14-local-admin',
          TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
        },
      },
    ],
  }),
);
const db = await mf.getD1Database('DB', 'api');
for (const file of readdirSync('migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort())
  await db.exec(
    readFileSync('migrations/' + file, 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/CREATE TRIGGER[\s\S]*?\nEND;/g, (m) => m.replace(/\n/g, ' '))
      .replace(/\n/g, ' '),
  );
await db
  .prepare(
    'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)',
  )
  .bind('practice', registryDate(), 'Animals', 'animals', 2200, dropAt(registryDate()), 'approved')
  .run();
const names = [
  'Okapi',
  'Quokka',
  'Wombat',
  'Pangolin',
  'Narwhal',
  'Aardvark',
  'Capybara',
  'Axolotl',
  'Cat',
  'Dog',
  ...Array.from({ length: 120 }, (_, i) => 'Practice animal ' + i),
];
for (const [i, name] of names.entries()) {
  const canonical = name.toLowerCase().replace(/\W/g, '');
  await db
    .prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)')
    .bind('local' + i, 'practice', canonical, name, '[]', null)
    .run();
  await db
    .prepare('INSERT INTO answer_keys VALUES(?,?,?)')
    .bind('practice', canonical, 'local' + i)
    .run();
}
await mf.ready;
console.log('R14 isolated API and production frontend ready at http://127.0.0.1:5178');
process.on('SIGTERM', async () => {
  await mf.dispose();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await mf.dispose();
  process.exit(0);
});
