import { it, expect, vi } from 'vitest';
vi.mock('../src/api', () => ({ api: vi.fn(), isDemo: false }));
import { publish, publishClaim, getSnapshot, subscribe } from '../src/live';
const day = (id: string) =>
  ({
    today: { category: { id }, claimed: 0, open: 100, specials: { goldenFound: 0 } },
    rows: [],
    me: { user: { id: 'owner' }, file: null },
    reset: true,
  }) as any;
const claim = (category_id: string) =>
  ({
    id: category_id + '-claim',
    category_id,
    claim_no: 1,
    golden: false,
    points: 60,
    created_at: '2026-11-28T02:00:00Z',
  }) as any;
it('late accepted replies cannot replace the new registry day or its owner file', () => {
  publish(day('old'));
  const accepted = claim('old');
  publish(day('new'));
  const current = getSnapshot();
  let updates = 0;
  const stop = subscribe(() => updates++);
  publishClaim(accepted, {
    user: { id: 'owner' },
    file: { category_id: 'old', points: 60 },
  } as any);
  expect(getSnapshot()).toBe(current);
  expect(updates).toBe(0);
  stop();
});
it('same-day retries update stored ownership without double-counting the accepted claim', () => {
  publish(day('today'));
  const accepted = claim('today');
  publishClaim(accepted);
  publishClaim(accepted);
  expect(getSnapshot()?.today.claimed).toBe(1);
  expect(getSnapshot()?.today.open).toBe(99);
  expect(getSnapshot()?.rows).toHaveLength(1);
});
