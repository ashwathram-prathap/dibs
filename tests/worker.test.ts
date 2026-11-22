import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { registryDate, dropAt, normalize } from '../worker/domain';
let mf: Miniflare;
let db: any;
let verification = { success: false, hostname: 'dibs.here', action: 'claim' };
const request = (path: string, body?: any, cookie?: string, ip?: string) =>
  mf.dispatchFetch('http://localhost/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: 'https://dibs.here',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(ip ? { 'x-test-ip': ip } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function account() {
  const r = await request('/me');
  return { cookie: r.headers.get('set-cookie')!.split(';')[0], ...((await r.json()) as any) };
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
      workers: [
        {
          name: 'test',
          modules: true,
          script: result.outputFiles[0].text,
          compatibilityDate: '2026-11-20',
          d1Databases: ['DB'],
          outboundService: async (req: Request) => {
            if (
              new URL(req.url).href !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
            )
              throw Error('Unexpected outbound request');
            return Response.json(verification);
          },
          bindings: {
            COOKIE_SECRET: 'test-secret-not-for-production',
            ADMIN_TOKEN: 'test-admin',
            LOCAL_TEST: 'true',
            SITE_URL: 'http://localhost',
            TURNSTILE_SITE_KEY: 'test',
            TURNSTILE_SECRET: 'test-verification-only',
          },
        },
      ],
    }),
  );
  db = await mf.getD1Database('DB');
  await db.exec(
    readFileSync('migrations/0001_registry.sql', 'utf8').replace(
      /CREATE TRIGGER[\s\S]*?\nEND;/g,
      (m) => m.replace(/\n/g, ' '),
    ),
  );
  await db.exec(
    readFileSync('migrations/0002_foreign_key_indexes.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  await db.exec(
    readFileSync('migrations/0005_three_dibs.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  await db.exec(
    readFileSync('migrations/0006_file_event_order.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  await db.exec(
    readFileSync('migrations/0007_daily_specials.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .replace(/\n/g, ' '),
  );
  const date = registryDate();
  await db
    .prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status) VALUES(?,?,?,?,?,?,?)',
    )
    .bind('test', date, 'Animals', 'test-animals', 2400, dropAt(date), 'approved')
    .run();
  for (let i = 0; i < 70; i++) {
    const display = i === 0 ? 'Axolotl' : 'Test animal ' + i;
    await db
      .prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)')
      .bind('answer-' + i, 'test', normalize(display), display, '[]', 3)
      .run();
    await db
      .prepare('INSERT INTO answer_keys VALUES(?,?,?)')
      .bind('test', normalize(display), 'answer-' + i)
      .run();
  }
}, 30000);
afterAll(async () => {
  await mf?.dispose();
});
describe('Worker with real SQLite/D1 execution', () => {
  it('50 simultaneous attempts yield one 201 and 49 conflicts', async () => {
    const accounts = await Promise.all(Array.from({ length: 50 }, account));
    const responses = await Promise.all(
      accounts.map((a, i) =>
        request(
          '/claim',
          { answer: 'Axolotl', turnstileToken: 'test' },
          a.cookie,
          'concurrency-' + i,
        ),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(49);
    const rows = await db.prepare('SELECT * FROM claims WHERE answer_id=?').bind('answer-0').all();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0].claim_no).toBe(1);
  }, 30000);
  it('one user can claim at most three times, including concurrently', async () => {
    const a = await account();
    const rs = await Promise.all(
      [1, 2, 3, 4, 60, 61, 62, 63].map((i) =>
        request(
          '/claim',
          { answer: 'Test animal ' + i, turnstileToken: 'test' },
          a.cookie,
          'double',
        ),
      ),
    );
    expect(rs.filter((r) => r.status === 201)).toHaveLength(3);
    expect(rs.filter((r) => r.status === 403)).toHaveLength(5);
    expect(
      (await db.prepare('SELECT COUNT(*) n FROM claims WHERE user_id=?').bind(a.user.id).first()).n,
    ).toBe(3);
    const reload = (await (await request('/me', undefined, a.cookie)).json()) as any;
    expect(reload.file.dibs).toBe(3);
    expect(reload.file.closed).toBe(true);
  });
  it('atomic taken strikes cap at five, persist, and close the file', async () => {
    const a = await account();
    const invalid = await request(
      '/claim',
      { answer: 'not in register', turnstileToken: 'test' },
      a.cookie,
    );
    expect(invalid.status).toBe(422);
    expect(((await invalid.json()) as any).message).toBe(
      "Not on today's register. Check the spelling.",
    );
    const rs = await Promise.all(
      Array.from({ length: 10 }, () =>
        request('/claim', { answer: 'Axolotl', turnstileToken: 'test' }, a.cookie),
      ),
    );
    expect(rs.filter((r) => r.status === 409)).toHaveLength(5);
    expect(rs.filter((r) => r.status === 403)).toHaveLength(5);
    const me = (await (await request('/me', undefined, a.cookie)).json()) as any;
    expect(me.file.strikes).toBe(5);
    expect(me.file.dibs).toBe(0);
    expect(me.file.closed).toBe(true);
    expect(
      (await request('/claim', { answer: 'Test animal 59', turnstileToken: 'test' }, a.cookie))
        .status,
    ).toBe(403);
  });
  it('enforces five successful accounts per daily IP atomically', async () => {
    const accounts = await Promise.all(Array.from({ length: 8 }, account));
    const rs = await Promise.all(
      accounts.map((a, i) =>
        request(
          '/claim',
          { answer: 'Test animal ' + (i + 5), turnstileToken: 'test' },
          a.cookie,
          'shared-network',
        ),
      ),
    );
    expect(rs.filter((r) => r.status === 201)).toHaveLength(5);
    expect(rs.filter((r) => r.status === 429)).toHaveLength(3);
    const hashes = await db.prepare('SELECT ip_hash FROM rate_limits').all();
    expect(hashes.results.every((x: any) => /^[a-f0-9]{64}$/.test(x.ip_hash))).toBe(true);
  });
  it('limits attempts to three in a rolling minute', async () => {
    const a = await account();
    const rs = await Promise.all(
      Array.from({ length: 13 }, () =>
        request('/claim', { answer: 'missing', turnstileToken: 'test' }, a.cookie),
      ),
    );
    expect(rs.filter((r) => r.status === 422)).toHaveLength(12);
    expect(rs.filter((r) => r.status === 429)).toHaveLength(1);
  });
  it('locks re-rolls at three', async () => {
    const a = await account();
    await db
      .prepare('INSERT INTO users(id,handle,created_at) VALUES(?,?,?)')
      .bind(a.user.id, a.user.handle, new Date().toISOString())
      .run();
    for (let i = 0; i < 3; i++)
      expect((await request('/me/reroll', {}, a.cookie)).status).toBe(200);
    expect((await request('/me/reroll', {}, a.cookie)).status).toBe(403);
  });
  it('rejects blocked cookies, cross-origin writes and unsigned admin requests', async () => {
    expect((await request('/session-check', {})).status).toBe(401);
    const r = await mf.dispatchFetch('http://localhost/api/claim', {
      method: 'POST',
      headers: { origin: 'https://dibs.here', origin: 'https://elsewhere.example' },
      body: '{}',
    });
    expect(r.status).toBe(403);
    expect((await request('/admin/stats')).status).toBe(404);
  });
  it('autocomplete never reveals ownership and ledger serials are unique', async () => {
    const r = await request('/answers?q=axo');
    expect(await r.json()).toEqual({ answers: [] });
    const rows = ((await (await request('/ledger?category=test')).json()) as any).rows;
    expect(new Set(rows.map((r: any) => r.claim_no)).size).toBe(rows.length);
  });
  it('never exposes draft registers', async () => {
    await db.prepare("UPDATE categories SET status='draft' WHERE id='test'").run();
    const today = (await (await request('/today')).json()) as any;
    expect(today.category).toBeNull();
    const before = (await db.prepare('SELECT COUNT(*) n FROM users').first()).n;
    expect(((await (await request('/me')).json()) as any).user).toBeNull();
    expect((await db.prepare('SELECT COUNT(*) n FROM users').first()).n).toBe(before);
    expect(((await (await request('/ledger?category=test')).json()) as any).rows).toHaveLength(0);
    await db.prepare("UPDATE categories SET status='approved' WHERE id='test'").run();
  });
  it('imports a complete draft atomically and rejects alias collisions', async () => {
    const upload = async (body: any) =>
      mf.dispatchFetch('http://localhost/api/admin/category', {
        method: 'POST',
        headers: {
          origin: 'https://dibs.here',
          authorization: 'Bearer test-admin',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    const answers = Array.from({ length: 2000 }, (_, i) => ({
      display: 'Test catalog entry ' + i,
      aliases: [],
      obscurity: 3,
    }));
    const result = await upload({
      id: 'test-catalog',
      slug: 'test-catalog',
      name: 'Test catalog',
      status: 'draft',
      answers,
    });
    expect(result.status).toBe(201);
    expect(
      (
        await db
          .prepare('SELECT COUNT(*) n FROM answers WHERE category_id=?')
          .bind('test-catalog')
          .first()
      ).n,
    ).toBe(2000);
    expect(
      (await db.prepare('SELECT status FROM categories WHERE id=?').bind('test-catalog').first())
        .status,
    ).toBe('draft');
    answers[0].aliases = ['shared alias'] as never[];
    answers[1].aliases = ['shared alias'] as never[];
    expect(
      (await upload({ id: 'test-invalid', slug: 'test-invalid', name: 'Invalid', answers })).status,
    ).toBe(422);
    expect(
      await db.prepare('SELECT id FROM categories WHERE id=?').bind('test-invalid').first(),
    ).toBeNull();
  });
  it('replaces only unclaimed drafts, and invalid replacements preserve the original', async () => {
    const upload = (body: any) =>
      mf.dispatchFetch('http://localhost/api/admin/category', {
        method: 'POST',
        headers: {
          origin: 'https://dibs.here',
          authorization: 'Bearer test-admin',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    const draft = {
      id: 'replace-me',
      slug: 'replace-me',
      name: 'Review draft',
      answers: Array.from({ length: 2000 }, (_, i) => ({
        display: 'Original entry ' + i,
        aliases: [] as string[],
        obscurity: 3,
      })),
    };
    expect((await upload(draft)).status).toBe(201);
    expect((await upload(draft)).status).toBe(409);
    const revised = {
      ...draft,
      replaceDraft: true,
      answers: draft.answers.map((a, i) => ({ ...a, display: 'Revised entry ' + i })),
    };
    const bad = {
      ...revised,
      answers: revised.answers.map((a) => ({ ...a, aliases: ['same alias'] })),
    };
    expect((await upload(bad)).status).toBe(422);
    expect(
      (await db.prepare("SELECT display FROM answers WHERE id='replace-me:0'").first()).display,
    ).toBe('Original entry 0');
    expect((await upload(revised)).status).toBe(201);
    const unchanged = await upload(revised);
    expect(unchanged.status).toBe(200);
    expect(((await unchanged.json()) as any).unchanged).toBe(true);
    const plan = await db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT answer_id FROM answer_keys WHERE answer_id='replace-me:0'",
      )
      .all();
    expect(plan.results.some((r: any) => String(r.detail).includes('answer_keys_answer_id'))).toBe(
      true,
    );
    expect(
      (await db.prepare("SELECT display FROM answers WHERE id='replace-me:0'").first()).display,
    ).toBe('Revised entry 0');
    expect(
      (
        await db
          .prepare("SELECT COUNT(*) n FROM answer_keys WHERE category_id='replace-me'")
          .first()
      ).n,
    ).toBe(2000);
    const approve = () =>
      mf.dispatchFetch('http://localhost/api/admin/approve', {
        method: 'POST',
        headers: {
          origin: 'https://dibs.here',
          authorization: 'Bearer test-admin',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ id: 'replace-me', date: '2099-01-01', reviewed: true }),
      });
    expect((await approve()).status).toBe(200);
    expect((await approve()).status).toBe(409);
    expect((await upload({ ...draft, replaceDraft: true })).status).toBe(409);
    expect(
      (await db.prepare("SELECT display FROM answers WHERE id='replace-me:0'").first()).display,
    ).toBe('Revised entry 0');
  });
  it('does not accept the localhost verification bypass on a remote hostname', async () => {
    const a = await account();
    const r = await mf.dispatchFetch('https://dibs.here/api/claim', {
      method: 'POST',
      headers: {
        origin: 'https://dibs.here',
        cookie: a.cookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ answer: 'Axolotl', turnstileToken: 'test' }),
    });
    expect(r.status).toBe(400);
  });
  it('rejects siteverify hostname/action mismatches and accepts the canonical result', async () => {
    const a = await account();
    const submit = () =>
      mf.dispatchFetch('https://dibs.here/api/claim', {
        method: 'POST',
        headers: {
          origin: 'https://dibs.here',
          cookie: a.cookie,
          'content-type': 'application/json',
          'cf-connecting-ip': 'turnstile-test',
        },
        body: JSON.stringify({ answer: 'Test animal 69', turnstileToken: 'test' }),
      });
    verification = { success: true, hostname: 'evil.example', action: 'claim' };
    expect((await submit()).status).toBe(400);
    verification = { success: true, hostname: 'dibs.here', action: 'other' };
    expect((await submit()).status).toBe(400);
    verification = { success: true, hostname: 'dibs.here', action: 'claim' };
    expect((await submit()).status).toBe(201);
    verification.success = false;
  });
  it('moderation hides holders and voids certificates without reusing ownership', async () => {
    const row = await db.prepare('SELECT id,user_id FROM claims ORDER BY claim_no LIMIT 1').first();
    const post = async (path: string, id: string) =>
      mf.dispatchFetch('http://localhost/api/admin/' + path, {
        method: 'POST',
        headers: {
          origin: 'https://dibs.here',
          authorization: 'Bearer test-admin',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
    expect((await post('hide-user', row.user_id)).status).toBe(200);
    const cert = (await (await request('/certificate/' + row.id)).json()) as any;
    expect(cert.claim.handle).toBe('Record withheld');
    expect((await post('void-claim', row.id)).status).toBe(200);
    expect((await request('/certificate/' + row.id)).status).toBe(404);
    expect(
      (await db.prepare('SELECT voided FROM claims WHERE id=?').bind(row.id).first()).voided,
    ).toBe(1);
    const today = (await (await request('/today')).json()) as any;
    const reserved = (
      await db.prepare("SELECT COUNT(*) n FROM claims WHERE category_id='test'").first()
    ).n;
    expect(today.voided).toBe(1);
    expect(today.claimed + today.voided).toBe(reserved);
    expect(today.open).toBe(2400 - reserved);
    expect(today.claimed + today.open + today.voided).toBe(today.category.total_registrable);
  });
});
