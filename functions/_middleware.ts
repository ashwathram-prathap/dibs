import { canonicalRedirect, secureResponse } from '../shared/security';
export const onRequest: PagesFunction = async ({ request, next }) => {
  try {
    return secureResponse(canonicalRedirect(request) || (await next()));
  } catch {
    return secureResponse(
      new Response('The filing cabinet is unavailable. Please try again.', { status: 503 }),
    );
  }
};
