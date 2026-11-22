import type { Env } from './routes';
// Each closed register gets an unrelated anonymous holder. No recovery credential,
// original handle, cross-day identity or IP hash follows it into the public record.
export async function withdraw(env: Env, uid: string) {
  const categories = (
    await env.DB.prepare(
      'SELECT category_id FROM claims WHERE user_id=? UNION SELECT category_id FROM strikes WHERE user_id=?',
    )
      .bind(uid, uid)
      .all<{ category_id: string }>()
  ).results;
  const replacements = new Map(categories.map((r) => [r.category_id, crypto.randomUUID()]));
  const statements: D1PreparedStatement[] = [];
  for (const [category, anonymous] of replacements) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO users(id,handle,created_at,provider_subject) VALUES(?,?,?,?)',
      ).bind(anonymous, 'withdrawn:' + anonymous, '1970-01-01T00:00:00Z', 'withdrawn:' + anonymous),
      env.DB.prepare(
        "UPDATE claims SET user_id=?,ip_hash='',ip_day='',request_id=NULL,request_answer=NULL WHERE user_id=? AND category_id=?",
      ).bind(anonymous, uid, category),
      env.DB.prepare(
        'UPDATE strikes SET user_id=?,request_id=NULL,request_answer=NULL WHERE user_id=? AND category_id=?',
      ).bind(anonymous, uid, category),
    );
  }
  for (const table of [
    'feedback',
    'recovery_keys',
    'claim_requests',
    'attempts',
    'share_events',
    'founder_role',
  ])
    statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(uid));
  statements.push(env.DB.prepare('DELETE FROM users WHERE id=?').bind(uid));
  await env.DB.batch(statements);
  return replacements;
}
