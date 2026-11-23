import { assertPublicPayload, assertOwnerSharedPayload, shapes } from './public-payload-schema';
import { it, expect } from 'vitest';
import { concealSummary, visibleClaim, publicSummary } from '../worker/visibility';
import { dropAt, registryDate } from '../worker/domain';
it('drops unknown and answer-resolving fields recursively, including cached old shapes', () => {
  const poison = { answer_id: 'catalog:version:12', user_id: 'private', futureSecret: 'answer' };
  const claim = { ...poison, id: 'safe', display: 'SECRET', golden: true, percentile: 0.98 };
  const data = {
    ...poison,
    category: { ...poison, id: 'animals', name: 'Animals' },
    file: {
      ...poison,
      claims: [claim],
      events: [{ ...poison, at: 'now', kind: 'dibs', display: 'SECRET', golden: true }],
      points: 150,
    },
    specials: { ...poison, clue: { ...poison, text: 'clue' }, reveal: { seed: 'private' } },
  };
  const sealed = JSON.stringify(concealSummary(data));
  expect(sealed).not.toMatch(
    /SECRET|private|futureSecret|answer_id|user_id|"golden"|"percentile"|"display"/,
  );
  for (const owned of [false, true])
    for (const revealed of [false, true]) {
      const c = visibleClaim(claim, revealed, owned);
      expect(c).not.toHaveProperty('answer_id');
      expect(c).not.toHaveProperty('user_id');
      expect(c).not.toHaveProperty('futureSecret');
      expect(c.display).toBe(owned || revealed ? 'SECRET' : undefined);
    }
  const closed = publicSummary({ ...data, specials: null }, true);
  expect(closed.file.claims[0].display).toBe('SECRET');
  expect(JSON.stringify(closed)).not.toMatch(/answer_id|user_id|futureSecret/);
});
it('opens tonight at 9 PM Toronto and respects the DST transition', () => {
  expect(dropAt('2026-11-23')).toBe('2026-11-24T02:00:00.000Z');
  expect(dropAt('2026-10-31')).toBe('2026-11-01T01:00:00.000Z');
  expect(dropAt('2026-11-01')).toBe('2026-11-02T02:00:00.000Z');
  expect(registryDate(new Date('2026-11-24T01:59:59Z'))).toBe('2026-11-22');
  expect(registryDate(new Date('2026-11-24T02:00:00Z'))).toBe('2026-11-23');
});

it('allows answers only in an explicitly shared owner summary schema', () => {
  const data = {
    category: { id: 'animals', name: 'Animals' },
    file: {
      claims: [{ id: 'own', display: 'Quokka', points: 160, bonus: 100, golden: true }],
      events: [
        { at: 'now', kind: 'dibs', claimId: 'own', display: 'Quokka', golden: true },
        { at: 'now', kind: 'strike', display: 'SECRET', holder: 'Other player' },
      ],
    },
  };
  const sealed = JSON.parse(JSON.stringify(publicSummary(data)));
  assertPublicPayload(sealed, shapes.summary);
  expect(JSON.stringify(sealed)).not.toMatch(/Quokka|SECRET|Other player/);
  const shared = JSON.parse(JSON.stringify(publicSummary(data, false, true)));
  assertOwnerSharedPayload(shared, 'summary');
  expect(JSON.stringify(shared)).not.toMatch(/SECRET|Other player/);
  expect(() => assertPublicPayload(shared, shapes.summary)).toThrow();
  expect(() => assertOwnerSharedPayload(sealed, 'summary')).toThrow();
});
