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
