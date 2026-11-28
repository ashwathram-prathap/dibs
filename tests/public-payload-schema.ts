import { expect } from 'vitest';
type Shape = true | { [key: string]: Shape } | Shape[];
const fields = (names: string): Record<string, Shape> =>
  Object.fromEntries(names.split(' ').map((k) => [k, true]));
const comparison = fields('finished percentile rank points'); // Aggregate score percentile, never answer rarity.
const category = {
  ...fields('id date name slug total_registrable drop_at status scopeNote'),
  paper: fields('stock light dark plate'),
};
const specials = {
  ...fields('houseCount goldenFound goldenTotal goldenBonus commitment committedAt verified'),
  policy: fields(
    'version poolVersion catalogVersion scoringVersion eligibleCount referencePoolSize eligibleDigest count bonus clues digest',
  ),
  houseWords: [],
  clue: fields('text crackedBy'),
};
export const claimShape = {
  ...fields(
    'id category_id claim_no handle created_at category_name category_date category_slug total_registrable founder streak concealed revealed owned points',
  ),
};
const event = fields('at kind');
const file = {
  ...fields(
    'category_id summaryId dibs strikes closed completedAt points rank players streak handle founder revealed',
  ),
  claims: [claimShape],
  events: [event],
  comparison,
  title: fields('name reason provisional'),
};
const sharedClaim = {
  ...claimShape,
  ...fields('sharedAnswers display obscurity percentile bonus golden'),
  pool: fields('version catalogVersion scoringVersion membership poolSize'),
};
const sharedFile = {
  ...file,
  sharedAnswers: true as const,
  claims: [sharedClaim],
  events: [{ ...event, ...fields('claimId display golden obscurity') }],
};
const standing = fields('rank handle founder points claims own golden');
const board = { rows: [standing], own: standing, total: true, comparison, final: true };
const today = {
  ...fields(
    'serverTime revealed closesAt practice claimed offRegisterPlayers open voided lastClaimAt nextDrop turnstileSiteKey',
  ),
  category,
  specials,
  board: [],
};
export const shapes: Record<string, Shape> = {
  sharedSummary: {
    owned: true,
    concealed: true,
    category,
    specials,
    nextDrop: true,
    file: sharedFile,
  },
  sharedCertificate: { claim: sharedClaim, score: file },
  summary: { owned: true, concealed: true, category, specials, nextDrop: true, file },
  certificate: { claim: claimShape, score: file },
  ledger: { rows: [], locked: true },
  leaderboard: board,
  bootstrap: {
    today,
    me: {
      firstVisit: true,
      user: fields('id handle rerolls_used'),
      claim: claimShape,
      file,
      streakDates: [true],
      streak: true,
    },
    leaderboard: board,
    rows: [],
    version: true,
    reset: true,
  },
  today,
};
export function assertPublicPayload(value: any, shape: Shape, path = 'payload') {
  if (value == null) return;
  if (shape === true) {
    expect(typeof value === 'object', path + ' must be scalar').toBe(false);
    return;
  }
  if (Array.isArray(shape)) {
    expect(Array.isArray(value), path).toBe(true);
    if (!shape.length) expect(value, path + ' must be empty before close').toEqual([]);
    else
      value.forEach((v: any, i: number) => assertPublicPayload(v, shape[0], path + '[' + i + ']'));
    return;
  }
  expect(typeof value, path).toBe('object');
  for (const key of Object.keys(value)) {
    expect(['answer_id', 'user_id'].includes(key), path + '.' + key).toBe(false);
    expect(Object.hasOwn(shape, key), 'Unlisted ' + path + '.' + key).toBe(true);
    assertPublicPayload(value[key], shape[key], path + '.' + key);
  }
}

export function assertOwnerSharedPayload(data: any, kind: 'summary' | 'certificate') {
  if (kind === 'certificate') {
    expect(data.claim.sharedAnswers).toBe(true);
    assertPublicPayload(data, shapes.sharedCertificate);
    return;
  }
  expect(data.file.sharedAnswers).toBe(true);
  assertPublicPayload(data, shapes.sharedSummary);
  for (const claim of data.file.claims) expect(claim.sharedAnswers).toBe(true);
  for (const event of data.file.events) {
    if (event.kind === 'strike') expect(Object.keys(event).sort()).toEqual(['at', 'kind']);
    else {
      const claim = data.file.claims.find((c: any) => c.id === event.claimId);
      expect(claim).toBeDefined();
      expect(event.display).toBe(claim.display);
    }
  }
}
