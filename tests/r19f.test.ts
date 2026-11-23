import { publicScores } from '../worker/leaderboard';
import { afterEach, expect, it, vi } from 'vitest';
import { resolveCertificate } from '../shared/certificate-id';
import { rarityLabel, standardScoreLabel } from '../shared/rarity';
import { claimScore } from '../shared/claim-copy';
import { summaryText, certificateText } from '../src/share';
import { sharePrepared } from '../src/native-share';
import { publicSummary } from '../worker/visibility';
afterEach(() => vi.unstubAllGlobals());
it('resolves exact and old printed IDs, and refuses ambiguous or voided records', () => {
  const a = { id: '2026-11-22-ad24b-aaaa' },
    b = { id: '2026-11-22-ad24b-bbbb' };
  expect(resolveCertificate([a], '2026-11-22-ad24b')).toBe(a);
  expect(resolveCertificate([a, b], a.id)).toBe(a);
  expect(resolveCertificate([a, b], '2026-11-22-ad24b')).toBeUndefined();
  expect(resolveCertificate([{ ...a, voided: 1 }], a.id)).toBeUndefined();
});
it('names the reference population for every scoring band', () => {
  for (const p of [0, 0.05, 0.1])
    expect(rarityLabel(p, 'Animals')).toBe('One of the 300 best-known animals');
  for (const p of [0.11, 0.5, 0.94, 0.99])
    expect(rarityLabel(p, 'Animals')).toBe(
      `Rarer than ${Math.round(p * 100)}% of the 3,000 best-known animals`,
    );
  expect(rarityLabel(1, 'Animals')).toBe('Rarer than every one of the 3,000 best-known animals');
  expect(rarityLabel(0.94, 'video-games')).toContain('best-known game titles');
  expect(standardScoreLabel(55)).toBe(
    '55 points · standard score (no readership data for this answer)',
  );
});
const claim: any = {
  id: '2026-11-22-abcd',
  display: 'Okapi',
  category_date: '2026-11-22',
  category_name: 'Animals',
  points: 160,
  bonus: 100,
  golden: true,
  percentile: 0.55,
};
it('keeps stored golden totals, dated editions and owner-answer preference in both captions', () => {
  expect(claimScore(claim)).toContain('160 points');
  expect(claimScore(claim)).toContain('60 + 100 golden bonus');
  const file: any = { claims: [claim], points: 160, rank: 3, players: 8 };
  for (const caption of [
    summaryText(file, { date: '2026-11-22', name: 'Animals' } as any),
    certificateText(claim, file),
  ]) {
    expect(caption).toContain('Dibs #1 · Nov 22');
    expect(caption).toContain('Okapi');
    expect(caption).toContain('#3 of 8 players today');
    expect(caption).not.toContain("today's Dibs");
  }
  expect(summaryText(file, { date: '2026-11-22', name: 'Animals' } as any, true)).not.toContain(
    'Okapi',
  );
  expect(certificateText(claim, file, true)).not.toContain('Okapi');
});
it('owner-shared summaries reveal successful answers only, with private fields excluded', () => {
  const data = {
    category: { id: 'animals', name: 'Animals' },
    file: {
      claims: [{ ...claim, answer_id: 'private', user_id: 'secret' }],
      events: [
        { kind: 'dibs', display: 'Okapi', claimId: claim.id },
        { kind: 'strike', display: 'Lion', holder: 'Someone', house: true },
      ],
    },
    specials: { houseWords: [{ display: 'Lion' }], reveal: { seed: 'secret' } },
  };
  expect(JSON.stringify(publicSummary(data))).not.toContain('Okapi');
  const shared = JSON.stringify(publicSummary(data, false, true));
  expect(shared).toContain('Okapi');
  expect(shared).not.toMatch(/Lion|private|secret|Someone/);
});
for (const [ua, mixed, expected] of [
  ['Android', true, 'file-caption'],
  ['Android', false, 'file'],
  ['iPhone', true, 'file-caption-copied'],
  ['Macintosh', true, 'file-caption-copied'],
] as const) {
  it(`shares ${ua} with mixed capability ${mixed}`, async () => {
    const share = vi.fn(async () => {}),
      writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', {
      userAgent: ua,
      share,
      canShare: (p: any) => !p.text || mixed,
      clipboard: { writeText },
    });
    const result = await sharePrepared(new File(['x'], 'dibs.jpg', { type: 'image/jpeg' }), {
      text: 'Caption',
      url: 'https://dibs.here/c/id',
    });
    expect(result).toBe(expected);
    expect(Object.keys(share.mock.calls[0][0] as any)).toEqual(
      expected === 'file-caption' ? ['files', 'text'] : ['files'],
    );
    if (expected === 'file-caption')
      expect((share.mock.calls[0][0] as any).text).toContain('https://dibs.here/c/id');
    if (expected === 'file-caption-copied')
      expect(writeText).toHaveBeenCalledWith('Caption https://dibs.here/c/id');
  });
}

it('uses the actual smaller pool when a catalog has fewer measured answers', () => {
  expect(rarityLabel(0.94, 'countries')).toContain('249 best-known countries and territories');
});

it('counts everyone who claimed for the leaderboard and all finishers for the curve', () => {
  const rows: any = [
    { user_id: 'a', handle: 'A', points: 50, dibs: 1, events: 1, golden: true },
    { user_id: 'b', handle: 'B', points: 0, dibs: 0, events: 5, golden: false },
  ];
  const board = publicScores(rows, 'b');
  expect(board.total).toBe(1);
  expect(board.own).toBeNull();
  expect(board.rows[0].golden).toBe(true);
  expect(board.comparison.finished).toBe(1);
});
