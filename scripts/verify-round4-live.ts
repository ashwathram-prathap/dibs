import { writeFileSync } from 'node:fs';
import { PUBLIC_ORIGIN } from '../shared/config';
import { PNG } from 'pngjs';
const agents = {
  WhatsApp: 'WhatsApp/2.24.22.79 A',
  X: 'Twitterbot/1.0',
  Facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  iMessage: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  Discord: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
};
const checks: any[] = [];
for (const [platform, agent] of Object.entries(agents)) {
  const html = await (await fetch(PUBLIC_ORIGIN, { headers: { 'user-agent': agent } })).text();
  if (!html.includes('summary_large_image')) throw Error('Missing Twitter card');
  const image = html.match(/property="og:image" content="([^"]+)"/)![1];
  const start = performance.now();
  const response = await fetch(image, { headers: { 'user-agent': agent } });
  const bytes = Buffer.from(await response.arrayBuffer());
  const milliseconds = Math.round(performance.now() - start);
  const png = PNG.sync.read(bytes);
  checks.push({ platform, scope: 'live generic preview', status: response.status, bytes: bytes.length, milliseconds, width: png.width, height: png.height });
  if (!response.ok || bytes.length >= 300000 || milliseconds >= 2000 || png.width !== 1200 || png.height !== 630) throw Error('Preview budget exceeded');
}
for (const path of ['/api/today', '/api/archive', '/api/ledger?category=not-an-open-register', '/certificate/not-a-record', '/summary/not-a-record']) {
  const r = await fetch(PUBLIC_ORIGIN + path);
  const body = await r.text();
  checks.push({ path, status: r.status, body });
  if (path.includes('not-a-record') && r.status !== 404) throw Error('Unknown public file must return 404');
}
writeFileSync('review/round4/live-fetches.json', JSON.stringify(checks, null, 2));
console.log(JSON.stringify(checks, null, 2));
