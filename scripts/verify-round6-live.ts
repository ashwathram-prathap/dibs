import './test-traffic';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SECURITY_HEADERS } from '../shared/security';
const origin = 'https://dibs.here';
const practice = 'https://practice.dibs-7hz.pages.dev';
const checks: { name: string; passed: boolean; detail?: unknown }[] = [];
async function check(name: string, work: () => Promise<unknown>) {
  try {
    checks.push({ name, passed: true, detail: await work() });
  } catch (e) {
    checks.push({ name, passed: false, detail: String(e) });
  }
}
function assert(ok: unknown, message: string) {
  if (!ok) throw Error(message);
}
for (const host of [
  'dibs.here',
  'www.dibs.here',
  'dibs-7hz.pages.dev',
  'dibs-api.dibs-registry.workers.dev',
]) {
  for (const protocol of ['http', 'https']) {
    await check(`${protocol}://${host} canonical route`, async () => {
      const response = await fetch(`${protocol}://${host}/certificate/r6-check?s=copy-link`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20000),
      });
      const location = response.headers.get('location');
      if (host === 'dibs.here' && protocol === 'https')
        assert(response.status === 404, 'Unknown certificate should be 404');
      else
        assert(
          response.status === 301 &&
            (location === `${origin}/certificate/r6-check?s=copy-link` ||
              (protocol === 'http' &&
                location === `https://${host}/certificate/r6-check?s=copy-link`)),
          `Bad redirect ${response.status} ${location}`,
        );
      return { status: response.status, location };
    });
  }
}
for (const path of ['/', '/api/today', '/certificate/r6-check', '/summary/r6-check']) {
  await check(`production security headers ${path}`, async () => {
    const r = await fetch(origin + path);
    assert(r.status === (path.includes('r6-check') ? 404 : 200), `Status ${r.status}`);
    for (const [key, value] of Object.entries(SECURITY_HEADERS))
      assert(r.headers.get(key) === value, `Header ${key}`);
    return r.status;
  });
}
await check('Monday production countdown and empty public record', async () => {
  const data = (await (await fetch(origin + '/api/bootstrap')).json()) as any;
  assert(data.today.nextDrop === '2026-11-24T02:00:00.000Z', 'Wrong launch timestamp');
  assert(
    !data.today.practice && !data.today.category && data.rows.length === 0,
    'Wrong production state',
  );
  return { nextDrop: data.today.nextDrop, claimed: data.today.claimed };
});
await check('canonical social metadata and real OG image', async () => {
  const html = await (await fetch(origin)).text();
  const image = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  assert(image?.startsWith(origin + '/'), 'Wrong OG origin');
  assert(html.includes('summary_large_image'), 'Missing Twitter card');
  const r = await fetch(image!);
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert(
    r.ok && r.headers.get('content-type')?.includes('image/png') && bytes.length < 300000,
    'Invalid OG image',
  );
  return { image, bytes: bytes.length };
});
await check('practice isolated and always open', async () => {
  const r = await fetch(practice + '/api/bootstrap');
  const data = (await r.json()) as any;
  assert(r.headers.get('x-robots-tag')?.includes('noindex'), 'Missing noindex');
  assert(
    data.today.practice && data.today.category?.name === 'PRACTICE',
    'Wrong practice category',
  );
  assert(
    data.today.specials.houseCount === 10 && data.today.specials.goldenTotal === 3,
    'Missing specials',
  );
  return { category: data.today.category.name, open: data.today.open, claimed: data.today.claimed };
});
for (const base of [origin, practice, 'https://dibs-api-staging.dibs-registry.workers.dev']) {
  await check(`${base} noindex and no public answer catalog`, async () => {
    const r = await fetch(base + '/api/answers?q=dog');
    assert(r.headers.get('x-robots-tag')?.includes('noindex'), 'Missing noindex');
    const body = await r.json();
    assert(JSON.stringify(body) === '{"answers":[]}', 'Answer catalog leaked');
    return r.status;
  });
}
mkdirSync('review/round6', { recursive: true });
writeFileSync(
  'review/round6/live-checks.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
);
console.log(`${checks.filter((c) => c.passed).length}/${checks.length} live checks passed`);
for (const c of checks.filter((c) => !c.passed)) console.log(c.name, c.detail);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
