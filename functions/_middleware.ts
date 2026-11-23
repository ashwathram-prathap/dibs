import { robots } from '../shared/robots';
import { reminder } from '../shared/reminder';
import { canonicalRedirect, secureResponse } from '../shared/security';
import { PUBLIC_ORIGIN } from '../shared/config';
import {
  homeStructuredData,
  archiveDescription,
  sitemap,
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
    const r = await (env as any).API.fetch(
      new Request(origin + '/api' + path, { signal: AbortSignal.timeout(5000) }),
    );
    if (!r.ok) throw Error('Registry unavailable');
    return r.json();
  };
  try {
    if (path === '/reminder.ics') {
      const today: any = await api('/today');
      return secureResponse(
        new Response(reminder(today.nextDrop, origin).ics, {
          headers: {
            'content-type': 'text/calendar; charset=utf-8',
            'content-disposition': 'attachment; filename="dibs-reminder.ics"',
            'cache-control': 'no-store',
          },
        }),
      );
    }
    if (path === '/robots.txt')
      return new Response(robots(origin, staging), {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public,max-age=600',
        },
      });
    let archive: any;
    if (path === '/sitemap.xml') {
      // Crawlers must receive useful XML even during an API outage, malformed
      // archive response, or a service-binding failure. Robots never calls API.
      if (!staging) {
        try {
          archive = await api('/archive');
        } catch {
          archive = undefined;
        }
      }
      return new Response(
        sitemap(origin, Array.isArray(archive?.categories) ? archive.categories : [], staging),
        {
          status: 200,
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public,max-age=600',
            ...(staging ? { 'x-robots-tag': 'noindex' } : {}),
          },
        },
      );
    }
    if (!staging && path === '/archive') archive = await api('/archive');
    if (/^\/catalog\/[^/]+\/manifest\.json$/.test(path)) {
      const asset = await next();
      if (!asset.ok) return asset;
      const { house, ...publicManifest } = (await asset.json()) as any;
      return secureResponse(
        Response.json(publicManifest, { headers: { 'cache-control': 'public, max-age=300' } }),
      );
    }
    const asset = await next();
    // The build adds an exact hash for its inline first-paint CSS. Preserve only
    // those style hashes from our trusted static asset response, never directives.
    const builtStyle =
      asset.headers.get('Content-Security-Policy')?.match(/(?:^|;)\s*style-src ([^;]+)/)?.[1] || '';
    const hashes: string[] = builtStyle.match(/'sha256-[A-Za-z0-9+/]{43}='/g) || [];
    if (!hashes.length && asset.headers.get('content-type')?.includes('text/html')) {
      // Pages does not apply _headers on every Function path. Hash the trusted
      // build output before any route-specific/user content is inserted.
      for (const style of (await asset.clone().text()).matchAll(/<style>([\s\S]*?)<\/style>/g)) {
        const digest = new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(style[1])),
        );
        hashes.push("'sha256-" + btoa(String.fromCharCode(...digest)) + "'");
      }
    }

    let response = secureResponse(asset);
    if (hashes.length)
      response.headers.set(
        'Content-Security-Policy',
        response.headers
          .get('Content-Security-Policy')!
          .replace("style-src 'self'", "style-src 'self' " + hashes.join(' ')),
      );

    const personal = /^\/(api|admin|stats|certificate|summary|c)(\/|$)/.test(path);
    if (staging || personal) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    else response.headers.delete('X-Robots-Tag');
    // Prevent practice HTML injection while allowing normal compression of JS/CSS.
    if (staging)
      response.headers.set(
        'Cache-Control',
        response.headers.get('content-type')?.includes('text/html')
          ? 'no-store, no-transform'
          : 'no-store',
      );
    if (staging)
      response.headers.set(
        'Content-Security-Policy',
        response.headers
          .get('Content-Security-Policy')!
          .replace('wss://dibs.here', 'wss://practice.dibs-7hz.pages.dev'),
      );
    if (!response.headers.get('content-type')?.includes('text/html')) return response;
    // Pages may inject a beacon into the asset. Make it inert before the browser
    // parses HTML; the local loader decides whether this is a real visitor.
    response.headers.set('Cache-Control', 'no-cache, no-transform');
    response = new HTMLRewriter()
      .on('script[src^="https://static.cloudflareinsights.com/"]', {
        element(e) {
          const config = e.getAttribute('data-cf-beacon');
          e.removeAttribute('src');
          e.removeAttribute('defer');
          e.removeAttribute('data-cf-beacon');
          e.setAttribute('type', 'application/json');
          if (config) e.setAttribute('data-dibs-beacon', config);
        },
      })
      .on('head', {
        element(e) {
          if (
            staging ||
            request.headers.has('x-dibs-test') ||
            url.searchParams.get('no-analytics') === '1'
          )
            e.append('<meta name="dibs-test" content="1">', { html: true });
        },
      })
      .transform(response);
    if (personal)
      return new HTMLRewriter()
        .on('script[type="application/ld+json"]', {
          element(e) {
            e.remove();
          },
        })
        .transform(response);
    let title = HOME_TITLE,
      description = HOME_DESCRIPTION,
      canonical = origin + path,
      content = rulesHtml;
    const structured: any[] = homeStructuredData(origin);
    if (path === '/about') {
      title = 'Dibs | Office notice, rules and privacy';
      description = HOME_DESCRIPTION;
      content = rulesHtml + privacyHtml;
    }
    if (path === '/archive') {
      const categories = archive?.categories || [];
      const selected =
        categories.find((c: any) => c.date === url.searchParams.get('date')) ||
        (!url.searchParams.has('date') ? categories[0] : null);
      title = 'Dibs | The archive of closed registers';
      description = HOME_DESCRIPTION;
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
        const before = Math.max(0, Math.floor(Number(url.searchParams.get('before')) || 0));
        const ledger = await api(
          '/ledger?category=' +
            encodeURIComponent(selected.id) +
            (before ? '&before=' + before : ''),
        );
        const nextBefore =
          ledger.rows?.length === 50 ? Math.min(...ledger.rows.map((r: any) => r.claim_no)) : 0;
        title = archiveTitle(selected);
        description = archiveDescription(selected);
        canonical = origin + '/archive?date=' + selected.date + (before ? '&before=' + before : '');
        if (before) title += ' | Filings before #' + before;
        content +=
          `<h2>${escapeHtml(selected.name)} · ${selected.date}</h2><p>${selected.total_registrable} registered answers.</p><table><caption>Who claimed what</caption><thead><tr><th>Answer</th><th>Holder</th><th>Time</th></tr></thead><tbody>` +
          (ledger.rows || [])
            .map(
              (r: any) =>
                `<tr><td>${escapeHtml(r.display)}</td><td>${escapeHtml(r.handle)}</td><td>${escapeHtml(r.created_at)}</td></tr>`,
            )
            .join('') +
          '</tbody></table>' +
          (nextBefore
            ? `<p><a href="/archive?date=${selected.date}&amp;before=${nextBefore}">Earlier filings</a></p>`
            : '');
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
      // The static home contains its graph without a Function request. Replace
      // that graph on rewritten routes so archive metadata is emitted once.
      .on('script[type="application/ld+json"]', {
        element(e) {
          e.remove();
        },
      })
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
          e.setInnerContent('<main class="seo-fallback">' + content + '</main>', { html: true });
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
    if (staging)
      rewrite.on('script[src^="https://static.cloudflareinsights.com/"]', {
        element(e) {
          e.remove();
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
