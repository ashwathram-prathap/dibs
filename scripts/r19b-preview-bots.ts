import './test-traffic';
import { writeFileSync } from 'node:fs';
import { decode } from 'jpeg-js';
import assert from 'node:assert/strict';
export async function verifyPreviews(
  origin: string,
  ids?: { summary: string; claim: string },
  phase = 'after',
) {
  const evidence: any[] = [];
  const agents = [
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'facebookexternalhit',
    'Twitterbot',
    'Slackbot',
    'Discordbot',
  ];
  for (const agent of agents)
    for (const path of ['/', ...(ids ? ['/summary/' + ids.summary, '/c/' + ids.claim] : [])]) {
      const start = performance.now();
      const response = await fetch(origin + path, {
        headers: { 'user-agent': agent, 'x-dibs-test': '1' },
        redirect: 'manual',
      });
      const html = await response.text();
      const tags = Object.fromEntries(
        [...html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)].map((m) => [
          m[1],
          m[2].replaceAll('&amp;', '&'),
        ]),
      );
      const pageMs = performance.now() - start;
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.includes('text/html'));
      assert.ok(!html.includes('cf-chl-'));
      for (const k of [
        'og:title',
        'og:description',
        'og:url',
        'og:type',
        'og:image',
        'og:image:alt',
      ])
        assert.ok(tags[k], k);
      assert.equal(tags['og:image:width'], '1200');
      assert.equal(tags['og:image:height'], '627');
      assert.equal(tags['twitter:card'], 'summary_large_image');
      assert.ok(tags['og:image'].startsWith('https://'));
      const began = performance.now();
      const image = await fetch(tags['og:image'], {
        headers: { 'user-agent': agent, 'x-dibs-test': '1' },
        redirect: 'manual',
      });
      const bytes = Buffer.from(await image.arrayBuffer());
      const ms = performance.now() - began;
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/jpeg');
      assert.ok(bytes.length < 1_000_000);
      const decoded = decode(bytes);
      assert.deepEqual([decoded.width, decoded.height], [1200, 627]);
      assert.ok(ms < 3000 && pageMs < 3000, `Preview too slow: ${pageMs}/${ms}`);
      evidence.push({
        origin,
        path,
        agent,
        status: response.status,
        headers: Object.fromEntries(response.headers),
        tags,
        pageMs,
        image: {
          status: image.status,
          headers: Object.fromEntries(image.headers),
          bytes: bytes.length,
          width: decoded.width,
          height: decoded.height,
          ms,
        },
      });
    }
  writeFileSync(
    `review/round19b/${origin.includes('practice') ? 'practice' : 'production'}-bots-${phase}.json`,
    JSON.stringify(
      { at: new Date().toISOString(), validScoreLinksAvailable: !!ids, evidence },
      null,
      2,
    ),
  );
  return evidence;
}
if (process.argv[1]?.endsWith('r19b-preview-bots.ts'))
  await verifyPreviews(
    process.argv[2] || 'https://dibs.here',
    process.argv[3] ? { summary: process.argv[3], claim: process.argv[4] } : undefined,
    process.argv[3] ? 'after' : 'home-after',
  );
