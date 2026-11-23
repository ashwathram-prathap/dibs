import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { homeStructuredData, HOME_DESCRIPTION, archiveDescription, sitemap } from '../shared/seo';
import { pingIndexNow, INDEXNOW_KEY, INDEXNOW_ENDPOINT } from '../shared/indexnow';
import { readFileSync } from 'node:fs';
let mf: Miniflare;
beforeAll(async () => {
  const compiled = await build({
    stdin: {
      contents: `import {onRequest} from './functions/_middleware';
    export default {fetch(request,env){return onRequest({request,env:{API:{fetch:async()=>{
      const mode=request.headers.get('x-api-mode');
      if(mode==='throw') throw Error('offline');
      if(mode==='status') return new Response('down',{status:503});
      if(mode==='json') return new Response('not json');
      return Response.json({categories:mode==='shape'?{}:[null,{date:'not-date'},{date:'2026-02-31'},{date:'2026-11-23'}]});
    }}},next:async()=>new Response('<html><head><title></title></head><body><div id="root"></div></body></html>',{headers:{'content-type':'text/html'}})});}}`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'seo-r18',
          modules: true,
          script: compiled.outputFiles[0].text,
          compatibilityDate: '2026-11-20',
        },
      ],
    }),
  );
});
afterAll(async () => mf?.dispose());
it.each(['throw', 'status', 'json', 'shape', 'invalid-dates'])(
  'keeps sitemap and robots readable through %s API failure',
  async (mode) => {
    for (const agent of ['Googlebot', 'bingbot']) {
      const response = await mf.dispatchFetch('https://dibs.here/sitemap.xml', {
        headers: { 'x-api-mode': mode, 'user-agent': agent },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
      const xml = await response.text();
      expect(xml).toMatch(
        /^<\?xml.*<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/,
      );
      expect(xml).toContain('<loc>https://dibs.here/</loc>');
      expect(xml).toContain('<loc>https://dibs.here/about</loc>');
      expect(xml).not.toMatch(/not-date|2026-02-31|challenge|unavailable/i);
      for (const [, date] of xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g))
        expect(new Date(date).toISOString().slice(0, 10)).toBe(date);
      const robots = await mf.dispatchFetch('https://dibs.here/robots.txt', {
        headers: { 'x-api-mode': mode, 'user-agent': agent },
      });
      expect(robots.status).toBe(200);
      expect(robots.headers.get('content-type')).toBe('text/plain; charset=utf-8');
      expect(await robots.text()).toContain('Sitemap: https://dibs.here/sitemap.xml');
    }
  },
);
it('uses schema.org VideoGame, CreativeWork, Offer and Person properties with their declared value types', async () => {
  // Property/range contract: https://schema.org/VideoGame, /Offer, /Person, /WebSite.
  const home = await mf.dispatchFetch('https://dibs.here/');
  const html = await home.text();
  const json = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
  expect(json['@context']).toBe('https://schema.org');
  expect(json['@graph']).toEqual(homeStructuredData('https://dibs.here'));
  const [website, game] = json['@graph'];
  expect(website['@type']).toBe('WebSite');
  expect(game['@type']).toBe('VideoGame');
  for (const entity of [website, game]) {
    expect(entity.name).toBe('Dibs');
    expect(entity.description).toBe(HOME_DESCRIPTION);
    expect(new URL(entity.url).protocol).toBe('https:');
  }
  expect(game).toMatchObject({
    genre: 'Word game',
    gamePlatform: 'Web browser',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  });
  for (const person of [website.author, game.author, game.publisher])
    expect(person).toEqual({ '@type': 'Person', name: 'Ashwathram Prathap' });
  expect(JSON.stringify(json)).not.toMatch(/aggregateRating|review|ratingValue/);
});
it('gives each archive date its own description and sitemap lastmod', () => {
  const a = { date: '2026-11-23', name: 'Animals' },
    b = { date: '2026-11-24', name: 'Cities' };
  expect(archiveDescription(a)).not.toBe(archiveDescription(b));
  for (const c of [a, b]) {
    expect(archiveDescription(c)).toContain(c.date);
    expect(sitemap('https://dibs.here', [a, b])).toContain(`<lastmod>${c.date}</lastmod>`);
  }
});
it('sends only changed production URLs using its committed public key and tolerates failures', async () => {
  expect(readFileSync(`public/${INDEXNOW_KEY}.txt`, 'utf8').trim()).toBe(INDEXNOW_KEY);
  const send = vi.fn(async () => new Response(null, { status: 202 }));
  expect(
    (await pingIndexNow(['/', '/archive', '/archive?date=2026-11-23', '/'], send as any)).ok,
  ).toBe(true);
  const [url, options] = send.mock.calls[0] as any;
  expect(url).toBe(INDEXNOW_ENDPOINT);
  expect(JSON.parse(options.body)).toEqual({
    host: 'dibs.here',
    key: INDEXNOW_KEY,
    keyLocation: `https://dibs.here/${INDEXNOW_KEY}.txt`,
    urlList: [
      'https://dibs.here/',
      'https://dibs.here/archive',
      'https://dibs.here/archive?date=2026-11-23',
    ],
  });
  expect(
    (
      await pingIndexNow(['/'], async () => {
        throw Error('offline');
      })
    ).ok,
  ).toBe(false);
  expect((await pingIndexNow(['/'], async () => new Response(null, { status: 429 }))).ok).toBe(
    false,
  );
  expect((await pingIndexNow(['https://elsewhere.invalid/'], send as any)).ok).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
});
