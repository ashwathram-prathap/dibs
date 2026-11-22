import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SECURITY_HEADERS } from '../shared/security';
const worker = process.env.DIBS_WORKER_URL;
const hosts = [
  'dibs.here',
  'www.dibs.here',
  'dibs-7hz.pages.dev',
  ...(worker ? [new URL(worker).host] : []),
];
const checks: any[] = [];
for (const host of hosts)
  for (const protocol of ['http', 'https']) {
    const url = `${protocol}://${host}/certificate/round5-check?s=copy-link`;
    try {
      const raw = execFileSync(
        'curl',
        ['-sS', '-D', '-', '-o', '/dev/null', '--max-time', '20', url],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const status = Number(raw.match(/^HTTP\/\S+ (\d+)/m)?.[1]);
      const location = raw.match(/^location:\s*(.+)$/im)?.[1].trim();
      checks.push({
        url,
        status,
        location,
        passed:
          host === 'dibs.here' && protocol === 'https'
            ? status !== 301
            : status === 301 &&
              location === 'https://dibs.here/certificate/round5-check?s=copy-link',
      });
    } catch (e: any) {
      checks.push({ url, passed: false, error: String(e.stderr || e.message).trim() });
    }
  }
for (const path of ['/', '/certificate/round5-check', '/api/today']) {
  const url = 'https://dibs.here' + path;
  try {
    const response = await fetch(url, { redirect: 'manual' });
    const headers = Object.fromEntries(
      Object.keys(SECURITY_HEADERS).map((k) => [k, response.headers.get(k)]),
    );
    checks.push({
      url,
      status: response.status,
      headers,
      passed: Object.entries(SECURITY_HEADERS).every(([k, v]) => headers[k] === v),
      note: path.includes('certificate')
        ? 'Unknown record: verifies error-page headers; real certificate needed after launch.'
        : undefined,
    });
  } catch (e: any) {
    checks.push({ url, passed: false, error: e.cause?.code || e.message });
  }
}
mkdirSync('review/round5', { recursive: true });
writeFileSync(
  'review/round5/live-checks.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
);
console.log(
  `${checks.filter((c) => c.passed).length}/${checks.length} live checks passed; review/round5/live-checks.json`,
);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
