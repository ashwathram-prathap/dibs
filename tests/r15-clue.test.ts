import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { specialStatus } from '../worker/specials';
import { cluedId } from '../worker/clue';
let mf: Miniflare, db: any;
beforeAll(async () => {
  const built = await build({entryPoints:['worker/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers'],loader:{'.wasm':'binary','.woff':'binary','.otf':'binary'}});
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'clue-test',
          modules: true,
          script: built.outputFiles[0].text,
          durableObjects:{REGISTRY:{className:'Registry',useSQLite:true},IMAGE_CACHE:{className:'ImageCache',useSQLite:true}},
          bindings:{LOCAL_TEST:'true',COOKIE_SECRET:'clue-test-secret',ADMIN_TOKEN:'clue-test-admin',TURNSTILE_SITE_KEY:'test'},
          compatibilityDate: '2026-11-20',
          d1Databases: ['DB'],
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
        .replace(/\n/g, ' '),
    );
  await db
    .prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)',
    )
    .bind('clue', '2026-11-23', 'Animals', 'test-clue', 2400, '2026-11-24T02:00:00Z', 'approved')
    .run();
  for (let i = 0; i < 20; i++)
    await db
      .prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)')
      .bind(
        'clue-' + i,
        'clue',
        'test' + i,
        'Private animal ' + String.fromCharCode(65 + i),
        '[]',
        3,
      )
      .run();
});
afterAll(async () => {
  vi.useRealTimers();
  await mf.dispose();
});
it('withholds the clue before drop, reveals no answer while live, shows cracked handle, and marks exactly one archived ticket', async () => {
  const g = await db.prepare('SELECT * FROM categories WHERE id=?').bind('clue').first();
  const env: any = { DB: db };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T01:59:59Z'));
  expect(((await specialStatus(env, g)) as any).clue).toBeNull();
  vi.setSystemTime(new Date('2026-11-24T02:00:00Z'));
  const live: any = await specialStatus(env, g);
  expect(live.clue.text).toMatch(/One of tonight's 10 golden tickets:/);
  expect(JSON.stringify(live)).not.toContain('Private animal');
  expect(live.reveal).toBeUndefined();
  const saved = await db
    .prepare('SELECT * FROM daily_specials WHERE category_id=?')
    .bind('clue')
    .first();
  const id = cluedId(JSON.parse(saved.golden_json), saved.commitment);
  await db
    .prepare('INSERT INTO users(id,handle,created_at) VALUES(?,?,?)')
    .bind('winner', 'Teal Otter', '2026-11-24T02:00:00Z')
    .run();
  await db
    .prepare(
      'INSERT INTO claims(id,category_id,answer_id,user_id,claim_no,created_at,ip_hash,ip_day) VALUES(?,?,?,?,?,?,?,?)',
    )
    .bind('winning-clue', 'clue', id, 'winner', 1, '2026-11-24T02:00:01Z', '', '2026-11-23')
    .run();
  const cracked: any = await specialStatus(env, g);
  expect(cracked.clue.crackedBy).toBe('Teal Otter');
  expect(JSON.stringify(cracked)).not.toContain('Private animal');
  vi.setSystemTime(new Date('2026-11-25T02:00:01Z'));
  const archive: any = await specialStatus(env, g, true);
  expect(archive.reveal.answers.filter((a: any) => a.clued)).toEqual([
    expect.objectContaining({ id, clued: true }),
  ]);
  vi.useRealTimers();
});

it('keeps future clues and answers out of bootstrap, sockets and static HTML', async () => {
  const headers={origin:'https://dibs.here'};
  const response=await mf.dispatchFetch('http://localhost/api/bootstrap',{headers});
  const cookie=response.headers.get('set-cookie')!.split(';')[0];
  const data=await response.json() as any;
  expect(data.today.category).toBeNull();
  expect(JSON.stringify(data)).not.toMatch(/Private animal|One of tonight's|golden_json/);
  const upgrade=await mf.dispatchFetch('http://localhost/api/live',{headers:{...headers,cookie,Upgrade:'websocket'}});
  const ws=upgrade.webSocket!;expect(ws).toBeTruthy();ws.accept();
  const message=await new Promise<string>(resolve=>ws.addEventListener('message',e=>resolve(String(e.data)),{once:true}));
  expect(message).not.toMatch(/Private animal|One of tonight's|golden_json/);ws.close(1000);
  expect(readFileSync('dist/index.html','utf8')).not.toMatch(/Private animal|One of tonight's|golden_json/);
});
