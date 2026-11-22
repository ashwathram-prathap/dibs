import { expect, it } from 'vitest';
import { acceptedVerification } from '../worker/turnstile';
it('confines official test credentials to practice and keeps real hostname/action checks', () => {
  const env = {
    STAGING: 'true',
    TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  };
  const dummy = { success: true, hostname: 'example.com' };
  expect(acceptedVerification(dummy, env, 'https://practice.dibs-7hz.pages.dev')).toBe(false);
  expect(acceptedVerification(dummy, env, 'https://practice.dibs-7hz.pages.dev', true)).toBe(true);
  expect(acceptedVerification(dummy, env, 'https://dibs.here')).toBe(false);
  expect(
    acceptedVerification(
      dummy,
      { ...env, STAGING: undefined },
      'https://practice.dibs-7hz.pages.dev',
      true,
    ),
  ).toBe(false);
  expect(
    acceptedVerification(
      dummy,
      { ...env, TURNSTILE_SECRET: 'real' },
      'https://practice.dibs-7hz.pages.dev',
      true,
    ),
  ).toBe(false);
  expect(
    acceptedVerification(
      { success: false, hostname: 'example.com' },
      env,
      'https://practice.dibs-7hz.pages.dev',
      true,
    ),
  ).toBe(false);
  for (const result of [
    { success: true, hostname: 'elsewhere.test', action: 'claim' },
    { success: true, hostname: 'dibs.here', action: 'other' },
    { success: false, hostname: 'dibs.here', action: 'claim' },
  ])
    expect(acceptedVerification(result, {}, 'https://dibs.here')).toBe(false);
  expect(
    acceptedVerification(
      { success: true, hostname: 'dibs.here', action: 'claim' },
      {},
      'https://dibs.here',
    ),
  ).toBe(true);
});
