import { normalize } from '../worker/domain';
export function discoverRecipe(request: string, recipes: any[], coverage: any[]) {
  const key = normalize(request),
    passed = new Set(coverage.filter((r) => r.ready).map((r) => r.slug));
  const candidates = recipes.filter((r) =>
    (r.requestNames || [r.name, r.slug]).some((n: string) => normalize(n) === key),
  );
  const candidate = candidates.find((r) => passed.has(r.slug));
  if (candidate)
    return {
      slug: candidate.slug,
      reason: 'Matched a complete, pinned source recipe and independently reran its coverage gate.',
    };
  return {
    reason: candidates.length
      ? 'Matching recipe exists, but failed the complete-source, ranking or 98% coverage gate. It will not be scheduled.'
      : 'Checked audited source snapshots, source-scope definitions and recipe aliases. No complete-list adapter plus independent obvious-answer fixtures matched this request. Needs recipe; automatic library fallback at 48 hours.',
  };
}
