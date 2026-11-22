declare const DIBS_PRACTICE_TEST_MODE: boolean;
const testBuild = typeof DIBS_PRACTICE_TEST_MODE !== 'undefined' && DIBS_PRACTICE_TEST_MODE;
// Official Cloudflare test credentials are supported only on the practice origin.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
export function acceptedVerification(
  result: { success?: boolean; hostname?: string; action?: string },
  env: { STAGING?: string; TURNSTILE_SECRET?: string; TURNSTILE_SITE_KEY?: string },
  origin: string,
  testingBuild = testBuild,
) {
  const officialPracticeTest =
    testingBuild &&
    env.STAGING === 'true' &&
    origin === 'https://practice.dibs-7hz.pages.dev' &&
    env.TURNSTILE_SECRET === '1x0000000000000000000000000000000AA' &&
    env.TURNSTILE_SITE_KEY === '1x00000000000000000000AA';
  return (
    result.success === true &&
    (officialPracticeTest
      ? result.hostname === 'example.com' && result.action === undefined
      : result.hostname === new URL(origin).hostname && result.action === 'claim')
  );
}

import { hmac, verify } from './identity';
import { securityKey } from './security';
import { isLocal } from '../shared/security';
import { PUBLIC_ORIGIN } from '../shared/config';
export async function verifyChallenge(req: Request, env: any, token: unknown) {
  if (typeof token !== 'string' || !/^[a-zA-Z0-9_.-]{1,2048}$/.test(token)) return false;
  if (isLocal(req, env.LOCAL_TEST)) return true;
  if (!env.TURNSTILE_SECRET) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
  });
  return acceptedVerification(await r.json(), env, PUBLIC_ORIGIN);
}
export async function verificationToken(req: Request, env: any, uid: string) {
  const expires = Date.now() + 30 * 60000;
  const value = `claim:${uid}:${expires}:${await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST)}`;
  return { sessionToken: `${expires}.${await hmac(value, env.COOKIE_SECRET)}`, expires };
}
export async function verifiedSession(req: Request, env: any, uid: string, token: unknown) {
  if (typeof token !== 'string') return false;
  const [expiry, signature] = token.split('.');
  const expires = Number(expiry);
  if (
    !signature ||
    !Number.isSafeInteger(expires) ||
    expires <= Date.now() ||
    expires > Date.now() + 30 * 60000
  )
    return false;
  return verify(
    `claim:${uid}:${expires}:${await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST)}`,
    signature,
    env.COOKIE_SECRET,
  );
}
