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
  };
}
export function dayClosed(category: any) {
  return !!category && Date.parse(closeAt(category)) <= Date.now();
}
export async function canReveal(_req: Request, _env: Env, category: any) {
  return dayClosed(category);
}
export const concealClaim = (c: any) => ({
  ...c,
  display: concealed,
  obscurity: null,
  percentile: null,
  points: null,
  bonus: 0,
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
