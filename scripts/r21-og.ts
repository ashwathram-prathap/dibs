import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { decode } from 'jpeg-js';
const dir = 'review/r21-flow/og';
mkdirSync(dir, { recursive: true });
const bundled = await build({
  stdin: {
    contents: `import {og,ogLayout} from './worker/og'; import {publicSummary,visibleClaim} from './worker/visibility'; export default {async fetch(r) { const v=await r.json(); const claim=v.claim ? visibleClaim(v.claim,false,false,v.shown) : null; if(claim)claim.score=v.claim.score; const summary=v.summary ? publicSummary(v.summary,false,v.shown) : undefined; return v.layout ? Response.json(await ogLayout(claim,summary,v.dark)) : og(claim,summary,v.dark); }}`,
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
      'off',
      'offgold',
      'standard',
      'top',
      'provisional',
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
        for (const c of claims as any[]) {
          if (['off', 'offgold', 'standard'].includes(variant)) {
            c.golden = variant === 'offgold' && c.claim_no === 1;
            c.pool = {
              version: 'r21-pool-v1',
              catalogVersion: 'fixture',
              scoringVersion: 'fixture',
              membership: variant === 'standard' ? 'unknown' : 'out',
              poolSize: 3004,
            };
            c.percentile = variant === 'standard' ? null : 1;
          }
        }
        claims.forEach((c) => {
          c.bonus = c.golden ? (variant === 'offgold' ? 50 : 100) : 0;
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
          title:
            variant === 'top'
              ? { name: 'Dibillionaire', reason: 'Top 1% tonight', provisional: false }
              : variant === 'provisional'
                ? { name: 'Owner', reason: 'Three claims tonight', provisional: true }
                : undefined,
          rank: 3,
          players: 27,
        };
        for (const kind of ['summary', 'certificate']) {
          const selected = claims.find((c) => c.golden) || claims[0];
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
              : { claim: { ...selected, score: { title: file.title } } }),
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
            assert.ok(words.includes(`${selected.points} points`));
            if (selected.golden) {
              assert.ok(words.includes('Golden ticket'));
              assert.ok(
                words.includes(`+${selected.bonus}`) ||
                  words.includes(`+ ${selected.bonus} golden bonus`),
              );
            }
            if (variant === 'off' || variant === 'offgold') {
              assert.ok(layout.svg.includes('data-tier="off-register"'));
              assert.ok(layout.svg.includes('rotate(-3'));
              assert.ok(words.includes('Off the register'));
            }
            if (file.title) assert.ok(words.includes(file.title.name));
          } else {
            assert.ok(!/Okapi|Quokka|Sarcastic fringehead/.test(words));
            assert.ok(!layout.svg.includes('data-tier="off-register"'));
          }
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
  'review/r21-flow/og-proof.json',
  JSON.stringify({ passed: true, results: evidence }, null, 2),
);
console.log(
  `Verified ${evidence.length} OG images: actual glyph bounds, stored scores, consent, strikes and size.`,
);
