import { rarityTier, fileTitle, type FileTitle } from '../shared/flow-rules';
import type { JournalFile } from './event-journal';
export function flowFunnel(
  files: Iterable<JournalFile>,
  titleFor?: (id: string) => FileTitle | null,
) {
  const tiers: Record<string, number> = {},
    titles: Record<string, number> = {};
  let successfulClaims = 0,
    unknownTierClaims = 0,
    participants = 0;
  const golden = new Set<string>();
  for (const s of files) {
    if (
      s.user.hidden ||
      s.user.test ||
      s.file.eligible === false ||
      ['Withdrawn player', 'Record withheld'].includes(s.user.handle)
    )
      continue;
    const claims = s.file.claims.filter((c: any) => !c.voided);
    if (claims.length || s.file.strikes) participants++;
    for (const c of claims) {
      successfulClaims++;
      const tier = rarityTier(c.percentile, c.pool);
      if (tier) tiers[tier] = (tiers[tier] || 0) + 1;
      else unknownTierClaims++;
      if (c.golden) golden.add(c.id);
    }
    const title = titleFor
      ? titleFor(s.user.id)
      : fileTitle({
          dibs: claims.length,
          closed: s.file.closed,
          golden: claims.some((c: any) => c.golden),
        });
    if (title) titles[title.name] = (titles[title.name] || 0) + 1;
  }
  return {
    tiers,
    titles,
    successfulClaims,
    unknownTierClaims,
    uniqueGoldenHits: golden.size,
    averageClaimsPerParticipant: participants ? successfulClaims / participants : null,
  };
}
