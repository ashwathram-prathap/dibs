import { GAME_DESCRIPTION } from './copy';
import { PUBLIC_ORIGIN } from './config';
interface Env {
  STAGING?: string;
  API: Fetcher;
  ASSETS: Fetcher;
}
// Both metadata surfaces use the same anonymous, spoiler-free record.
export function preview(kind: 'certificate' | 'summary'): PagesFunction<Env> {
  return async ({ request, env, params }) => {
    const publicOrigin =
      env.STAGING === 'true' ? 'https://practice.dibs-7hz.pages.dev' : PUBLIC_ORIGIN;
    const id = encodeURIComponent(String(params.id));
    const origin = new URL(request.url).origin;
    const response = await env.API.fetch(new Request(`${publicOrigin}/api/${kind}/${id}`));
    if (!response.ok)
      return new Response('Dibs: this file is not on record.', { status: response.status });
    const data = (await response.json()) as any;
    const title =
      kind === 'summary'
        ? `Dibs, ${data.category.name}: ${data.file.points ?? 0} pts, ${data.file.rank ? '#' + data.file.rank + ' of ' + data.file.players : 'unranked'}, streak ${data.file.streak || 0}.`
        : `Dibs · Certificate No. ${data.claim.claim_no}`;
    const description = GAME_DESCRIPTION;
    const image = `${publicOrigin}/api/og/${kind === 'summary' ? 'summary/' : ''}${id}?v=14`;
    const canonical = `${publicOrigin}/${kind}/${id}`;
    const tags: Record<string, string> = {
      'meta[name="robots"]': 'noindex,nofollow',
      'meta[name="description"]': description,
      'meta[property="og:title"]': title,
      'meta[property="og:description"]': description,
      'meta[property="og:image"]': image,
      'meta[property="og:image:width"]': '1200',
      'meta[property="og:image:height"]': '630',
      'meta[property="og:url"]': canonical,
      'meta[name="twitter:title"]': title,
      'meta[name="twitter:description"]': description,
      'meta[name="twitter:image"]': image,
      'meta[name="twitter:card"]': 'summary_large_image',
    };
    const html = await env.ASSETS.fetch(new Request(origin + '/index.html'));
    const rewrite = new HTMLRewriter().on('title', {
      element(e) {
        e.setInnerContent(title);
      },
    });
    for (const [selector, value] of Object.entries(tags))
      rewrite.on(selector, {
        element(e) {
          e.setAttribute('content', value);
        },
      });
    rewrite.on('link[rel="canonical"]', {
      element(e) {
        e.setAttribute('href', canonical);
      },
    });
    return rewrite.transform(html);
  };
}
