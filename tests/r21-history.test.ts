import { it, expect, vi, afterEach } from 'vitest';
vi.mock('../worker/routes', () => ({
  json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
}));
import { flowHistory } from '../worker/flow-history';
afterEach(() => vi.useRealTimers());
it('authenticates before reads, rejects invalid/open dates, bounds two-night reads and returns real intersections', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-28T06:00Z'));
  let calls = 0;
  const file = (id: string, hidden = false) => ({
    user: { id, handle: id, hidden },
    file: {
      claims: [{ id: id + '-claim' }],
      dibs: 1,
      strikes: 0,
      points: 10,
      reachedAt: '2026-11-24',
      closed: true,
      events: [],
    },
  });
  const env: any = {
    ADMIN_TOKEN: 'fixture-token',
    DB: {
      prepare(sql: string) {
        calls++;
        return {
          bind() {
            return {
              all: async () => ({
                results: sql.includes('SELECT id,date')
                  ? [
                      { id: 'first', date: '2026-11-23' },
                      { id: 'next', date: '2026-11-24' },
                    ]
                  : [
                      { category_id: 'first', user_id: 'a', data: JSON.stringify(file('a')) },
                      { category_id: 'first', user_id: 'b', data: JSON.stringify(file('b')) },
                      { category_id: 'next', user_id: 'a', data: JSON.stringify(file('a')) },
                      { category_id: 'next', user_id: 'b', data: JSON.stringify(file('b', true)) },
                    ],
              }),
            };
          },
        };
      },
    },
  };
  const req = (date: string, token = 'fixture-token') =>
    new Request('https://fixture/api/admin/r21-night?date=' + date, {
      headers: { authorization: 'Bearer ' + token },
    });
  expect((await flowHistory(req('2026-11-23', 'wrong'), env)).status).toBe(404);
  expect(calls).toBe(0);
  expect((await flowHistory(req('2026-02-30'), env)).status).toBe(422);
  expect((await flowHistory(req('2026-11-28'), env)).status).toBe(422);
  const d: any = await (await flowHistory(req('2026-11-23'), env)).json();
  expect(d.returnRate).toMatchObject({ complete: true, claimers: 2, returned: 1, rate: 0.5 });
  expect(calls).toBe(2);
  await flowHistory(req('2026-11-23'), env);
  expect(calls).toBe(2);
  expect(JSON.stringify(d)).not.toContain('-claim');
});
