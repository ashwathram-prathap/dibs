import type { Env } from './routes';
import { constantEqual } from './identity';
import { validId, validText } from '../shared/security';
import { catalogMeta, lookup } from './catalog';
import { scoreAnswer } from './scoring';
import { SCORING_VERSION, scoreAssetPath } from '../shared/scoring-assets';

// Authenticated, read-only release diagnostic. No claims, identities, specials,
// or leaderboards are created or changed; bonus selection is never inspected.
export async function scoringCheck(req: Request, env: Env) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
  if (
    !env.ADMIN_TOKEN ||
    !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
  )
    return json({ error: 'Not found' }, 404);
  if (req.method !== 'GET') return json({ error: 'Read only' }, 405);
  const url = new URL(req.url),
    id = url.searchParams.get('id'),
    answers = url.searchParams.getAll('answer');
  if (!validId(id) || !answers.length || answers.length > 20 || answers.some((a) => !validText(a)))
    return json({ error: 'Supply a category and one to twenty answers' }, 422);
  const category = await env.DB.prepare('SELECT * FROM categories WHERE id=?')
    .bind(id)
    .first<any>();
  const meta = category && catalogMeta(category);
  if (!meta) return json({ error: 'Catalog unavailable' }, 404);
  const rows = [];
  for (const answer of answers) {
    const row = await lookup(category, answer);
    const score = row ? await scoreAnswer(env, category, row[0], '', false) : null;
    rows.push({
      answer,
      found: !!row,
      display: row?.[1],
      basePoints: score?.points,
      percentile: score?.percentile,
    });
  }
  return json({
    scoringVersion: SCORING_VERSION,
    asset: scoreAssetPath(meta.slug, meta.version),
    rows,
  });
}
