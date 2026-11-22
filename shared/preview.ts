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
        ? `Dibs · ${data.file.dibs}/3 · ${data.file.strikes} ${data.file.strikes === 1 ? 'strike' : 'strikes'}`
        : `Dibs · Certificate No. ${data.claim.claim_no}`;
    const description =
      kind === 'summary'
        ? `A day on file, ${data.category.date}. Three dibs. Five strikes. Next drop: 9 PM ET.`
        : `One more on file, ${data.claim.category_date}. Call your own Dibs at 9 PM ET.`;
    const image = `${publicOrigin}/api/og/${kind === 'summary' ? 'summary/' : ''}${id}?v=7`;
    const canonical = `${publicOrigin}/${kind}/${id}`;
    const tags: Record<string, string> = {
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
