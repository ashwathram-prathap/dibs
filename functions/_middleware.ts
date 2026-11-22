import { canonicalRedirect, secureResponse } from '../shared/security';
import { PUBLIC_ORIGIN } from '../shared/config';
import {
  HOME_TITLE,
  HOME_DESCRIPTION,
  archiveTitle,
  rulesHtml,
  privacyHtml,
  escapeHtml,
} from '../shared/seo';
export const onRequest: PagesFunction = async ({ request, next, env }) => {
  const staging = (env as any).STAGING === 'true';
  const origin = staging ? 'https://practice.dibs-7hz.pages.dev' : PUBLIC_ORIGIN;
  const url = new URL(request.url);
  const path = url.pathname;
  const redirect = canonicalRedirect(request, false, origin);
  if (redirect) return secureResponse(redirect);
  const api = async (path: string) => {
    const r = await (env as any).API.fetch(new Request(origin + '/api' + path));
    if (!r.ok) throw Error('Registry unavailable');
    return r.json();
  };
  try {
    if (path === '/robots.txt')
      return new Response(
        staging
          ? 'User-agent: *\nDisallow: /\n'
          : `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /stats\nDisallow: /certificate/\nDisallow: /summary/\nSitemap: ${origin}/sitemap.xml\n`,
        { headers: { 'content-type': 'text/plain', 'cache-control': 'public,max-age=600' } },
      );
    let archive: any;
    if (!staging && (path === '/archive' || path === '/sitemap.xml'))
      archive = await api('/archive');
    if (path === '/sitemap.xml') {
      const entries = staging
        ? []
        : [
            { loc: '/', lastmod: '2026-11-22' },
            { loc: '/about', lastmod: '2026-11-22' },
            ...(archive?.categories || []).map((c: any) => ({
              loc: '/archive?date=' + c.date,
              lastmod: c.date,
            })),
          ];
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
          entries
            .map(
              (e: any) =>
                `<url><loc>${escapeHtml(origin + e.loc)}</loc><lastmod>${e.lastmod}</lastmod></url>`,
            )
            .join('') +
          '</urlset>',
        {
          headers: {
            'content-type': 'application/xml',
            'cache-control': 'public,max-age=600',
            ...(staging ? { 'x-robots-tag': 'noindex' } : {}),
          },
        },
      );
    }
    let response = secureResponse(await next());
    const personal = /^\/(api|admin|stats|certificate|summary|c)(\/|$)/.test(path);
    if (staging || personal) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    else response.headers.delete('X-Robots-Tag');
    if (staging)
      response.headers.set(
        'Content-Security-Policy',
        response.headers
          .get('Content-Security-Policy')!
          .replace('wss://dibs.here', 'wss://practice.dibs-7hz.pages.dev'),
      );
    if (!response.headers.get('content-type')?.includes('text/html') || personal) return response;
    let title = HOME_TITLE,
      description = HOME_DESCRIPTION,
      canonical = origin + path,
      content = rulesHtml;
    const structured: any[] = [
      { '@type': 'WebSite', name: 'Dibs', url: origin, description: HOME_DESCRIPTION },
      {
        '@type': 'VideoGame',
        name: 'Dibs',
        url: origin,
        description: HOME_DESCRIPTION,
        genre: 'word game',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    ];
    if (path === '/about') {
      title = 'Dibs | Office notice, rules and privacy';
      description =
        'How Dibs works, the golden-ticket draw, data sources and a plain-language privacy notice.';
      content = rulesHtml + privacyHtml;
    }
    if (path === '/archive') {
      const categories = archive?.categories || [];
      const selected =
        categories.find((c: any) => c.date === url.searchParams.get('date')) ||
        (!url.searchParams.has('date') ? categories[0] : null);
      title = 'Dibs | The archive of closed registers';
      description = 'Browse past Dibs categories and see who claimed each answer.';
      content =
        '<h1>Dibs archive</h1><nav>' +
        categories
          .map(
            (c: any) =>
              `<a href="/archive?date=${c.date}">${escapeHtml(c.date + ' / ' + c.name)}</a>`,
          )
          .join(' · ') +
        '</nav>';
      if (selected) {
        const ledger = await api('/ledger?category=' + encodeURIComponent(selected.id));
        title = archiveTitle(selected);
        description = `Who claimed what in ${selected.name} on ${selected.date}. The closed Dibs register and golden-ticket verification.`;
        canonical = origin + '/archive?date=' + selected.date;
        content +=
          `<h2>${escapeHtml(selected.name)} · ${selected.date}</h2><p>${selected.total_registrable} registered answers.</p><table><caption>Who claimed what</caption><thead><tr><th>Answer</th><th>Holder</th><th>Time</th></tr></thead><tbody>` +
          (ledger.rows || [])
            .map(
              (r: any) =>
                `<tr><td>${escapeHtml(r.display)}</td><td>${escapeHtml(r.handle)}</td><td>${escapeHtml(r.created_at)}</td></tr>`,
            )
            .join('') +
          '</tbody></table>';
        structured.push({
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Dibs', item: origin },
            { '@type': 'ListItem', position: 2, name: 'Archive', item: origin + '/archive' },
            { '@type': 'ListItem', position: 3, name: selected.name, item: canonical },
          ],
        });
      } else if (url.searchParams.has('date'))
        return new Response('Dibs: that closed register is not on file.', { status: 404 });
      else content += '<p>The first register appears here after a day closes.</p>';
    }
    const tags: Record<string, string> = {
      'meta[name="description"]': description,
      'meta[property="og:title"]': title,
      'meta[property="og:description"]': description,
      'meta[property="og:url"]': canonical,
      'meta[name="twitter:title"]': title,
      'meta[name="twitter:description"]': description,
      'meta[name="robots"]': staging ? 'noindex,nofollow' : 'index,follow',
    };
    const rewrite = new HTMLRewriter()
      .on('title', {
        element(e) {
          e.setInnerContent(title);
        },
      })
      .on('link[rel="canonical"]', {
        element(e) {
          e.setAttribute('href', canonical);
        },
      })
      .on('#root', {
        element(e) {
          e.setInnerContent('<main>' + content + '</main>', { html: true });
        },
      })
      .on('head', {
        element(e) {
          if (!staging)
            e.append(
              '<script type="application/ld+json">' +
                JSON.stringify({ '@context': 'https://schema.org', '@graph': structured }).replace(
                  /</g,
                  '\\u003c',
                ) +
                '</script>',
              { html: true },
            );
        },
      });
    for (const [selector, value] of Object.entries(tags))
      rewrite.on(selector, {
        element(e) {
          e.setAttribute('content', value);
        },
      });
    return rewrite.transform(response);
  } catch {
    return secureResponse(
      new Response('The filing cabinet is unavailable. Please try again.', { status: 503 }),
    );
  }
};
