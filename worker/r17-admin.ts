import { type Env, body } from './routes';
import { PUBLIC_ORIGIN } from '../shared/config';
import { hmac, normalizeFileKey, constantEqual } from './identity';
import { registryDate } from './domain';
export async function prepareR17Admin(req: Request, env: Env) {
  if (
    !env.DAY_REGISTRY ||
    !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
  )
    return;
  if (new URL(req.url).pathname !== '/api/admin/set-founder') return;
  const b = await body(req.clone() as Request),
    target = String(b.target || '');
  await env.DAY_REGISTRY.get(
    env.DAY_REGISTRY.idFromName(env.STAGING === 'true' ? 'practice' : registryDate()),
  ).fetch(
    new Request(PUBLIC_ORIGIN + '/api/admin/r17-flush', {
      method: 'POST',
      headers: {
        origin: PUBLIC_ORIGIN,
        authorization: 'Bearer ' + env.ADMIN_TOKEN,
        'x-r17-day': registryDate(),
      },
    }),
  );
  const row = await env.DB.prepare(
    "SELECT id,data FROM r17_players WHERE id=? OR json_extract(data,'$.recoveryHash')=? UNION SELECT user_id id,json_extract(data,'$.user') data FROM r17_files WHERE user_id=? OR json_extract(data,'$.user.recoveryHash')=?",
  )
    .bind(
      target,
      await hmac(normalizeFileKey(target), env.COOKIE_SECRET),
      target,
      await hmac(normalizeFileKey(target), env.COOKIE_SECRET),
    )
    .first<any>();
  if (row) {
    const user = JSON.parse(row.data);
    await env.DB.prepare(
      'INSERT OR IGNORE INTO users(id,handle,created_at,rerolls_used) VALUES(?,?,?,?)',
    )
      .bind(user.id, user.handle, new Date().toISOString(), user.rerolls_used)
      .run();
    if (user.recoveryHash)
      await env.DB.prepare(
        'INSERT OR IGNORE INTO recovery_keys(key_hash,user_id,created_at) VALUES(?,?,?)',
      )
        .bind(user.recoveryHash, user.id, new Date().toISOString())
        .run();
  }
}
export async function finishR17Admin(req: Request, env: Env, response: Response) {
  if (
    !env.DAY_REGISTRY ||
    req.method !== 'POST' ||
    !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
  )
    return false;
  let changed = 0;
  const path = new URL(req.url).pathname;
  const send = async (date: string, action: string, data: any) => {
    const r = await env
      .DAY_REGISTRY!.get(env.DAY_REGISTRY!.idFromName(env.STAGING === 'true' ? 'practice' : date))
      .fetch(
        new Request(PUBLIC_ORIGIN + '/api/admin/' + action, {
          method: 'POST',
          headers: {
            origin: PUBLIC_ORIGIN,
            authorization: 'Bearer ' + env.ADMIN_TOKEN,
            'content-type': 'application/json',
            'x-r17-day': date,
          },
          body: JSON.stringify(data),
        }),
      );
    if (!r.ok) throw Error('R17 administrative propagation failed; retry');
    changed += Number(((await r.json()) as any).changed || 0);
  };
  if (path === '/api/admin/practice-reset' && env.STAGING === 'true') {
    await send(registryDate(), 'r17-reset', {});
    return;
  }
  if (!['/api/admin/hide-user', '/api/admin/void-claim', '/api/admin/set-founder'].includes(path))
    return;
  const b = await body(req.clone() as Request);
  if (path.endsWith('hide-user'))
    await env.DB.prepare("UPDATE r17_players SET data=json_set(data,'$.hidden',1) WHERE id=?")
      .bind(b.id)
      .run();
  const files = (
    await env.DB.prepare(
      'SELECT f.user_id,g.date FROM r17_files f JOIN categories g ON g.id=f.category_id',
    ).all<any>()
  ).results;
  // Current day's unmirrored files must receive moderation too.
  const days = new Set([registryDate(), ...files.map((f) => f.date)]);
  if (path.endsWith('set-founder')) {
    const roles = (await env.DB.prepare('SELECT id FROM users').all<any>()).results;
    for (const date of days)
      for (const { id } of roles) await send(date, 'r17-moderate', { uid: id, role: true });
  } else
    for (const date of days)
      await send(
        date,
        'r17-moderate',
        path.endsWith('hide-user') ? { uid: b.id, hide: true } : { claimId: b.id },
      );
  return changed > 0;
}
