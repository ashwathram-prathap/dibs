import { describe, expect, it } from 'vitest';
import { needsRollout } from '../scripts/calendar-preflight.mjs';

const now = Date.parse('2026-11-24T12:00:00Z');
const recipe = {
  slug: 'cities',
  name: 'Cities',
  requestNames: ['Cities', 'Saint Louis'],
  snapshotSha256: 'pinned',
};
const coverage = [{ slug: 'cities', ready: true }];
function state() {
  return {
    library: [{ slug: 'cities', ready: true, uploaded: true, recipe: { ...recipe } }],
    days: Array.from({ length: 60 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 10, 24 + i, 12)).toISOString().slice(0, 10),
      dropAt: new Date(Date.UTC(2026, 10, 25 + i, 2)).toISOString(),
      slug: 'cities',
      status: 'ready',
      readOnly: false,
      request: null as string | null,
    })),
  };
}
const decide = (s = state()) => needsRollout(s, [recipe], coverage, now);
describe('calendar preflight (local only)', () => {
  it('skips a complete calendar with the already-published library', () => {
    expect(decide()).toEqual({ needed: false, reasons: [] });
  });
  it('builds requested days through the seven-day boundary, not later days', () => {
    const s = state();
    s.days[8].status = 'requested';
    expect(decide(s).needed).toBe(false);
    s.days[7].status = 'building';
    expect(decide(s).reasons).toContain('pending-day');
  });
  it.each(['empty', 'failed', 'needs recipe'])(
    'does not suppress the 48-hour %s fallback',
    (status) => {
      const s = state();
      s.days[4].status = status;
      expect(decide(s).needed).toBe(false);
      s.days[1].status = status;
      expect(decide(s).reasons).toContain('48-hour-fallback');
    },
  );
  it('recognizes a newly matchable future request, including normalized recipe aliases', () => {
    const s = state();
    s.days[20].status = 'needs recipe';
    s.days[20].request = 'St. Louis';
    expect(decide(s).reasons).toContain('matched-request');
    s.days[20].request = 'Unimplemented topic';
    expect(decide(s).needed).toBe(false);
  });
  it('rebuilds missing, changed or unuploaded library recipes', () => {
    const s = state();
    s.library[0].recipe.snapshotSha256 = 'changed';
    expect(decide(s).reasons).toContain('library-update');
    s.library = [];
    expect(decide(s).needed).toBe(true);
    const unpublished = state();
    unpublished.library[0].uploaded = false;
    expect(decide(unpublished).needed).toBe(true);
  });
  it('does not mutate past or read-only days', () => {
    const s = state();
    s.days[0].status = 'requested';
    s.days[0].readOnly = true;
    expect(decide(s).needed).toBe(false);
    s.days[0].readOnly = false;
    s.days[0].dropAt = new Date(now - 1).toISOString();
    expect(decide(s).needed).toBe(false);
  });
  it('fails closed on truncated or malformed responses instead of skipping work', () => {
    const s = state();
    s.days[0].dropAt = 'bad';
    expect(() => decide(s)).toThrow();
    s.days.pop();
    expect(() => decide(s)).toThrow();
    expect(() => needsRollout(state(), [], [], now)).toThrow();
  });
});
