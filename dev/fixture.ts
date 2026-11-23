import { clerkReply } from '../shared/moments';
import { nextDrop } from '../worker/domain';
const r7 = new URLSearchParams(location.search);
const clockStart = performance.now();
const fixtureNow = () =>
  Date.parse(r7.has('r7-clock') ? '2026-11-24T01:59:55Z' : '2026-11-23T22:00:00Z') +
  performance.now() -
  clockStart;
const fixtureDrop = '2026-11-24T02:00:00.000Z';
const r6 = new URLSearchParams(location.search).has('r6');
const house = ['Dog', 'Cat', 'Lion', 'Tiger', 'Elephant', 'Horse', 'Wolf', 'Bear', 'Rabbit', 'Fox'];
const specials = () => ({
  houseCount: 10,
  houseWords: [],
  goldenFound: myClaims.filter((c) => c.golden).length,
  goldenTotal: 3,
  commitment: 'aa'.repeat(32),
  committedAt: new Date().toISOString(),
});
// DEVELOPMENT ONLY. Vite removes this import from every production build.
class ApiError extends Error {
  constructor(
    public status: number,
    public data: any,
  ) {
    super(data.message);
  }
}
const date = new Date().toISOString().slice(0, 10);
const category = {
  id: 'fixture-animals',
  date,
  name: 'Animals',
  slug: 'animals',
  total_registrable: 2400,
  drop_at: new Date().toISOString(),
};
const entries = [
  'Axolotl',
  'Pangolin',
  'Capybara',
  'Okapi',
  'Quokka',
  'Wombat',
  'Narwhal',
  'Aardvark',
];
let user = {
  id: 'fixture-reader',
  handle: 'Teal Otter #41',
  rerolls_used: 0,
};
let claims: any[] = [
  {
    id: 'fixture-1',
    category_id: category.id,
    claim_no: 1,
    display: 'Pangolin',
    handle: 'Rust Finch #12',
    created_at: new Date().toISOString(),
    obscurity: 4,
    category_name: 'Animals',
    category_date: date,
    total_registrable: 2400,
  },
];
const originalClaim = claims[0];
let mine: any = null;
let myClaims: any[] = [];
let events: any[] = [];
function file() {
  const strikes = events.filter((e) => e.kind === 'strike').length;
  const closed = myClaims.length === 3 || strikes === 5;
  return {
    handle: user.handle,
    streak: myClaims.length ? 1 : 0,
    summaryId: 'fixture-summary',
    category_id: category.id,
    points: Math.max(0, myClaims.reduce((n, c) => n + c.points, 0) - strikes * 10),
    rank: myClaims.length ? 1 : null,
    players: myClaims.length ? 1 : 0,
    revealed: false,
    claims: myClaims,
    dibs: myClaims.length,
    strikes,
    events,
    closed,
    completedAt: closed ? events.at(-1)?.at : null,
  };
}

export async function request(path: string, body?: any): Promise<any> {
  await new Promise((r) => setTimeout(r, 120));
  if (
    (path === '/bootstrap' || path === '/today') &&
    r7.has('r7-rollover') &&
    fixtureNow() >= Date.parse(fixtureDrop) &&
    fixtureNow() < Date.parse(fixtureDrop) + 18000
  )
    throw new ApiError(503, { message: 'The next register is still being prepared.' });
  if (path === '/bootstrap')
    return { today: await request('/today'), me: await request('/me'), rows: claims };
  if (path === '/today') {
    if (
      r7.has('r7-rollover') &&
      fixtureNow() >= Date.parse(fixtureDrop) + 18000 &&
      category.id === 'fixture-animals'
    )
      advanceFixtureDay();
    return {
      ...(r7.has('r7-clock') || r7.has('r7-closed')
        ? { serverTime: new Date(fixtureNow()).toISOString() }
        : {}),
      category: r7.has('r7-closed') ? null : { ...category },
      ...(r6 ? { practice: true, specials: specials() } : {}),
      claimed: claims.length,
      lastClaimAt: claims[0]?.created_at || null,
      open: 2400 - claims.length - (r6 ? 10 : 0),
      nextDrop:
        r7.has('r7-clock') || r7.has('r7-closed')
          ? category.id === 'fixture-animals'
            ? fixtureDrop
            : '2026-11-25T02:00:00.000Z'
          : nextDrop(),
      turnstileSiteKey: 'demo',
    };
  }
  if (path === '/me')
    return {
      user,
      claim: mine,
      file: file(),
      streak: mine ? 1 : 0,
      streakDates: mine ? [date] : [],
    };
  if (path === '/me/reroll') {
    if (user.rerolls_used >= 3 || mine)
      throw new ApiError(403, { message: 'This handle is filed.' });
    user = {
      ...user,
      handle: ['Ochre Badger #25', 'Silver Moth #63', 'Amber Fox #19'][user.rerolls_used],
      rerolls_used: user.rerolls_used + 1,
    };
    return { user };
  }
  if (path.startsWith('/answers'))
    return {
      answers: entries.filter((e) =>
        e.toLowerCase().includes(decodeURIComponent(path.split('q=')[1] || '').toLowerCase()),
      ),
    };
  if (path.startsWith('/leaderboard')) return { rows: [], own: null, total: 0 };
  if (path.startsWith('/ledger')) {
    const u = new URL(path, 'http://fixture');
    return {
      rows: claims.filter(
        (r) =>
          r.category_id === u.searchParams.get('category') &&
          r.claim_no > Number(u.searchParams.get('since') || 0),
      ),
    };
  }
  if (path === '/archive')
    return {
      categories: r6
        ? [
            {
              ...category,
              specials: {
                ...specials(),
                houseWords: house.map((display) => ({ display, handle: 'RESERVED' })),
                verified: true,
                reveal: {
                  seed: 'visual-fixture',
                  answers: [
                    { id: 'a', display: 'Axolotl' },
                    { id: 'b', display: 'Okapi' },
                    { id: 'c', display: 'Quokka' },
                  ],
                  payload: 'Development-only commitment proof',
                  algorithm: 'SHA-256',
                },
              },
            },
          ]
        : [],
    };
  if (path.startsWith('/certificate/')) {
    const claim = claims.find((c) => c.id === path.split('/').pop()) || mine;
    const mode = new URLSearchParams(location.search).get('r17');
    return { claim: mode ? {...claim, category_slug:'animals', percentile: mode==='sealed'?null:Number(new URLSearchParams(location.search).get('p') || '.94'), points:95, revealed:mode==='closed', owned:mode==='holder', concealed:mode==='sealed', display:mode==='sealed'?'Revealed when the day closes':claim.display} : claim };
  }
  if (path === '/missing')
    return { ok: true, message: 'Submitted to the clerk. No strike charged.' };
  if (path === '/delete-file') return {ok:true,message:'Your file is removed. Past claims now belong to Withdrawn filer.'};
  if (path === '/backup-code') return {code:'DIBS-ABCDE-12345-FABCD-67890'};
  if (path === '/feedback') {
    if (r7.has('feedback-error')) throw new ApiError(503, {message:'Your feedback could not be sent. Try again.'});
    return {message:'Your feedback was sent. Thank you.'};
  }
  if (path === '/recover') return { ok: true };
  if (path === '/claim') {
    const note = clerkReply(body.answer, category.name);
    if(note) throw new ApiError(422,{code:'CLERK_NOTE',message:note});
    if (r7.has('r8') && body.answer === 'offline proof')
      throw new Error('The clerk didn’t get that. Try again.');
    if (file().closed) throw new ApiError(403, { message: 'Your file is closed for today.' });
    if (r6 && body.answer.toLowerCase() === 'dog') {
      events.push({ at: new Date().toISOString(), kind: 'strike', display: 'DOG', house: true });
      throw new ApiError(409, {
        house: true,
        takenBy: 'RESERVED',
        message: 'DOG is reserved: the 10 most obvious answers are off-limits.',
        file: file(),
        me: await request('/me'),
      });
    }
    const entry = entries.find((e) => e.toLowerCase() === body.answer.trim().toLowerCase());
    if (!entry)
      throw new ApiError(422, {
        message: "Not on today's register. Check the spelling.",
        code: 'NOT_REGISTERED',
        spellingCatalog: new URLSearchParams(location.search).get('spellingVersion')
          ? {
              slug: 'animals',
              version: new URLSearchParams(location.search).get('spellingVersion'),
            }
          : null,
        suggestion: body.answer.toLowerCase() === 'axolot' ? 'Axolotl' : null,
      });
    const taken = claims.find((c) => c.display === entry);
    if (taken) {
      events.push({
        at: new Date().toISOString(),
        kind: 'strike',
        display: entry,
        holder: taken.handle,
        heldAt: taken.created_at,
      });
      throw new ApiError(409, {
        file: file(),
        me: await request('/me'),
        takenBy: taken.handle,
        at: taken.created_at,
        message:
          entry +
          ' is already registered to ' +
          taken.handle +
          '. Please call dibs on something else.',
      });
    }
    mine = {
      ...originalClaim,
      category_id: category.id,
      category_name: category.name,
      category_date: category.date,
      points: entry === 'Axolotl' ? 160 : 60,
      percentile: .6,
      bonus: entry === 'Axolotl' ? 100 : 0,
      id: 'fixture-' + (claims.length + 1),
      claim_no: claims.length + 1,
      display: entry,
      handle: user.handle,
      created_at: new Date().toISOString(),
      obscurity: 4,
      golden: r6 && entry === 'Axolotl',
    };
    claims = [mine, ...claims];
    myClaims.push(mine);
    events.push({
      at: mine.created_at,
      kind: 'dibs',
      golden: !!mine.golden,
      display: mine.display,
      claimId: mine.id,
      obscurity: mine.obscurity,
    });
    return {
      claim: mine,
      me: await request('/me'),
      ...(r7.has('r8') && myClaims.length === 1
        ? { recoveryKey: 'DIBS-01234-56789-ABCDE-F0123' }
        : {}),
    };
  }
  if (path.startsWith('/summary/'))
    return {
      ...(r6 ? { specials: specials() } : {}),
      file: { ...file(), summaryId: 'fixture-summary' },
      category,
      nextDrop: nextDrop(),
    };
  if (path === '/events/arrival' || path === '/events/share') {
    window.dispatchEvent(new CustomEvent('dibs-fixture-event', { detail: { path, body } }));
    return { ok: true };
  }
  throw new ApiError(404, { message: 'No file at this address.' });
}

// Browser regression support; this module is excluded from every production build.
export function advanceFixtureDay() {
  category.id = 'fixture-universities';
  category.name = 'Universities';
  category.slug = 'universities';
  category.date = new Date(Date.parse(category.date + 'T12:00:00Z') + 86400000)
    .toISOString()
    .slice(0, 10);
  category.drop_at = new Date().toISOString();
  mine = null;
  myClaims = [];
  events = [];
  claims = [];
}
