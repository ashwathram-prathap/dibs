import { PUBLIC_ORIGIN } from './config';

export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'sha256-157BWqHyTyPFG6i5YK8C+MRWL9RH2aIQ6rGpoTtr4ss=' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  'frame-src https://challenges.cloudflare.com',
  `connect-src 'self' ${PUBLIC_ORIGIN.replace('https:', 'wss:')} https://cloudflareinsights.com`,
  "style-src 'self' 'sha256-tGcX84i8QhAiqHzBGNMhpPSbS+0w90QufmkdsrKzfsQ='",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
export function secureResponse(response: Response) {
  // Cloudflare's Response constructor preserves the WebSocket upgrade.
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  return secured;
}
export const isLocal = (req: Request, enabled?: string) =>
  enabled === 'true' && ['localhost', '127.0.0.1'].includes(new URL(req.url).hostname);
export function canonicalRedirect(req: Request, local = false, origin = PUBLIC_ORIGIN) {
  const url = new URL(req.url);
  if (!local && url.origin !== origin)
    return Response.redirect(origin + url.pathname + url.search, 301);
  return null;
}
export function allowedOrigin(req: Request, local = false) {
  const origin = req.headers.get('origin');
  return (
    origin === PUBLIC_ORIGIN ||
    (local && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || ''))
  );
}
export function originFailure(req: Request, local = false) {
  if (
    (['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method) ||
      new URL(req.url).pathname === '/api/live') &&
    !allowedOrigin(req, local)
  )
    return new Response(
      JSON.stringify({ message: 'Please file from the registry’s own window.' }),
      {
        status: new URL(req.url).pathname.startsWith('/api/admin/') ? 404 : 403,
        headers: { 'content-type': 'application/json' },
      },
    );
  return null;
}
export function corsResponse(req: Request, response: Response, local = false) {
  const result = secureResponse(response);
  if (allowedOrigin(req, local)) {
    result.headers.set('Access-Control-Allow-Origin', req.headers.get('origin')!);
    result.headers.set('Access-Control-Allow-Credentials', 'true');
    result.headers.append('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      result.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      result.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  }
  return result;
}
export const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{2,80}$/.test(value);
export const validText = (value: unknown, max = 120): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}]+$/u.test(value);
export function invalidParameters(req: Request) {
  const u = new URL(req.url);
  if (u.pathname.length > 200 || u.search.length > 500) return true;
  for (const [key, value] of u.searchParams) {
    if (['category', 'id'].includes(key) && !validId(value)) return true;
    if (['since', 'before', 'limit'].includes(key) && !/^\d{1,10}$/.test(value)) return true;
    if (key === 'q' && value && !validText(value)) return true;
    if (
      !['category', 'id', 'since', 'before', 'limit', 'q', 'v', 's'].includes(key) ||
      value.length > 120
    )
      return true;
  }
  const id = u.pathname.match(/^\/api\/(?:certificate|summary|og(?:\/summary)?)\/(.*)$/)?.[1];
  return id !== undefined && !validId(id);
}

// Provenance is descriptive JSON, never executable markup or query text.
export function validMetadata(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string')
    return value.length <= 4096 && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
  if (Array.isArray(value))
    return value.length <= 100 && value.every((v) => validMetadata(v, depth + 1));
  if (typeof value !== 'object') return false;
  const entries = Object.entries(value);
  return (
    entries.length <= 100 &&
    entries.every(
      ([key, v]) => /^[a-zA-Z][a-zA-Z0-9_-]{0,60}$/.test(key) && validMetadata(v, depth + 1),
    )
  );
}
