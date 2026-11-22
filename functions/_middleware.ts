import { canonicalRedirect, secureResponse } from '../shared/security';
export const onRequest: PagesFunction = async ({ request, next, env }) => {
  try {
    const origin =
      (env as any)?.STAGING === 'true' ? 'https://practice.dibs-7hz.pages.dev' : undefined;
    const response = secureResponse(canonicalRedirect(request, false, origin) || (await next()));
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (origin)
      response.headers.set(
        'Content-Security-Policy',
        response.headers
          .get('Content-Security-Policy')!
          .replace('wss://dibs.here', 'wss://practice.dibs-7hz.pages.dev'),
      );
    return response;
  } catch {
    return secureResponse(
      new Response('The filing cabinet is unavailable. Please try again.', { status: 503 }),
    );
  }
};
