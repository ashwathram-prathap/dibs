import { beforeAll, afterAll, it, expect } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, writeFileSync } from 'node:fs';
import { decode } from 'jpeg-js';
import { summaryText } from '../src/share';
import { intentUrl } from '../shared/sharing';
let mf: Miniflare;
const agents = [
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'facebookexternalhit',
  'Twitterbot',
  'Slackbot',
  'Discordbot',
];
beforeAll(async () => {
  const html = readFileSync('index.html', 'utf8')
    .replaceAll('__PUBLIC_ORIGIN__', 'https://dibs.here')
    .replace(
      '__BEACON_CONFIG__',
      `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"fixture"}'></script>`,
    );
  const code = await build({
    stdin: {
      contents: `import {og} from './worker/og'; import {preview} from './shared/preview'; import {onRequest as shortPreview} from './functions/c/[id]'; import {onRequest} from './functions/_middleware';
 const file={summaryId:'fixture',points:140,rank:3,players:27,streak:2,dibs:3,strikes:1,events:[{kind:'dibs'},{kind:'strike'}]};
 const category={name:'Animals',date:'2026-11-23'};
 export default {fetch(request){const path=new URL(request.url).pathname; if(path.startsWith('/api/og')) return og(null,path==='/api/og'?undefined:{file,category});
 const env={API:{fetch:async()=>Response.json(path.startsWith('/c/')?{claim:{id:'fixture',category_name:'Animals',claim_no:1,points:140,rank:3,players:27}}:{file,category})},ASSETS:{fetch:async()=>new Response(${JSON.stringify(html)},{headers:{'content-type':'text/html'}})}};
 return onRequest({request,env,next:()=>path.startsWith('/summary/')||path.startsWith('/c/')?(path.startsWith('/c/')?shortPreview:preview('summary'))({request,env,params:{id:'fixture'}}):env.ASSETS.fetch()});}}`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    plugins: [
      {
        name: 'wasm',
        setup(b) {
          b.onResolve({ filter: /\.wasm$/ }, () => ({ path: './resvg.wasm', external: true }));
        },
      },
    ],
    loader: { '.woff': 'binary', '.otf': 'binary' },
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'r19b-preview',
          modules: [
            { type: 'ESModule', path: 'worker.mjs', contents: code.outputFiles[0].text },
            {
              type: 'CompiledWasm',
              path: 'resvg.wasm',
              contents: readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'),
            },
          ],
          compatibilityDate: '2026-11-20',
        },
      ],
    }),
  );
}, 30000);
afterAll(async () => mf?.dispose());
it('allows preview crawlers while excluding private gameplay', async () => {
  const robots = await (await mf.dispatchFetch('https://dibs.here/robots.txt')).text();
  expect(robots).not.toContain('Disallow: /summary/');
  expect(robots).not.toContain('Disallow: /certificate/');
  expect(robots).toContain('Allow: /api/og');
  for (const agent of agents) expect(robots).toContain('User-agent: ' + agent.split('/')[0]);
  expect(robots).toContain('Disallow: /admin');
});
it('serves complete anonymous metadata and 1200x627 JPEGs for every preview bot', async () => {
  const evidence = [];
  for (const agent of agents)
    for (const path of ['/', '/summary/fixture', '/c/fixture']) {
      const r = await mf.dispatchFetch('https://dibs.here' + path, {
        headers: { 'user-agent': agent },
      });
      const html = await r.text();
      expect(r.status).toBe(200);
      for (const [tag, value] of [
        ['og:title', 'Dibs'],
        ['og:description', ''],
        ['og:type', 'website'],
        ['og:url', 'https://'],
        ['og:image', 'https://'],
        ['og:image:width', '1200'],
        ['og:image:height', '627'],
        ['og:image:alt', ''],
        ['twitter:card', 'summary_large_image'],
      ])
        expect(html).toMatch(new RegExp(`(?:property|name)="${tag}" content="${value}`));
      if (path !== '/') expect(html).toContain('Dibs · Animals · 140 pts · #3 of 27');
      const image = html.match(/property="og:image" content="([^"]+)"/)![1];
      const start = performance.now();
      const im = await mf.dispatchFetch(image, { headers: { 'user-agent': agent } });
      const bytes = Buffer.from(await im.arrayBuffer());
      const decoded = decode(bytes);
      expect(im.status).toBe(200);
      expect(im.headers.get('content-type')).toBe('image/jpeg');
      expect([decoded.width, decoded.height]).toEqual([1200, 627]);
      expect(bytes.length).toBeLessThan(1_000_000);
      expect(performance.now() - start).toBeLessThan(3000);
      if (agent === agents[0])
        writeFileSync('review/round19b/' + (path === '/' ? 'home' : 'score') + '-og.jpg', bytes);
      evidence.push({
        agent,
        path,
        status: r.status,
        image,
        statusImage: im.status,
        bytes: bytes.length,
        width: decoded.width,
        height: decoded.height,
      });
    }
  writeFileSync('review/round19b/local-previews.json', JSON.stringify(evidence, null, 2));
}, 30000);
it('uses an evergreen home and answer-free LinkedIn caption and intent', () => {
  const source = readFileSync('worker/og.ts', 'utf8');
  expect(source).not.toContain("|| 'Animals'");
  const text = summaryText(
    {
      points: 140,
      rank: 3,
      players: 27,
      events: [{ kind: 'dibs', display: 'secret', golden: true }],
    } as any,
    { name: 'Animals', date: '2026-11-23' } as any,
  );
  expect(text).toBe("I scored 140 on today's Dibs (Animals), #3 of 27. dibs.here");
  expect(intentUrl('linkedin' as any, text, 'https://dibs.here/summary/fixture')).toContain(
    'https://www.linkedin.com/sharing/share-offsite/?url=',
  );
});

it('makes injected analytics inert and propagates the explicit test header before HTML reaches the browser', async () => {
  const r = await mf.dispatchFetch('https://dibs.here/', { headers: { 'x-dibs-test': '1' } });
  const html = await r.text();
  expect(r.headers.get('cache-control')).toContain('no-transform');
  expect(html).toContain('name="dibs-test"');
  expect(html).toContain('data-dibs-beacon=');
  expect(html).not.toContain('src="https://static.cloudflareinsights.com/');
});
