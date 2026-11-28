import { loadPool } from './pool';
import { catalogMeta } from './catalog';
import { FLOW_RULES, goldenCount, POOL_VERSION } from '../shared/flow-rules';
export const GOLDEN_RULES_VERSION = 'r21-3pct-v1';
export const wantsNewRules = (category: any) =>
  JSON.parse(category.source_json || '{}').goldenPolicy === GOLDEN_RULES_VERSION;
const hash = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
export async function prepareDayRules(category: any) {
  if (Date.parse(category.drop_at) <= Date.now())
    throw Error('New rules require a pre-opening commitment');
  const meta = catalogMeta(category),
    pool = await loadPool(category);
  if (!meta || !pool) throw Error('Pinned pool required');
  const reserved = new Set(meta.house.map((r: any) => r[0]));
  const eligible = pool.membership.flatMap((n, i) => (n === 1 && !reserved.has(i) ? [i] : []));
  // Small pools require an explicit policy review before scheduling; never inflate a draw.
  if (eligible.length < 50) throw Error('Small golden pool needs review before scheduling');
  const poolJson = JSON.stringify(eligible),
    eligibleDigest = await hash(poolJson);
  const policy = {
    version: GOLDEN_RULES_VERSION,
    poolVersion: POOL_VERSION,
    catalogVersion: meta.version,
    scoringVersion: pool.scoringVersion,
    eligibleCount: eligible.length,
    referencePoolSize: pool.poolSize,
    eligibleDigest,
    count: goldenCount(eligible.length),
    bonus: FLOW_RULES.goldenBonus,
    clues: true,
  };
  const json = JSON.stringify(policy);
  return { policy, json, digest: await hash(json), poolJson, eligible };
}
export function savedPolicy(saved: any) {
  if (!saved?.policy_json) return null;
  const p = JSON.parse(saved.policy_json);
  if (
    p.version !== GOLDEN_RULES_VERSION ||
    p.bonus !== 50 ||
    p.count !== goldenCount(p.eligibleCount) ||
    p.eligibleCount < 50
  )
    throw Error('Unknown or invalid committed rules');
  return p;
}
