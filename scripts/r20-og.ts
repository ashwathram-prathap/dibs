import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { decode } from 'jpeg-js';
const dir = 'review/round20/og';
mkdirSync(dir, { recursive: true });
const bundled = await build({
  stdin: {
    contents: `import {og,ogLayout} from './worker/og'; import {publicSummary,visibleClaim} from './worker/visibility'; export default {async fetch(r) { const v=await r.json(); const claim=v.claim ? visibleClaim(v.claim,false,false,v.shown) : null; const summary=v.summary ? publicSummary(v.summary,false,v.shown) : undefined; return v.layout ? Response.json(await ogLayout(claim,summary,v.dark)) : og(claim,summary,v.dark); }}`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  define: { DIBS_PUBLIC_ORIGIN: JSON.stringify('https://practice.dibs-7hz.pages.dev') },
  plugins: [
    {
      name: 'compiled-wasm',
      setup(b) {
        b.onResolve({ filter: /\.wasm$/ }, () => ({ path: './resvg.wasm', external: true }));
      },
    },
  ],
  loader: { '.woff': 'binary', '.otf': 'binary' },
});
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'r19d-og',
        modules: [
          { type: 'ESModule', path: 'worker.mjs', contents: bundled.outputFiles[0].text },
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
const evidence: any[] = [];
try {
  for (const dark of [false, true]) {
    const response = await mf.dispatchFetch('https://fixture.test/', {
      method: 'POST',
      body: JSON.stringify({ dark }),
    });
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length < 300000);
    const pixels = decode(bytes);
    assert.equal(pixels.width, 1200);
    assert.equal(pixels.height, 627);
    writeFileSync(`${dir}/${dark ? 'dark' : 'light'}-home.jpg`, bytes);
    evidence.push({ name: `${dark ? 'dark' : 'light'}-home`, bytes: bytes.length, passed: true });
  }
  for (const dark of [false, true])
    for (const variant of [
      'first',
      'second',
      'third',
      'two',
      'strikes',
      'long',
      'strike1',
      'strike2',
      'strike5',
    ])
      for (const shown of [true, false]) {
        const strikeCount =
          variant === 'strikes' ? 4 : Number(variant.match(/^strike(\d)$/)?.[1] || 0);
        const claims = ['Okapi', 'Quokka', 'Sarcastic fringehead']
          .slice(0, strikeCount === 5 ? 2 : 3)
          .map((display, i) => ({
            id: '2026-11-23-' + 'a'.repeat(variant === 'long' ? 400 : 36) + i,
            display,
            category_name: 'Animals',
            category_slug: 'animals',
            category_date: '2026-11-23',
            category_id: 'fixture',
            claim_no: i + 1,
            handle: 'Tan Dove',
            golden:
              variant === 'two'
                ? i !== 1
                : i ===
                  ['first', 'second', 'third'].indexOf(
                    strikeCount > 0 || variant === 'long' ? 'second' : variant,
                  ),
            percentile: 0.94,
            bonus: 0,
            points: 60,
          }));
        claims.forEach((c) => {
          c.bonus = c.golden ? 100 : 0;
          c.points += c.bonus;
        });
        const events: any[] = claims.map((c) => ({
          kind: 'dibs',
          claimId: c.id,
          display: c.display,
          golden: c.golden,
        }));
        if (strikeCount)
          for (let i = 0; i < strikeCount; i++)
            events.splice(i * 2, 0, { kind: 'strike', display: 'SECRET STRUCK GUESS' });
        const file = {
          claims,
          events,
          summaryId: '2026-11-23-' + 'b'.repeat(variant === 'long' ? 400 : 36),
          points: Math.max(0, claims.reduce((n, c) => n + c.points, 0) - strikeCount * 10),
          strikes: strikeCount,
          handle: 'Tan Dove',
          rank: 3,
          players: 27,
        };
        for (const kind of ['summary', 'certificate']) {
          const payload = {
            dark,
            shown,
            ...(kind === 'summary'
              ? {
                  summary: {
                    category: { id: 'fixture', name: 'Animals', date: '2026-11-23' },
                    file,
                  },
                }
              : { claim: claims.find((c) => c.golden) }),
          };
          const call = (layout: boolean) =>
            mf.dispatchFetch('https://fixture.test/', {
              method: 'POST',
              body: JSON.stringify({ ...payload, layout }),
            });
          const layout: any = await (await call(true)).json();
          for (const b of layout.textBounds) {
            assert.ok(
              b.left >= 20 && b.right <= 1180 && b.top >= 20 && b.bottom <= 607,
              JSON.stringify(b),
            );
            assert.ok(!b.value.includes('SECRET STRUCK GUESS'));
          }
          for (const [i, a] of layout.textBounds.entries())
            for (const b of layout.textBounds.slice(i + 1)) {
              const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              assert.ok(overlapX <= 1 || overlapY <= 1, `Text overlap: ${a.value} / ${b.value}`);
            }
          const words = layout.textBounds.map((b: any) => b.value).join('\n');
          if (shown) {
            assert.match(words, /160 points/);
            assert.match(words, /60 \+ 100 golden bonus/);
            assert.ok(words.includes('Golden ticket'));
          } else assert.ok(!/Okapi|Quokka|Sarcastic fringehead/.test(words));
          if (kind === 'summary')
            assert.equal(
              layout.textBounds.filter((b: any) => b.value.includes('Strike · −10')).length,
              strikeCount,
            );
          if (variant === 'long') assert.ok(layout.textBounds.every((b: any) => b.size >= 28));
          const response = await call(false);
          assert.equal(response.status, 200, response.ok ? '' : await response.text());
          const bytes = Buffer.from(await response.arrayBuffer());
          assert.ok(bytes.length < 300000);
          const decoded = decode(bytes);
          assert.equal(decoded.width, 1200);
          assert.equal(decoded.height, 627);
          const name = `${dark ? 'dark' : 'light'}-${variant}-${shown ? 'answers' : 'sealed'}-${kind}`;
          writeFileSync(`${dir}/${name}.jpg`, bytes);
          evidence.push({ name, bytes: bytes.length, passed: true, textBounds: layout.textBounds });
        }
      }
} finally {
  await mf.dispose();
}
writeFileSync(
  'review/round20/og-proof.json',
  JSON.stringify({ passed: true, results: evidence }, null, 2),
);
console.log(
  `Verified ${evidence.length} OG images: actual glyph bounds, stored scores, consent, strikes and size.`,
);
