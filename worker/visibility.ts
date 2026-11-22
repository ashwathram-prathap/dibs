import { categoryStyle } from '../shared/category-style';
import { cookieUser } from './identity';
import { closeAt } from './specials';
import type { Env } from './routes';
export const concealed = 'Revealed when your file closes';
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
  };
}
export async function canReveal(req: Request, env: Env, category: any) {
  if (!category) return false;
  if (env.STAGING !== 'true' && Date.parse(closeAt(category)) <= Date.now()) return true;
  const uid = await cookieUser(req, env.COOKIE_SECRET);
  if (!uid) return false;
  const row = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM claims WHERE category_id=? AND user_id=?) dibs,(SELECT COUNT(*) FROM strikes WHERE category_id=? AND user_id=?) strikes',
  )
    .bind(category.id, uid, category.id, uid)
    .first<any>();
  return row.dibs >= 3 || row.strikes >= 5;
}
export const concealClaim = (c: any) => ({
  ...c,
  display: concealed,
  obscurity: null,
  golden: false,
  concealed: true,
});
export function concealSummary(data: any) {
  return {
    ...data,
    concealed: true,
    category: publicCategory(data.category),
    specials: data.specials ? { ...data.specials, houseWords: [], reveal: undefined } : undefined,
    file: {
      ...data.file,
      claims: data.file.claims.map(concealClaim),
      events: data.file.events.map((e: any) => ({ at: e.at, kind: e.kind, display: concealed })),
    },
  };
}
