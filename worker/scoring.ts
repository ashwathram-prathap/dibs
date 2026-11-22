import type { Env } from './routes';
import { catalogMeta } from './catalog';
import { PUBLIC_ORIGIN } from '../shared/config';

// Percentile is 0 at the popular end and 1 at the rare end. The top decile is flat.
export function rarityPoints(percentile: number) {
  return Math.round((10 + 100 * Math.max(0, Math.min(1, percentile) - 0.1)) / 5) * 5;
}
export function rankPopularity(values: (number | null)[]) {
  const measured = values.filter((v): v is number => v !== null).sort((a, b) => b - a);
  const ranks = new Map<number, number>();
  for (let i = 0; i < measured.length;) {
    let end = i + 1;
    while (end < measured.length && measured[end] === measured[i]) end++;
    // Equal readings share the middle rank; a single reading has the median rank.
    ranks.set(
      measured[i],
      measured.length === 1 ? 0.5 : (i + (end - i - 1) / 2) / (measured.length - 1),
    );
    i = end;
  }
  const scores = measured.map((v) => rarityPoints(ranks.get(v)!)).sort((a, b) => a - b);
  const median = scores.length
    ? Math.round(
        (scores[Math.floor((scores.length - 1) / 2)] + scores[Math.floor(scores.length / 2)]) / 10,
      ) * 5
    : 50;
  return { median, percentiles: values.map((v) => (v === null ? null : ranks.get(v)!)) };
}
let active: { key: string; data: Promise<{ median: number; ranks: DataView }> } | undefined;
export async function scoreAnswer(
  env: Env,
  category: any,
  ordinal: number | undefined,
  answer: string,
) {
  const meta = catalogMeta(category);
  let percentile: number | null = null,
    base = 50;
  if (meta && ordinal !== undefined) {
    const key = `${meta.slug}/${meta.version}`;
    if (active?.key !== key) {
      const data = fetch(`${PUBLIC_ORIGIN}/catalog/${key}/scores-v1.bin`, {
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
  const golden = !!(await env.DB.prepare(
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
