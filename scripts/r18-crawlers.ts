import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'review/round18/crawlers';
mkdirSync(dir, { recursive: true });
const results = [];
for (const [bot, ua] of [
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
]) {
  for (const endpoint of ['sitemap.xml', 'robots.txt']) {
    const prefix = `${dir}/${bot}-${endpoint.replace('.', '-')}`;
    const output = execFileSync(
      'curl',
      [
        '--silent',
        '--show-error',
        '--location',
        '--max-redirs',
        '5',
        '--max-time',
        '30',
        '-A',
        ua,
        '-D',
        prefix + '.headers.txt',
        '-o',
        prefix + '.body.txt',
        '-w',
        '%{json}',
        `https://dibs.here/${endpoint}`,
      ],
      { encoding: 'utf8' },
    );
    const transfer = JSON.parse(output),
      body = readFileSync(prefix + '.body.txt', 'utf8');
    assert.equal(transfer.http_code, 200);
    assert.equal(transfer.num_redirects, 0);
    assert.equal(
      transfer.content_type,
      endpoint === 'sitemap.xml' ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
    );
    assert.ok(!/challenge-platform|Just a moment|cf-turnstile/i.test(body));
    if (endpoint === 'sitemap.xml') {
      execFileSync('python3', [
        '-c',
        'import sys,xml.etree.ElementTree as E,datetime; r=E.parse(sys.argv[1]).getroot(); assert r.tag=="{http://www.sitemaps.org/schemas/sitemap/0.9}urlset"; dates=r.findall(".//{*}lastmod"); assert dates; [datetime.datetime.fromisoformat(x.text.replace("Z","+00:00")) for x in dates]',
        prefix + '.body.txt',
      ]);
      assert.ok(body.includes('https://dibs.here/about'));
    } else assert.ok(body.includes('Sitemap: https://dibs.here/sitemap.xml'));
    results.push({
      bot,
      endpoint,
      status: transfer.http_code,
      contentType: transfer.content_type,
      redirects: transfer.num_redirects,
      seconds: transfer.time_total,
      valid: true,
      challenge: false,
    });
  }
}
writeFileSync(
  `${dir}/results.json`,
  JSON.stringify({ at: new Date().toISOString(), passed: true, results }, null, 2),
);
console.log(results);
