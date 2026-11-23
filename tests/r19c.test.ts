import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdirSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { resolvePopularity } from '../scripts/popularity-aliases';
import { archiveCsv, validateArchive } from '../shared/feedback-archive';
import { archiveFeedback } from '../scripts/feedback-archive';
import { readCategory } from '../scripts/category-file';
import { rankPopularity } from '../worker/scoring';
let mf: Miniflare, db: any;
const base = 'https://dibs.here/api';
const request = (method = 'GET', value?: any, token = 'test-admin') =>
  mf.dispatchFetch(base + '/admin/feedback-archive', {
    method,
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: value ? JSON.stringify(value) : undefined,
  });
beforeAll(async () => {
  const code = await build({
    stdin: {
      contents:
        "import { feedbackArchiveRoute } from './worker/feedback-archive'; export default {fetch:feedbackArchiveRoute};",
      resolveDir: process.cwd(),
    },
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
          name: 'feedback-archive-test',
          modules: true,
          script: code.outputFiles[0].text,
          compatibilityDate: '2026-11-20',
          d1Databases: ['DB'],
          bindings: { ADMIN_TOKEN: 'test-admin', COOKIE_SECRET: 'test-secret' },
        },
      ],
    }),
  );
  db = await mf.getD1Database('DB');
  await db.exec(
    'CREATE TABLE feedback(id TEXT PRIMARY KEY,user_id TEXT,text TEXT,created_at TEXT);',
  );
}, 30000);
afterAll(async () => {
  vi.restoreAllMocks();
  await mf?.dispose();
});
it('maps retained shared-article readings without invented values, leaving ambiguous readings missing', () => {
  const reading = { title: 'Green iguana', total: 7732, days: 29 };
  const resolved = resolvePopularity([
    { display: 'Green iguana', aliases: ['Iguana iguana'], pageviews: reading },
    { display: 'Common iguana', pageviews: { title: 'Green iguana', total: null, days: 0 } },
    { display: 'Unknown' },
  ]);
  expect(resolved.before).toBe(2);
  expect(resolved.after).toBe(1);
  expect(resolved.readings[1]).toEqual(reading);
  expect(
    resolvePopularity([
      { display: 'A', aliases: ['shared'], pageviews: { total: 1, days: 1 } },
      { display: 'B', aliases: ['shared'], pageviews: { total: 2, days: 1 } },
      { display: 'shared' },
    ]).after,
  ).toBe(1);
  const animals = readCategory('categories/animals.json');
  const result = resolvePopularity(animals.answers);
  const common = animals.answers.findIndex((a: any) => a.display === 'Common iguana');
  const green = animals.answers.findIndex((a: any) => a.display === 'Green iguana');
  expect(result.readings[common]).toEqual(result.readings[green]);
  const scores = rankPopularity(
    result.readings.map((p) => (p && p.days > 0 && p.total != null ? p.total / p.days : null)),
  );
  expect(scores.percentiles[common]).toBe(scores.percentiles[green]);
  expect(rankPopularity([10, null, 20]).percentiles[1]).toBeNull();
});
it('requires admin authentication for export and exact-id deletion', async () => {
  for (const method of ['GET', 'POST'])
    expect(
      (await request(method, method === 'POST' ? { ids: ['a'] } : undefined, 'wrong')).status,
    ).toBe(404);
  for (const invalid of [
    {},
    { ids: 'all' },
    { ids: ['a', 'a'] },
    { ids: ['x);DELETE FROM feedback'] },
    { ids: [], all: true },
  ])
    expect((await request('POST', invalid)).status).toBe(422);
});
it('exports only anonymous fields and deletes the snapshot ids, retaining later arrivals', async () => {
  await db
    .prepare('INSERT INTO feedback VALUES(?,?,?,?)')
    .bind(
      'old',
      'raw-private-user',
      'Privacy question: <script>untrusted</script>',
      '2026-11-23T12:00:00Z',
    )
    .run();
  const result: any = await (await request()).json();
  const notes = validateArchive(result.notes);
  expect(notes).toHaveLength(1);
  expect(notes[0]).toMatchObject({
    id: 'old',
    topic: 'privacy',
    text: '<script>untrusted</script>',
  });
  expect(JSON.stringify(notes)).not.toMatch(/user_id|raw-private-user|cookie|ip_address/);
  await db
    .prepare('INSERT INTO feedback VALUES(?,?,?,?)')
    .bind('new', 'other-user', 'Arrived later', '2026-11-23T12:01:00Z')
    .run();
  expect(await (await request('POST', { ids: notes.map((n) => n.id) })).json()).toEqual({
    removed: 1,
  });
  expect((await db.prepare('SELECT id FROM feedback').all()).results).toEqual([{ id: 'new' }]);
  expect((await request('POST', { ids: [] })).status).toBe(200);
});
it('writes private JSON and CSV, verifies them before deletion, and preserves feedback on write failures or dry runs', async () => {
  const root = '.tmp/r19c/archive-' + crypto.randomUUID();
  mkdirSync(root, { recursive: true });
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      const files = readdirSync(root);
      expect(files.some((n) => n.endsWith('.json'))).toBe(true);
      expect(files.some((n) => n.endsWith('.csv'))).toBe(true);
    }
    return (await mf.dispatchFetch(String(url), init as any)) as unknown as Response;
  });
  const now = new Date('2026-11-23T12:00:00Z');
  expect(
    await archiveFeedback(base, 'test-admin', { directory: root, now, dryRun: true }),
  ).toContain('nothing removed');
  expect(fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(0);
  for (const name of readdirSync(root))
    expect(statSync(root + '/' + name).mode & 0o777).toBe(0o600);
  const notes = validateArchive(JSON.parse(readFileSync(root + '/2026-11-23_1200.json', 'utf8')));
  expect(readFileSync(root + '/2026-11-23_1200.csv', 'utf8')).toBe(archiveCsv(notes));
  await expect(archiveFeedback(base, 'test-admin', { directory: root, now })).rejects.toThrow();
  expect(fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(0);
  expect(
    await archiveFeedback(base, 'test-admin', {
      directory: root,
      now: new Date('2026-11-23T12:01:00Z'),
    }),
  ).toContain('removed them from the site');
  expect(await archiveFeedback(base, 'test-admin', { directory: root })).toBe(
    'No feedback to archive.',
  );
  fetchMock.mockRestore();
});
it('quotes multiline CSV text and neutralizes spreadsheet formulas without changing the JSON', () => {
  const note = {
    id: 'one',
    topic: 'game',
    text: '=HYPERLINK("malicious")\nnew line',
    created_at: 'now',
    player_hash: 'a'.repeat(64),
  };
  expect(archiveCsv([note])).toContain('"\'=HYPERLINK(""malicious"")\nnew line"');
  expect(note.text).toBe('=HYPERLINK("malicious")\nnew line');
  expect(() => validateArchive([{ ...note, user_id: 'private' }])).toThrow();
});
