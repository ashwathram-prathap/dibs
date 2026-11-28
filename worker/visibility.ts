import { categoryStyle } from '../shared/category-style';
import { closeAt } from './specials';
import type { Env } from './routes';
export const concealed = 'Revealed when the day closes';
export function publicCategory(g: any) {
  if (!g) return null;
  const { id, date, name, slug, total_registrable, drop_at, status } = g;
  return {
    id,
    date,
    name,
    slug,
    total_registrable,
    drop_at,
    status,
    paper: categoryStyle(slug || id),
    ...(slug === 'animals' &&
    JSON.parse(g.source_json || '{}').staticCatalog?.version === '10210a86838c8eca'
      ? {
          scopeNote:
            'Animal species, general groups and a limited set of breeds count. Many breeds are not listed.',
        }
      : {}),
  };
}
export function dayClosed(category: any) {
  return !!category && Date.parse(closeAt(category)) <= Date.now();
}
export async function canReveal(_req: Request, _env: Env, category: any) {
  return dayClosed(category);
}
// Public boundaries enumerate fields. New journal fields are private by default.
export function visibleClaim(c: any, revealed = false, owned = false, shared = false): any {
  const out: any = {
    id: c.id,
    category_id: c.category_id,
    claim_no: c.claim_no,
    handle: c.handle,
    created_at: c.created_at,
    category_name: c.category_name,
    category_date: c.category_date,
    category_slug: c.category_slug,
    total_registrable: c.total_registrable,
    founder: c.founder,
    streak: c.streak,
    points: c.points,
    concealed: !revealed && !owned && !shared,
    revealed,
    owned,
  };
  if (shared) out.sharedAnswers = true;
  if (revealed || owned || shared) {
    out.display = c.display;
    out.obscurity = c.obscurity;
    out.percentile = c.percentile;
    out.points = c.points;
    out.bonus = c.bonus;
    out.golden = c.golden;
    if (c.pool) out.pool = c.pool;
    if (owned && c.offRegisterOrdinal) out.offRegisterOrdinal = c.offRegisterOrdinal;
  }
  return out;
}
export const concealClaim = (c: any) => visibleClaim(c);
export function publicSpecials(s: any, revealed = false): any {
  if (!s) return s;
  const out: any = {
    houseCount: s.houseCount,
    houseWords: [],
    goldenFound: s.goldenFound,
    goldenTotal: s.goldenTotal,
    ...(s.goldenBonus !== undefined ? { goldenBonus: s.goldenBonus } : {}),
    ...(s.policy ? { policy: s.policy } : {}),
    commitment: s.commitment,
    committedAt: s.committedAt,
    clue: s.clue ? { text: s.clue.text, crackedBy: s.clue.crackedBy } : null,
  };
  if (revealed) {
    out.houseWords = (s.houseWords || []).map((r: any) => ({
      display: r.display,
      handle: r.handle,
    }));
    out.verified = s.verified;
    if (s.reveal)
      out.reveal = {
        seed: s.reveal.seed,
        algorithm: s.reveal.algorithm,
        payload: s.reveal.payload,
        answers: s.reveal.answers.map((a: any) => ({
          id: a.id,
          display: a.display,
          clued: a.clued,
        })),
      };
  }
  return out;
}
export function publicFile(f: any, revealed = false, owned = false): any {
  return {
    category_id: f.category_id,
    summaryId: f.summaryId,
    dibs: f.dibs,
    strikes: f.strikes,
    closed: f.closed,
    completedAt: f.completedAt,
    points: f.points,
    rank: f.rank,
    players: f.players,
    streak: f.streak,
    handle: f.handle,
    founder: f.founder,
    revealed,
    title: f.title,
    comparison: f.comparison
      ? {
          finished: f.comparison.finished,
          rank: f.comparison.rank,
          points: f.comparison.points,
          percentile: f.comparison.percentile,
        }
      : undefined,
    claims: (f.claims || [])
      .filter((c: any) => !c.voided)
      .map((c: any) => visibleClaim(c, revealed, owned)),
    events: (f.events || []).map((e: any) =>
      revealed || owned
        ? {
            at: e.at,
            kind: e.kind,
            display: e.display,
            claimId: e.claimId,
            obscurity: e.obscurity,
            holder: e.holder,
            holderFounder: e.holderFounder,
            heldAt: e.heldAt,
            house: e.house,
            golden: e.golden,
          }
        : { at: e.at, kind: e.kind },
    ),
  };
}
export function publicSummary(data: any, revealed = false, shared = false) {
  const file = publicFile(data.file, revealed);
  if (shared) {
    file.sharedAnswers = true;
    file.claims = (data.file.claims || [])
      .filter((c: any) => !c.voided)
      .map((c: any) => visibleClaim(c, revealed, false, true));
    // A share grants access only to this owner's successful claims, never struck guesses.
    file.events = (data.file.events || []).map((e: any) =>
      e.kind === 'dibs'
        ? {
            at: e.at,
            kind: e.kind,
            claimId: e.claimId,
            display: e.display,
            golden: e.golden,
            obscurity: e.obscurity,
          }
        : { at: e.at, kind: e.kind },
    );
  }
  file.events = file.events.map((e: any) => (e.kind === 'strike' ? { at: e.at, kind: e.kind } : e));
  return {
    concealed: !revealed && !shared,
    category: publicCategory(data.category),
    specials: publicSpecials(data.specials, revealed),
    nextDrop: data.nextDrop,
    file,
  };
}
export const concealSummary = (data: any) => publicSummary(data);
