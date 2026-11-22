import { beforeAll, afterAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
let mf: Miniflare;
beforeAll(async () => {
  const html = readFileSync('index.html', 'utf8').replaceAll(
    '__PUBLIC_ORIGIN__',
    'https://dibs.here',
  );
  const source = `import {onRequest} from './functions/_middleware';
 const category={id:'closed',name:'Animals',date:'2026-11-23',total_registrable:90000};
 const rows=Array.from({length:120},(_,i)=>({claim_no:120-i,display:'Entry '+(120-i),handle:'Example holder',created_at:'2026-11-24T02:03:00Z'}));
 export default {fetch(request,env){return onRequest({request,env:{STAGING:new URL(request.url).hostname.startsWith('practice.')?'true':'false',API:{fetch:async req=>{const u=new URL(req.url);return Response.json(u.pathname==='/api/archive'?{categories:[category]}:{rows:rows.filter(r=>r.claim_no<(Number(u.searchParams.get('before'))||Infinity)).slice(0,50)});}}},next:async()=>new Response(${JSON.stringify(html)},{headers:{'content-type':'text/html'}})});}};`;
  const compiled = await build({
    stdin: { contents: source, resolveDir: process.cwd() },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'seo-test',
          modules: true,
          script: compiled.outputFiles[0].text,
          compatibilityDate: '2026-11-20',
        },
      ],
    }),
  );
});
afterAll(async () => mf?.dispose());
it('serves indexable production rules and privacy as real HTML without executing React', async () => {
  const home = await mf.dispatchFetch('https://dibs.here/');
  const text = await home.text();
  expect(home.status).toBe(200);
  expect(home.headers.get('x-robots-tag')).toBeNull();
  expect(text).toContain('<h1>Dibs</h1>');
  expect(text).toContain('How to play');
  expect(text).toContain('application/ld+json');
  expect(text).toContain('"@type":"VideoGame"');
  expect(text).toContain('content="index,follow"');
  const about = await (await mf.dispatchFetch('https://dibs.here/about')).text();
  expect(about).toContain('Missing-answer submissions');
  expect(about).toContain('Delete my file');
  expect(about).not.toContain('privacy@dibs.here');
  expect(about).toContain('Dibs | Office notice, rules and privacy');
});
it('renders complete archive pagination, canonical links and automatic sitemap entries', async () => {
  const first = await (await mf.dispatchFetch('https://dibs.here/archive?date=2026-11-23')).text();
  expect(first).toContain('Entry 120');
  expect(first).toContain('Entry 71');
  expect(first).not.toContain('Entry 70<');
  expect(first).toContain('/archive?date=2026-11-23&amp;before=71');
  expect(first).toContain('BreadcrumbList');
  expect(first).toContain('Dibs #1: Animals (Nov 23, 2026) | Who claimed what');
  const second = await (
    await mf.dispatchFetch('https://dibs.here/archive?date=2026-11-23&before=71')
  ).text();
  expect(second).toContain('Entry 70');
  expect(second).not.toContain('Entry 120');
  expect(second).toContain('Filings before #71');
  const map = await (await mf.dispatchFetch('https://dibs.here/sitemap.xml')).text();
  expect(map).toContain('<loc>https://dibs.here/archive?date=2026-11-23</loc>');
  expect(map).toContain('<lastmod>2026-11-23</lastmod>');
});
it('keeps practice and personal pages out of search results', async () => {
  for (const url of [
    'https://practice.dibs-7hz.pages.dev/',
    'https://dibs.here/certificate/example',
    'https://dibs.here/summary/example',
  ]) {
    const r = await mf.dispatchFetch(url);
    expect(r.headers.get('x-robots-tag')).toContain('noindex');
  }
  const robots = await (
    await mf.dispatchFetch('https://practice.dibs-7hz.pages.dev/robots.txt')
  ).text();
  expect(robots).toBe('User-agent: *\nDisallow: /\n');
});
