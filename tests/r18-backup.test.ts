import { it, expect } from 'vitest';
import { backupCode } from '../worker/backup-code';
import { fileKey, sessionCookie, normalizeFileKey, hmac } from '../worker/identity';
it('returns only the cookie owner’s already-issued code without writing or storing plaintext', async () => {
  const uid = '00000000-0000-4000-8000-000000000001',
    other = '00000000-0000-4000-8000-000000000002',
    secret = 'test-key';
  const code = await fileKey(uid, secret),
    hash = await hmac(normalizeFileKey(code), secret);
  const requests: any[] = [];
  const env: any = {
    COOKIE_SECRET: secret,
    R17_STORAGE: 'true',
    DB: {
      prepare: (query: string) => ({
        bind: (...params: any[]) => ({
          first: async () => {
            requests.push({ query, params });
            return params[0] === uid && params[1] === hash ? { 1: 1 } : null;
          },
        }),
      }),
    },
  };
  const call = (cookie?: string, currentHash?: string) =>
    backupCode(
      new Request('https://dibs.here/api/backup-code', { headers: cookie ? { cookie } : {} }),
      env,
      currentHash,
    );
  expect(await (await call()).json()).toEqual({ code: null });
  expect(requests).toEqual([]);
  expect(await (await call('dibs_session=' + uid + '.forged')).json()).toEqual({ code: null });
  expect(requests).toEqual([]);
  const cookie = await sessionCookie(uid, secret),
    result = await call(cookie);
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(await result.json()).toEqual({ code });
  expect(await (await call(await sessionCookie(other, secret), hash)).json()).toEqual({
    code: null,
  });
  requests.length = 0;
  expect(await (await call(cookie, hash)).json()).toEqual({ code });
  expect(requests).toEqual([]);
});
