import { categoryPlural } from './category-copy';
export const POOL_VERSION = 'r21-pool-v1';
export const FLOW_RULES = {
  common: 0.4,
  uncommon: 0.75,
  rare: 0.95,
  goldenFraction: 0.03,
  goldenMin: 50,
  goldenMax: 100,
  goldenBonus: 50,
  titleMinimumFinished: 20,
  landlord: 0.5,
  baron: 0.1,
  dibillionaire: 0.01,
} as const;
export type Tier =
  'Common' | 'Uncommon' | 'Rare' | 'Deep cut' | 'Off the register' | 'Standard score';
export type PoolEvidence = {
  version: string;
  catalogVersion: string;
  scoringVersion: string;
  membership: 'in' | 'out' | 'unknown';
  poolSize: number;
};
export function rarityTier(
  percentile: number | null | undefined,
  evidence?: PoolEvidence,
): Tier | undefined {
  if (!evidence || evidence.version !== POOL_VERSION) return;
  if (
    percentile == null ||
    !Number.isFinite(percentile) ||
    percentile < 0 ||
    percentile > 1 ||
    evidence.membership === 'unknown'
  )
    return 'Standard score';
  if (evidence.membership === 'out') return 'Off the register';
  return percentile < FLOW_RULES.common
    ? 'Common'
    : percentile < FLOW_RULES.uncommon
      ? 'Uncommon'
      : percentile < FLOW_RULES.rare
        ? 'Rare'
        : 'Deep cut';
}
export function tierRank(tier?: Tier) {
  return ['Common', 'Uncommon', 'Rare', 'Deep cut', 'Off the register'].indexOf(tier || '');
}
export function tierCopy(c: {
  percentile?: number | null;
  pool?: PoolEvidence;
  category_slug?: string;
  category_name?: string;
}) {
  const tier = rarityTier(c.percentile, c.pool);
  if (tier === 'Off the register')
    return `Outside the ${c.pool!.poolSize.toLocaleString('en-US')} best-known ${categoryPlural({ slug: c.category_slug || '', name: c.category_name || '' })}`;
  return tier;
}
export function goldenCount(eligible: number) {
  if (!Number.isSafeInteger(eligible) || eligible < 0) throw Error('Invalid eligible pool');
  return Math.min(
    eligible,
    Math.max(
      FLOW_RULES.goldenMin,
      Math.min(FLOW_RULES.goldenMax, Math.round(eligible * FLOW_RULES.goldenFraction)),
    ),
  );
}
export function poolMembership(values: (number | null)[], limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw Error('Invalid pool limit');
  const measured = values
    .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0)
    .sort((a, b) => b - a);
  const boundary = measured[Math.min(limit, measured.length) - 1];
  const membership = values.map((v) =>
    v === null || !Number.isFinite(v) || v < 0 ? 0 : v >= boundary ? 1 : 2,
  );
  return {
    membership,
    poolSize: membership.filter((x) => x === 1).length,
    boundary: boundary ?? null,
  };
}
export type FileTitle = {
  name: 'Claimant' | 'Owner' | 'Landlord' | 'Baron' | 'Dibillionaire';
  reason: string;
  provisional: boolean;
};
export function fileTitle(
  f: { dibs: number; closed?: boolean; golden?: boolean },
  board?: { final: boolean; tieRank: number; total: number; finished: number },
): FileTitle | null {
  if (!f.closed || f.dibs < 1) return null;
  let name: FileTitle['name'] = f.dibs >= 3 ? 'Owner' : 'Claimant',
    reason = f.dibs >= 3 ? 'Three claims tonight' : 'A claim tonight';
  if (
    board?.final &&
    board.finished >= FLOW_RULES.titleMinimumFinished &&
    board.total > 0 &&
    board.tieRank >= 1
  ) {
    const top = board.tieRank / board.total;
    if (top <= FLOW_RULES.dibillionaire || (f.golden && top <= FLOW_RULES.baron)) {
      name = 'Dibillionaire';
      reason = top <= FLOW_RULES.dibillionaire ? 'Top 1% tonight' : 'Golden ticket and top 10%';
    } else if (top <= FLOW_RULES.baron) {
      name = 'Baron';
      reason = 'Top 10% tonight';
    } else if (top <= FLOW_RULES.landlord) {
      name = 'Landlord';
      reason = 'Top 50% tonight';
    }
  }
  return { name, reason, provisional: !board?.final };
}
export function momentum(
  claims: { percentile?: number | null; pool?: PoolEvidence }[],
  strikes: number,
  closed: boolean,
) {
  const ranks = claims.map((c) => tierRank(rarityTier(c.percentile, c.pool)));
  return [
    ranks.length === 2 && ranks[0] >= 0 && ranks[1] > ranks[0] ? 'Rarer than your last.' : null,
    ranks.length === 3 && ranks.every((n) => n >= 2) ? 'Clean sheet: three rare claims.' : null,
    closed && claims.length === 3 && strikes === 0 ? 'No strikes tonight.' : null,
  ].filter(Boolean) as string[];
}
export function takenAge(at: string | undefined, now: number) {
  const ms = at ? Math.max(0, now - Date.parse(at)) : NaN;
  if (!Number.isFinite(ms)) return '';
  const seconds = Math.floor(ms / 1000);
  return seconds < 60
    ? `${seconds}s`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m`
      : `${Math.floor(seconds / 3600)}h`;
}

/** Use the same pinned evidence on the small DIBS stamp as on the main tier. */
export function claimStampLabel(c: {
  golden?: boolean | number;
  concealed?: boolean;
  percentile?: number | null;
  obscurity?: number | null;
  pool?: PoolEvidence;
}) {
  if (c.golden) return 'Golden ticket';
  if (c.concealed) return 'Registered';
  return (
    rarityTier(c.percentile, c.pool) ||
    (c.percentile != null && c.obscurity && c.obscurity >= 4 ? 'Deep cut' : 'Registered')
  );
}
