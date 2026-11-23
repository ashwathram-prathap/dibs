import type { Env } from './routes';
import { catalogMeta } from './catalog';
import { PUBLIC_ORIGIN } from '../shared/config';
import { scoreAssetPath } from '../shared/scoring-assets';

import { rarityPoints } from '../shared/score-points';
export { rarityPoints } from '../shared/score-points';
export function rankPopularity(values: (number | null)[], poolLimit = 3000) {
  if (!Number.isSafeInteger(poolLimit) || poolLimit < 1)
    throw Error('Invalid popularity pool size');
  const measured = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => b - a);
  const pool = measured.slice(0, Math.min(values.length, poolLimit));
  const ranks = new Map<number, number>();
  for (let i = 0; i < pool.length;) {
    let end = i + 1;
    while (end < pool.length && pool[end] === pool[i]) end++;
    // Ties share their middle rank. A tie crossing the pool boundary is rarest
    // for every member, so equal pageviews never receive different scores.
    const crossesBoundary = end === pool.length && measured[end] === pool[i];
    ranks.set(
      pool[i],
      crossesBoundary ? 1 : pool.length === 1 ? 0.5 : (i + (end - i - 1) / 2) / (pool.length - 1),
    );
    i = end;
  }
  // Unknown readings use this category's reference-pool median. They never
  // become measured/rarest merely because the long catalog tail is obscure.
  const scores = pool.map((v) => rarityPoints(ranks.get(v)!)).sort((a, b) => a - b);
  const median = scores.length
    ? Math.round(
        (scores[Math.floor((scores.length - 1) / 2)] + scores[Math.floor(scores.length / 2)]) / 10,
      ) * 5
    : 50;
  return {
    median,
    percentiles: values.map((v) =>
      v === null || !Number.isFinite(v) ? null : (ranks.get(v) ?? 1),
    ),
  };
}
let active: { key: string; data: Promise<{ median: number; ranks: DataView }> } | undefined;
export async function scoreAnswer(
  env: Env,
  category: any,
  ordinal: number | undefined,
  answer: string,
  knownGolden?: boolean,
) {
  const meta = catalogMeta(category);
  let percentile: number | null = null,
    base = 50;
  if (meta && ordinal !== undefined) {
    const key = scoreAssetPath(meta.slug, meta.version);
    if (active?.key !== key) {
      const data = fetch(`${PUBLIC_ORIGIN}${key}`, {
        cf: { cacheTtl: 86400, cacheEverything: true },
      })
        .then(async (r) => {
          if (!r.ok) throw Error('Scoring data unavailable');
          const ranks = new DataView(await r.arrayBuffer());
          if (ranks.byteLength !== (meta.count + 1) * 2) throw Error('Scoring catalog mismatch');
          return { median: ranks.getUint16(0, true), ranks };
        })
        .catch((e) => {
          if (active?.key === key) active = undefined;
          throw e;
        });
      active = { key, data };
    }
    const data = await active.data;
    const rank = data.ranks.getUint16((ordinal + 1) * 2, true);
    percentile = rank === 65535 ? null : rank / 10000;
    base = percentile === null ? data.median : rarityPoints(percentile);
  }
  // Legacy registers have no retained pageviews: their honest median fallback is 50.
  const golden =
    knownGolden ??
    !!(await env.DB.prepare(
      'SELECT 1 FROM daily_specials,json_each(golden_json) WHERE category_id=? AND value=?',
    )
      .bind(category.id, answer)
      .first());
  return { points: base + (golden ? 100 : 0), percentile, bonus: golden ? 100 : 0 };
}
export function scoreFile(events: { kind: string; points?: number; at: string }[]) {
  let raw = 0;
  const reached = new Map<number, string>();
  for (const event of events) {
    raw += event.kind === 'dibs' ? event.points || 0 : -10;
    const total = Math.max(0, raw);
    if (!reached.has(total)) reached.set(total, event.at);
  }
  const points = Math.max(0, raw);
  return { points, reachedAt: reached.get(points) || '' };
}
