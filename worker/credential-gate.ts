import { normalizeFileKey } from './identity';
import { securityKey, credentialQuota } from './security';
import { body, json, type Env } from './routes';
// One Registry quota spans endpoint, cookie, day, deployment and DO restarts.
export async function credentialGate(req: Request, env: Env, storage?: DurableObjectStorage) {
  const path = new URL(req.url).pathname;
  if (req.method !== 'POST' || !/\/api\/(recover|delete-file)$/.test(path)) return null;
  const payload = await body(req.clone() as Request, path.endsWith('/recover') ? 300 : 3000);
  if (path.endsWith('/delete-file') && !Object.hasOwn(payload, 'key')) return null;
  const raw = payload.key;
  if (
    typeof raw !== 'string' ||
    !/^[a-z0-9\s-]+$/i.test(raw) ||
    !/^DIBS[A-F0-9]{20}$/.test(normalizeFileKey(raw))
  )
    return json({ message: 'Check your backup code and try again.' }, 422);
  const network = await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST);
  // Missing platform IP must never put unrelated players in one global bucket.
  if (!network) return null;
  const allowed = storage
    ? await credentialQuota(storage, network, Date.now())
    : await (
        env.REGISTRY!.get(env.REGISTRY!.idFromName('public-registry-v1')) as any
      ).reserveCredentialQuota(network, Date.now());
  return allowed
    ? null
    : json({ message: 'Too many codes tried; wait 15 minutes.' }, 429, { 'retry-after': '900' });
}
