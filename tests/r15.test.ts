import { it, expect, vi } from 'vitest';
import { cluedId, clueText, clueEnabled } from '../worker/clue';
import { clientIp, securityKey } from '../worker/security';
import { summaryText } from '../src/share';
import { mayReload } from '../src/version';
import { api, PACKED_MESSAGE } from '../src/api';
import { readFileSync } from 'node:fs';
it('chooses only one committed golden deterministically, without mutation, and uses configured counts', () => {
  const ids = ['z', 'a', 'b'];
  expect(cluedId(ids, 'abcdef01')).toBe(cluedId([...ids].reverse(), 'abcdef01'));
  expect(ids).toEqual(['z', 'a', 'b']);
  expect(cluedId([], 'abcdef01')).toBeNull();
  expect(clueText('Capybara', '2026-11-23', 'a rodent')).toBe(
    "One of tonight's 10 golden tickets: a rodent, 8 letters, starts with C.",
  );
  expect(clueText('New York', '2026-11-30')).toBe(
    "One of tonight's 3 golden tickets: 7 letters, starts with N.",
  );
  const g = { date: '2026-11-23', drop_at: '2026-11-24T02:00:00Z' };
  expect(clueEnabled(g, Date.parse(g.drop_at) - 1)).toBe(false);
  expect(clueEnabled(g, Date.parse(g.drop_at))).toBe(true);
  expect(clueEnabled({ ...g, date: '2026-11-30' }, Date.parse(g.drop_at))).toBe(false);
});
it('never assigns missing IPs a shared rate or admin lockout key; ignores forged local headers remotely', async () => {
  const r = new Request('https://dibs.here/api/claim', { headers: { 'x-test-ip': 'spoof' } });
  expect(clientIp(r, 'true')).toBeNull();
  expect(await securityKey(r, 'secret', 'true')).toBeNull();
  expect(
    await securityKey(new Request(r, { headers: { 'CF-Connecting-IP': '192.0.2.1' } }), 'secret'),
  ).not.toBe(
    await securityKey(new Request(r, { headers: { 'CF-Connecting-IP': '192.0.2.2' } }), 'secret'),
  );
});
it('preserves the guard clauses for file closure, hidden players and category matching byte for byte', () => {
  const original = readFileSync('migrations/0005_three_dibs.sql', 'utf8');
  const next = readFileSync('migrations/0014_shared_networks.sql', 'utf8');
  for (const line of original
    .split('\n')
    .filter((l) => /RAISE\(ABORT,'(FILE_CLOSED|USER_HIDDEN|CATEGORY_MISMATCH)'/.test(l)))
    expect(next).toContain(line);
});
it('prints ordered claim/gold/strike squares, no answers, and omits absent rank', () => {
  const file: any = {
    events: [
      { kind: 'dibs', display: 'secret' },
      { kind: 'strike', display: 'other' },
      { kind: 'dibs', golden: true },
      { kind: 'strike', house: true },
      { kind: 'dibs' },
    ],
    points: 140,
    streak: 1,
  };
  expect(summaryText(file, { date: '2026-11-23', name: 'Animals' } as any)).toBe(
    "Dibs #1 · Nov 23 · Animals · 140 pts. dibs.here",
  );
});
it('reloads newer builds only when closed or done and never while typing', () => {
  expect(mayReload({ today: { category: null } } as any, false)).toBe(true);
  expect(mayReload({ today: { category: { id: 'a' } } } as any, false)).toBe(false);
  expect(
    mayReload({ today: { category: { id: 'a' } }, me: { file: { closed: true } } } as any, false),
  ).toBe(true);
  expect(mayReload({ today: { category: null } } as any, true)).toBe(false);
});
it.each(['network', 'html-quota', 'json-quota'])(
  'keeps a readable packed message for %s',
  async (kind) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (kind === 'network') throw Error('offline');
        return kind === 'html-quota'
          ? new Response('error 1027', { status: 429 })
          : Response.json({ code: 1027 }, { status: 429 });
      }),
    );
    try {
      await expect(api('/bootstrap')).rejects.toThrow(PACKED_MESSAGE);
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
