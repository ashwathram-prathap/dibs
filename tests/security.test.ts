import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  canonicalRedirect,
  originFailure,
  SECURITY_HEADERS,
  CSP,
  invalidParameters,
} from '../shared/security';
import { constantEqual, cookieUser, sessionCookie } from '../worker/identity';
import { gate, type Gate } from '../worker/security';

describe('Round 5 security boundaries', () => {
  it('redirects every alternate HTTP/HTTPS host while preserving path and query', () => {
    for (const origin of [
      'http://dibs.here',
      'http://www.dibs.here',
      'https://www.dibs.here',
      'http://dibs-7hz.pages.dev',
      'https://dibs-7hz.pages.dev',
      'https://dibs-api.example.workers.dev',
    ]) {
      const r = canonicalRedirect(new Request(origin + '/certificate/abcdef12?s=copy-link'))!;
      expect(r.status).toBe(301);
      expect(r.headers.get('location')).toBe('https://dibs.here/certificate/abcdef12?s=copy-link');
    }
    expect(canonicalRedirect(new Request('https://dibs.here/'))).toBeNull();
  });
  it('uses identical strict static and dynamic headers', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      expect(headers).toContain(`${name}: ${value}`);
    expect(CSP).not.toMatch(/unsafe-inline|unsafe-eval|http:|ws:/);
    expect(CSP).toContain("form-action 'self'");
    expect(CSP).toContain('wss://dibs.here');
  });
  it('requires the canonical Origin on writes including admin and WebSockets', () => {
    for (const path of ['/api/claim', '/api/admin/approve', '/api/events/share', '/api/live']) {
      for (const origin of [
        undefined,
        'null',
        'https://elsewhere.example',
        'https://dibs.here.evil.test',
        'http://localhost:5173',
      ]) {
        expect(
          originFailure(
            new Request('https://dibs.here' + path, {
              method: path.endsWith('live') ? 'GET' : 'POST',
              headers: origin ? { origin } : {},
            }),
          )?.status,
        ).toBe(path.includes('/admin/') ? 404 : 403);
      }
      expect(
        originFailure(
          new Request('https://dibs.here' + path, {
            method: 'POST',
            headers: { origin: 'https://dibs.here' },
          }),
        ),
      ).toBeNull();
    }
  });
  it('bounds query and identifier inputs before cache or database access', () => {
    for (const path of [
      '/api/ledger?since=-1',
      '/api/ledger?category=%27%20OR%201=1',
      '/api/answers?q=' + 'a'.repeat(121),
      '/api/og/%3Cscript%3E',
      '/api/today?token=private',
    ])
      expect(invalidParameters(new Request('https://dibs.here' + path))).toBe(true);
  });
  it('authenticates cookies and compares tokens with cryptographic verification', async () => {
    const id = crypto.randomUUID();
    const cookie = await sessionCookie(id, 'test-cookie-signing-key');
    expect(cookie).toContain('; Secure');
    expect(cookie).toContain('HttpOnly; SameSite=Lax; Path=/');
    expect(cookie).not.toContain('Domain=');
    expect(
      await cookieUser(
        new Request('https://dibs.here', { headers: { cookie } }),
        'test-cookie-signing-key',
      ),
    ).toBe(id);
    expect(
      await cookieUser(
        new Request('https://dibs.here', {
          headers: { cookie: cookie.replace(id, crypto.randomUUID()) },
        }),
        'test-cookie-signing-key',
      ),
    ).toBeNull();
    expect(await constantEqual('Bearer test-admin', 'Bearer test-admin')).toBe(true);
    expect(await constantEqual('Bearer test-admiN', 'Bearer test-admin')).toBe(false);
  });
  it('locks even a correct token for 15 minutes after ten failures, then recovers', () => {
    let state: Gate | undefined;
    for (let i = 0; i < 10; i++) {
      const result = gate(state, 1000 + i, false, true);
      expect(result.status).toBe(404);
      state = result.state;
    }
    expect(gate(state, 1000 + 900000, true, true).status).toBe(404);
    expect(gate(state, 1009 + 900000, true, true).status).toBe(200);
  });
  it('limits authenticated admin and anonymous events independently', () => {
    for (const [admin, maximum] of [
      [true, 60],
      [false, 30],
    ] as const) {
      let state: Gate | undefined;
      for (let i = 0; i < maximum; i++) {
        const result = gate(state, 1000, true, admin);
        expect(result.status).toBe(200);
        state = result.state;
      }
      expect(gate(state, 1001, true, admin).status).toBe(429);
      expect(gate(state, 61000, true, admin).status).toBe(200);
    }
  });
});
