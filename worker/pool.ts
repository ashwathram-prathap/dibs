import { catalogMeta } from './catalog';
import { PUBLIC_ORIGIN } from '../shared/config';
import { POOL_VERSION, type PoolEvidence } from '../shared/flow-rules';
import { SCORING_VERSION } from '../shared/scoring-assets';
export type Pool = {
  version: string;
  catalogVersion: string;
  scoringVersion: string;
  count: number;
  poolSize: number;
  membership: number[];
  sourceDigest: string;
};
let active: { key: string; data: Promise<Pool> } | undefined;
export function loadPool(category: any): Promise<Pool> | undefined {
  const meta = catalogMeta(category);
  if (!meta) return;
  const key = `/catalog/${meta.slug}/${meta.version}/${POOL_VERSION}.json`;
  if (active?.key === key) return active.data;
  const data = fetch(PUBLIC_ORIGIN + key, { cf: { cacheTtl: 86400, cacheEverything: true } })
    .then(async (r) => {
      if (!r.ok) throw Error('Reference pool unavailable');
      const p: any = await r.json();
      if (
        p.version !== POOL_VERSION ||
        p.catalogVersion !== meta.version ||
        p.scoringVersion !== SCORING_VERSION ||
        p.count !== meta.count ||
        p.membership?.length !== meta.count ||
        p.membership.some((n: any) => ![0, 1, 2].includes(n)) ||
        p.poolSize !== p.membership.filter((n: number) => n === 1).length
      )
        throw Error('Reference pool mismatch');
      return p as Pool;
    })
    .catch((e) => {
      if (active?.key === key) active = undefined;
      throw e;
    });
  active = { key, data };
  return data;
}
export function evidence(pool: Pool | undefined, ordinal: number): PoolEvidence | undefined {
  if (!pool) return;
  return {
    version: pool.version,
    catalogVersion: pool.catalogVersion,
    scoringVersion: pool.scoringVersion,
    poolSize: pool.poolSize,
    membership:
      pool.membership[ordinal] === 1 ? 'in' : pool.membership[ordinal] === 2 ? 'out' : 'unknown',
  };
}
