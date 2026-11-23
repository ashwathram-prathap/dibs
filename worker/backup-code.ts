import { cookieUser, fileKey, hmac, normalizeFileKey } from './identity';
import type { Env } from './routes';
// Only return an issued code owned by this signed cookie. Never rotate or create
// an identity to satisfy a read, and never include the code in shared snapshots.
export async function backupCode(req: Request, env: Env, currentHash?: string) {
  const uid = await cookieUser(req, env.COOKIE_SECRET);
  if (!uid) return Response.json({ code: null }, { headers: { 'cache-control': 'no-store' } });
  const code = await fileKey(uid, env.COOKIE_SECRET);
  const hash = await hmac(normalizeFileKey(code), env.COOKIE_SECRET);
  let issued = currentHash === hash;
  if (!issued) {
    issued = !!(await env.DB.prepare('SELECT 1 FROM recovery_keys WHERE user_id=? AND key_hash=?')
      .bind(uid, hash)
      .first());
    if (!issued && env.R17_STORAGE === 'true')
      issued = !!(await env.DB.prepare(
        "SELECT 1 FROM r17_files WHERE user_id=? AND json_extract(data,'$.user.recoveryHash')=? UNION SELECT 1 FROM r17_players WHERE id=? AND json_extract(data,'$.recoveryHash')=?",
      )
        .bind(uid, hash, uid, hash)
        .first());
  }
  return Response.json(
    { code: issued ? code : null },
    { headers: { 'cache-control': 'no-store' } },
  );
}
