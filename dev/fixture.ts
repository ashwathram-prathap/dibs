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
export async function request(path: string, body?: any): Promise<any> {
  await new Promise((r) => setTimeout(r, 120));
  if (path === '/bootstrap') return {today: await request('/today'), me:await request('/me'), rows:claims};
  if (path === '/today')
    return {
      category: {...category},
      claimed: claims.length,
      lastClaimAt: claims[0]?.created_at || null,
      open: 2400 - claims.length,
      nextDrop: new Date(Date.now() + 3600000 * 12).toISOString(),
      turnstileSiteKey: 'demo',
    };
  if (path === '/me')
    return { user, claim: mine, streak: mine ? 1 : 0, streakDates: mine ? [date] : [] };
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
  if (path.startsWith('/ledger')) { const u = new URL(path, 'http://fixture'); return {rows:claims.filter(r=>r.category_id===u.searchParams.get('category') && r.claim_no>Number(u.searchParams.get('since')||0))}; }
  if (path === '/archive') return { categories: [] };
  if (path.startsWith('/certificate/'))
    return { claim: claims.find((c) => c.id === path.split('/').pop()) || mine };
  if (path === '/claim') {
    if (mine) throw new ApiError(403, { message: 'One claim per day. Yours is already on file.' });
    const entry = entries.find((e) => e.toLowerCase() === body.answer.trim().toLowerCase());
    if (!entry)
      throw new ApiError(422, {
        message: 'That entry is not in this register. Please try another.',
      });
    const taken = claims.find((c) => c.display === entry);
    if (taken)
      throw new ApiError(409, {
        takenBy: taken.handle,
        at: taken.created_at,
        message:
          entry +
          ' is already registered to ' +
          taken.handle +
          '. Please call dibs on something else.',
      });
    mine = {
      ...originalClaim,
      category_id: category.id,
      category_name: category.name,
      category_date: category.date,
      id: 'fixture-2',
      claim_no: 2,
      display: entry,
      handle: user.handle,
      created_at: new Date().toISOString(),
      obscurity: 4,
    };
    claims = [mine, ...claims];
    return { claim: mine, me:await request('/me') };
  }
  if (path === '/events/share') return { ok: true };
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
  claims = [];
}
